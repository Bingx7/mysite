-- 已有项目：先执行 supabase-security-fix.sql，再执行本文件。
-- 新项目：先执行 supabase-migration.sql，再执行本文件。可重复执行。
BEGIN;

ALTER TABLE public.content_images ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.content_images ADD COLUMN IF NOT EXISTS is_cover BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS one_cover_per_content ON public.content_images(content_id) WHERE is_cover;

CREATE OR REPLACE FUNCTION public.can_view_image_object(object_name TEXT, viewer_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.content_images image
        JOIN public.contents content ON content.id = image.content_id
        LEFT JOIN public.profiles viewer ON viewer.id = viewer_id
        WHERE (image.url = object_name OR image.thumbnail_url = object_name)
        AND (
            content.visibility = 'public' OR content.author_id = viewer_id
            OR (content.visibility = 'partner' AND viewer.level IN (3, 4))
            OR (content.visibility = 'internal' AND viewer.level >= 2)
        )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.can_view_image_object(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_image_object(TEXT, UUID) TO anon, authenticated;

-- 一次事务保存正文、图片顺序、缩略图和封面。恢复仅超级管理员可调用。
CREATE OR REPLACE FUNCTION public.save_content_bundle(
    p_id UUID, p_content JSONB, p_images JSONB, p_restore BOOLEAN DEFAULT false
) RETURNS JSONB AS $$
DECLARE
    actor UUID := auth.uid();
    admin BOOLEAN;
    existing public.contents%ROWTYPE;
    author UUID;
    item JSONB;
    object_path TEXT;
    cover_count INTEGER;
BEGIN
    IF actor IS NULL THEN RAISE EXCEPTION '请先登录'; END IF;
    admin := public.is_super_admin(actor);
    IF p_restore AND NOT admin THEN RAISE EXCEPTION '只有超级管理员可以恢复备份'; END IF;
    IF p_id IS NULL OR jsonb_typeof(p_content) IS DISTINCT FROM 'object'
        OR jsonb_typeof(p_images) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION '内容格式无效';
    END IF;
    -- 同一 ID 的重试和并发恢复不会生成重复内容。
    PERFORM pg_advisory_xact_lock(hashtextextended(p_id::TEXT, 0));
    SELECT * INTO existing FROM public.contents WHERE id = p_id;
    IF existing.id IS NOT NULL THEN
        IF p_restore THEN RETURN jsonb_build_object('id', p_id, 'skipped', true); END IF;
        IF existing.author_id <> actor THEN RAISE EXCEPTION '只有作者本人可以编辑内容和图片'; END IF;
        author := existing.author_id;
    ELSE
        author := actor;
        IF p_restore AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (p_content->>'authorId')::UUID) THEN
            author := (p_content->>'authorId')::UUID;
        END IF;
    END IF;
    IF COALESCE(length(trim(p_content->>'title')), 0) = 0 THEN RAISE EXCEPTION '请输入标题'; END IF;
    IF jsonb_array_length(p_images) > 9 THEN RAISE EXCEPTION '每条内容最多 9 张图片'; END IF;
    IF (p_content->>'startDate')::TIMESTAMPTZ > (p_content->>'endDate')::TIMESTAMPTZ THEN
        RAISE EXCEPTION '结束日期不能早于开始日期';
    END IF;
    SELECT count(*) INTO cover_count FROM jsonb_array_elements(p_images) image WHERE COALESCE((image->>'is_cover')::BOOLEAN, false);
    IF cover_count > 1 THEN RAISE EXCEPTION '每条内容只能选择一张封面'; END IF;
    -- 只接受当前账号上传的对象，或这条内容已关联的旧对象。不能引用其他人的私密图片。
    FOR item IN SELECT * FROM jsonb_array_elements(p_images) LOOP
        IF COALESCE(length(item->>'url'), 0) = 0 THEN RAISE EXCEPTION '图片路径为空'; END IF;
        FOREACH object_path IN ARRAY ARRAY[item->>'url', item->>'thumbnail_url'] LOOP
            IF object_path IS NULL THEN CONTINUE; END IF;
            IF NOT (
                (split_part(object_path, '/', 1) = actor::TEXT AND EXISTS (
                    SELECT 1 FROM storage.objects WHERE bucket_id = 'images' AND name = object_path
                )) OR EXISTS (
                    SELECT 1 FROM public.content_images WHERE content_id = p_id
                    AND (url = object_path OR thumbnail_url = object_path)
                )
            ) THEN RAISE EXCEPTION '图片不存在或无权使用'; END IF;
        END LOOP;
    END LOOP;
    IF existing.id IS NULL THEN
        INSERT INTO public.contents(id, author_id, type, title, body, description, visibility, start_date, end_date, pinned, created_at)
        VALUES (p_id, author, p_content->>'type', p_content->>'title', COALESCE(p_content->>'body', ''),
            COALESCE(p_content->>'description', ''), COALESCE(p_content->>'visibility', 'private'),
            (p_content->>'startDate')::TIMESTAMPTZ, (p_content->>'endDate')::TIMESTAMPTZ,
            CASE WHEN p_restore THEN COALESCE((p_content->>'pinned')::BOOLEAN, false) ELSE false END,
            CASE WHEN p_restore THEN COALESCE((p_content->>'created_at')::TIMESTAMPTZ, now()) ELSE now() END);
    ELSE
        UPDATE public.contents SET type = p_content->>'type', title = p_content->>'title',
            body = COALESCE(p_content->>'body', ''), description = COALESCE(p_content->>'description', ''),
            visibility = COALESCE(p_content->>'visibility', 'private'),
            start_date = (p_content->>'startDate')::TIMESTAMPTZ, end_date = (p_content->>'endDate')::TIMESTAMPTZ
        WHERE id = p_id;
    END IF;
    DELETE FROM public.content_images WHERE content_id = p_id;
    INSERT INTO public.content_images(content_id, url, thumbnail_url, caption, sort_order, is_cover)
    SELECT p_id, image->>'url', image->>'thumbnail_url', COALESCE(image->>'caption', ''), ordinal::INTEGER - 1,
        COALESCE((image->>'is_cover')::BOOLEAN, false)
    FROM jsonb_array_elements(p_images) WITH ORDINALITY AS entry(image, ordinal);
    RETURN jsonb_build_object('id', p_id, 'skipped', false, 'author_id', author);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.save_content_bundle(UUID, JSONB, JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_content_bundle(UUID, JSONB, JSONB, BOOLEAN) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';

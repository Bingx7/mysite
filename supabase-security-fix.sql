-- 已有 Supabase 项目使用的安全补丁
-- 在 Supabase SQL Editor 中执行一次，然后确认 Storage > images 显示为 Private。

BEGIN;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND level = 3);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_high_privileged(user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND level IN (3, 4));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.is_super_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_high_privileged(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_high_privileged(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF (
        NEW.level IS DISTINCT FROM OLD.level
        OR NEW.username IS DISTINCT FROM OLD.username
        OR NEW.email IS DISTINCT FROM OLD.email
    ) AND auth.uid() IS NOT NULL AND NOT public.is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Only a super admin can change account or role fields';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS protect_profile_sensitive_fields_before_update ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_fields_before_update
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles FOR UPDATE
    USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete any profile" ON public.profiles;
CREATE POLICY "Admins can delete any profile" ON public.profiles FOR DELETE
    USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Partner contents viewable" ON public.contents;
CREATE POLICY "Partner contents viewable" ON public.contents FOR SELECT
    USING (
        visibility = 'partner'
        AND (auth.uid() = author_id OR public.is_high_privileged(auth.uid()))
    );

DROP POLICY IF EXISTS "Contents update by author or admin" ON public.contents;
CREATE POLICY "Contents update by author or admin" ON public.contents FOR UPDATE
    USING (auth.uid() = author_id OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Contents delete by author or admin" ON public.contents;
CREATE POLICY "Contents delete by author or admin" ON public.contents FOR DELETE
    USING (auth.uid() = author_id OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Settings viewable by admin" ON public.system_settings;
DROP POLICY IF EXISTS "Settings viewable by everyone" ON public.system_settings;
CREATE POLICY "Settings viewable by everyone" ON public.system_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Settings update by admin" ON public.system_settings;
CREATE POLICY "Settings update by admin" ON public.system_settings FOR UPDATE
    USING (public.is_super_admin(auth.uid()));

ALTER TABLE public.system_settings
    ALTER COLUMN registration_open SET DEFAULT false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 新代码会直接保存 Storage 对象路径；把常见的旧公开 URL 转为路径。
UPDATE public.content_images
SET url = regexp_replace(url, '^.*/storage/v1/object/public/images/', '')
WHERE url LIKE '%/storage/v1/object/public/images/%';

CREATE OR REPLACE FUNCTION public.can_view_image_object(object_name TEXT, viewer_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.content_images image
        JOIN public.contents content ON content.id = image.content_id
        LEFT JOIN public.profiles viewer ON viewer.id = viewer_id
        WHERE image.url = object_name
        AND (
            content.visibility = 'public'
            OR content.author_id = viewer_id
            OR (content.visibility = 'partner' AND viewer.level IN (3, 4))
            OR (content.visibility = 'internal' AND viewer.level >= 2)
        )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.can_view_image_object(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_image_object(TEXT, UUID) TO anon, authenticated;

-- 删除这个 images bucket 之前可能存在的“所有人可读”等旧策略；RLS 策略会以 OR 合并，旧策略不删就仍可能公开。
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND (
              COALESCE(qual, '') LIKE '%bucket_id%images%'
              OR COALESCE(with_check, '') LIKE '%bucket_id%images%'
          )
    LOOP
        EXECUTE format('DROP POLICY %I ON storage.objects', policy_record.policyname);
    END LOOP;
END;
$$;

CREATE POLICY "Image objects are visible with content" ON storage.objects FOR SELECT
    USING (
        bucket_id = 'images'
        AND (
            (storage.foldername(name))[1] = auth.uid()::TEXT
            OR public.can_view_image_object(name, auth.uid())
        )
    );

CREATE POLICY "Users can upload own image objects" ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'images'
        AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );

CREATE POLICY "Users can delete own image objects" ON storage.objects FOR DELETE
    USING (
        bucket_id = 'images'
        AND (
            (storage.foldername(name))[1] = auth.uid()::TEXT
            OR public.is_super_admin(auth.uid())
        )
    );

COMMIT;

-- 这个小站如果只给固定几个人使用，请同时在 Supabase Dashboard：
-- Authentication > Providers > Email 中关闭 Allow new users to sign up。

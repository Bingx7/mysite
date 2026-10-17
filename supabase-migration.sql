-- 在 Supabase SQL Editor 中执行全部内容，再执行 supabase-media-features.sql 启用图片与备份功能。
-- 1. 用户扩展资料表
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    name TEXT NOT NULL,
    avatar TEXT DEFAULT '👤',
    level INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 新用户注册时自动创建 profile（username 从 meta 取，否则用邮箱）
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, username, email, name, level)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        1
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 权限判断统一放在 SECURITY DEFINER 函数中，避免客户端伪造 level。
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND level = 3);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_high_privileged(user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND level IN (3, 4));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION is_super_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_high_privileged(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_super_admin(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_high_privileged(UUID) TO anon, authenticated;

-- 普通用户可以改自己的昵称/头像，但不能把 level 改成管理员。
CREATE OR REPLACE FUNCTION protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF (
        NEW.level IS DISTINCT FROM OLD.level
        OR NEW.username IS DISTINCT FROM OLD.username
        OR NEW.email IS DISTINCT FROM OLD.email
    ) AND auth.uid() IS NOT NULL AND NOT is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Only a super admin can change account or role fields';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER protect_profile_sensitive_fields_before_update
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION protect_profile_sensitive_fields();

-- 注册后如需将首个用户升级为超级管理员（level=3），执行：
-- UPDATE profiles SET level = 3 WHERE username = 'bingx';

-- 2. 内容表
CREATE TABLE contents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('diary', 'article', 'album')),
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    description TEXT DEFAULT '',
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'partner', 'internal')),
    pinned BOOLEAN DEFAULT false,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contents_author ON contents(author_id);
CREATE INDEX idx_contents_type ON contents(type);
CREATE INDEX idx_contents_visibility ON contents(visibility);
CREATE INDEX idx_contents_pinned ON contents(pinned);

-- 3. 内容图片表
CREATE TABLE content_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES contents(id) ON DELETE CASCADE NOT NULL,
    url TEXT NOT NULL,
    caption TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_images_content ON content_images(content_id);

-- 4. 操作日志表
CREATE TABLE operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    user_name TEXT,
    action TEXT NOT NULL,
    target TEXT,
    target_type TEXT,
    detail TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_logs_action ON operation_logs(action);
CREATE INDEX idx_logs_created ON operation_logs(created_at DESC);

-- 5. 系统设置表（单行）
CREATE TABLE system_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    registration_open BOOLEAN DEFAULT false,
    daily_post_limit INTEGER DEFAULT 10,
    max_image_size INTEGER DEFAULT 10,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 6. RLS 策略

-- profiles: 所有人可读，本人可改，管理员可管理全部
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE
    USING (is_super_admin(auth.uid()));
CREATE POLICY "Admins can delete any profile" ON profiles FOR DELETE
    USING (is_super_admin(auth.uid()));

-- contents: 按可见性控制读取
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;

-- 公开内容所有人可读
CREATE POLICY "Public contents viewable" ON contents FOR SELECT
    USING (visibility = 'public');

-- 私密内容只有作者可读
CREATE POLICY "Private contents viewable by author" ON contents FOR SELECT
    USING (visibility = 'private' AND auth.uid() = author_id);

-- 伴侣内容：作者 + 高级管理员
CREATE POLICY "Partner contents viewable" ON contents FOR SELECT
    USING (visibility = 'partner' AND (
        auth.uid() = author_id
        OR is_high_privileged(auth.uid())
    ));

-- 内部内容：管理员及以上
CREATE POLICY "Internal contents viewable" ON contents FOR SELECT
    USING (visibility = 'internal' AND (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level >= 2)
    ));

-- 内容插入/更新/删除：作者或高级管理员
CREATE POLICY "Contents insert by authenticated" ON contents FOR INSERT
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Contents update by author or admin" ON contents FOR UPDATE
    USING (auth.uid() = author_id OR is_super_admin(auth.uid()));

CREATE POLICY "Contents delete by author or admin" ON contents FOR DELETE
    USING (auth.uid() = author_id OR is_super_admin(auth.uid()));

-- content_images: 关联内容可见则可见
ALTER TABLE content_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Images viewable with content" ON content_images FOR SELECT
    USING (EXISTS (SELECT 1 FROM contents WHERE id = content_images.content_id));

CREATE POLICY "Images insert by content author" ON content_images FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM contents WHERE id = content_images.content_id AND author_id = auth.uid()));

CREATE POLICY "Images delete by content author" ON content_images FOR DELETE
    USING (EXISTS (SELECT 1 FROM contents WHERE id = content_images.content_id AND author_id = auth.uid()));

-- operation_logs: 仅管理员可读
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logs viewable by admin" ON operation_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level >= 2));
CREATE POLICY "Logs insert by admin" ON operation_logs FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND level >= 2));

-- system_settings: 注册页面也需要读取 registration_open；只有超级管理员可修改
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings viewable by everyone" ON system_settings FOR SELECT USING (true);
CREATE POLICY "Settings update by admin" ON system_settings FOR UPDATE
    USING (is_super_admin(auth.uid()));

-- 7. 私有图片存储。content_images.url 保存对象路径，而不是永久公开 URL。
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE OR REPLACE FUNCTION can_view_image_object(object_name TEXT, viewer_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM content_images image
        JOIN contents content ON content.id = image.content_id
        LEFT JOIN profiles viewer ON viewer.id = viewer_id
        WHERE (
            image.url = object_name
            OR image.url LIKE '%/storage/v1/object/public/images/' || object_name
        )
        AND (
            content.visibility = 'public'
            OR content.author_id = viewer_id
            OR (content.visibility = 'partner' AND viewer.level IN (3, 4))
            OR (content.visibility = 'internal' AND viewer.level >= 2)
        )
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION can_view_image_object(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_view_image_object(TEXT, UUID) TO anon, authenticated;

CREATE POLICY "Image objects are visible with content" ON storage.objects FOR SELECT
    USING (
        bucket_id = 'images'
        AND (
            (storage.foldername(name))[1] = auth.uid()::TEXT
            OR can_view_image_object(name, auth.uid())
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
            OR is_super_admin(auth.uid())
        )
    );

import { supabase } from './supabase'
import { contentFilter } from './contentQuery'
import { diaryRangeFilter } from './diary.js'
import { otherDiaryUsername } from './diaryAccess.js'

/* ==============================
   用户 (profiles)
   ============================== */

/** 获取所有用户 */
export async function getUsers() {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, name, avatar, level, created_at')
        .order('created_at', { ascending: true })
    if (error) throw error
    return data || []
}

/** 根据 ID 获取用户 */
export async function getUserById(id) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (error) throw error
    return data || null
}

/** 根据 username 获取用户 */
export async function getUserByUsername(username) {
    const { data, error } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle()
    if (error) throw error
    return data || null
}

/** 新增用户（直接插入 profiles，不经过 auth） */
export async function addUser(user) {
    const { data, error } = await supabase.from('profiles').insert({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email || null,
        avatar: user.avatar || '👤',
        level: user.level || 1
    }).select().single()

    if (error) throw error
    return data
}

/** 更新用户信息 */
export async function updateUser(id, updates) {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data
}

/** 删除用户（级联删除由数据库 CASCADE 处理） */
export async function deleteUser(id) {
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) throw error
}

/* ==============================
   内容 (contents)
   ============================== */

/** 获取所有内容 */
export async function getContents() {
    const { data, error } = await supabase.from('contents').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data || []
}

/** 根据 ID 获取内容 */
export async function getContentById(id) {
    const { data, error } = await supabase.from('contents').select('*').eq('id', id).single()
    if (error) throw error
    return data || null
}

/** 根据类型获取内容 */
export async function getContentsByType(type) {
    const { data, error } = await supabase
        .from('contents')
        .select('*')
        .eq('type', type)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
    if (error) throw error
    return data || []
}

/** 前台分页读取：搜索与权限过滤均在分页前执行，不影响后台全量查询。 */
export async function getContentsPage({ type, page = 1, pageSize = 8, search = '', user = null, signal }) {
    let query = supabase.from('contents').select('*', { count: 'exact' })
        .or(contentFilter(user, search))
        .order('created_at', { ascending: false }).order('id', { ascending: false })
    if (type !== 'all') query = query.eq('type', type)
    query = query.range((page - 1) * pageSize, page * pageSize - 1)
    if (signal) query = query.abortSignal(signal)
    const { data, count, error } = await query
    if (error) throw error
    return { rows: data || [], total: count ?? data?.length ?? 0 }
}

/** 月历只读取当前账号有权查看的日期索引，不下载整月正文或图片。 */
export async function getDiaryIndex({ month, search = '', authorScope = 'all', user = null, signal }) {
    let otherAuthorId = null
    if (authorScope === 'other') {
        const username = otherDiaryUsername(user)
        if (!username) return []
        let profileQuery = supabase.from('profiles').select('id').eq('username', username)
        if (signal) profileQuery = profileQuery.abortSignal(signal)
        const { data: profile, error } = await profileQuery.maybeSingle()
        if (error) throw error
        if (!profile?.id || profile.id === user.id) return []
        otherAuthorId = profile.id
    }
    const rows = []
    const batchSize = 500
    for (let offset = 0; ; offset += batchSize) {
        let query = supabase.from('contents')
            .select('id, author_id, type, visibility, start_date, created_at', { count: 'exact' })
            .eq('type', 'diary')
            .or(`and(or(${contentFilter(user, search)}),or(${diaryRangeFilter(month)}))`)
            .order('id', { ascending: true })
            .range(offset, offset + batchSize - 1)
        if (user?.id && authorScope === 'mine') query = query.eq('author_id', user.id)
        if (otherAuthorId) query = query.eq('author_id', otherAuthorId)
        if (signal) query = query.abortSignal(signal)
        const { data, count, error } = await query
        if (error) throw error
        rows.push(...(data || []))
        if (!data?.length || (count != null ? rows.length >= count : data.length < batchSize)) break
    }
    return rows
}

/** 按日期索引分页后再读正文，保留日记日期与旧记录混合时的正确顺序。 */
export async function getDiaryPageRows(ids, { user = null, signal } = {}) {
    if (!ids.length) return []
    let query = supabase.from('contents').select('*').eq('type', 'diary')
        .in('id', ids).or(contentFilter(user))
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) throw error
    const rows = new Map((data || []).map(row => [row.id, row]))
    return ids.map(id => rows.get(id)).filter(Boolean)
}

/** 根据可见性获取内容 */
export async function getContentsByVisibility(visibility) {
    const { data, error } = await supabase.from('contents').select('*').eq('visibility', visibility)
    if (error) throw error
    return data || []
}

/** 根据作者获取内容 */
export async function getContentsByAuthorId(authorId) {
    const { data, error } = await supabase.from('contents').select('*').eq('author_id', authorId).order('created_at', { ascending: false })
    if (error) throw error
    return data || []
}

/** 新增内容 */
export async function addContent(content) {
    const { data, error } = await supabase.from('contents').insert({
        author_id: content.authorId,
        type: content.type,
        title: content.title,
        body: content.body || '',
        description: content.description || '',
        visibility: content.visibility || 'private',
        pinned: content.pinned || false,
        start_date: content.startDate ? new Date(content.startDate).toISOString() : null,
        end_date: content.endDate ? new Date(content.endDate).toISOString() : null
    }).select().single()

    if (error) throw error
    return data
}

/** 更新内容 */
export async function updateContent(id, updates) {
    // 只允许更新 contents 表真实存在且可编辑的字段，避免把 images、captions、authorId 等表单字段传给数据库。
    const payload = {}
    for (const field of ['type', 'title', 'body', 'description', 'visibility', 'pinned']) {
        if (updates[field] !== undefined) payload[field] = updates[field]
    }
    if (updates.startDate !== undefined) {
        payload.start_date = updates.startDate ? new Date(updates.startDate).toISOString() : null
    } else if (updates.start_date !== undefined) {
        payload.start_date = updates.start_date
    }
    if (updates.endDate !== undefined) {
        payload.end_date = updates.endDate ? new Date(updates.endDate).toISOString() : null
    } else if (updates.end_date !== undefined) {
        payload.end_date = updates.end_date
    }

    if (Object.keys(payload).length === 0) return null

    const { data, error } = await supabase.from('contents').update(payload).eq('id', id).select().single()
    if (error) throw error
    return data
}

/** 删除内容（级联删除图片由数据库 CASCADE 处理） */
export async function deleteContent(id) {
    const { error } = await supabase.from('contents').delete().eq('id', id)
    if (error) throw error
}

/** 切换置顶 */
export async function pinContent(id) {
    const { data: current, error: readError } = await supabase.from('contents').select('pinned').eq('id', id).single()
    if (readError) throw readError
    const { data, error } = await supabase.from('contents').update({ pinned: !current.pinned }).eq('id', id).select().single()
    if (error) throw error
    return data
}

/** 获取置顶内容 */
export async function getPinnedContents(type) {
    const { data, error } = await supabase.from('contents').select('*').eq('type', type).eq('pinned', true)
    if (error) throw error
    return data || []
}

/* ==============================
   内容图片 (content_images)
   ============================== */

/** 获取所有图片 */
export async function getImages() {
    const { data, error } = await supabase.from('content_images').select('*')
    if (error) throw error
    return data || []
}

/** 根据内容 ID 获取图片 */
export async function getImagesByContentId(contentId) {
    const { data, error } = await supabase.from('content_images').select('*').eq('content_id', contentId).order('sort_order', { ascending: true })
    if (error) throw error
    return data || []
}

/** 新增图片 */
export async function addImages(images) {
    if (images.length === 0) return
    const { error } = await supabase.from('content_images').insert(images.map((img, idx) => ({
        content_id: img.contentId,
        url: img.url,
        caption: img.caption || '',
        sort_order: idx
    })))
    if (error) throw error
}

/** 删除内容的所有图片 */
export async function deleteImagesByContentId(contentId) {
    const { error } = await supabase.from('content_images').delete().eq('content_id', contentId)
    if (error) throw error
}

/* ==============================
   操作日志 (operation_logs)
   ============================== */

/** 添加操作日志 */
export async function addLog(logEntry) {
    const { error } = await supabase.from('operation_logs').insert({
        user_id: logEntry.userId,
        user_name: logEntry.userName,
        action: logEntry.action,
        target: logEntry.target,
        target_type: logEntry.targetType,
        detail: logEntry.detail
    })
    if (error) throw error
}

/** 获取操作日志（最新在前） */
export async function getLogs() {
    const { data, error } = await supabase.from('operation_logs').select('*').order('created_at', { ascending: false }).limit(500)
    if (error) throw error
    return data || []
}

/* ==============================
   系统设置 (system_settings)
   ============================== */

/** 获取系统设置（表不存在时降级为默认值） */
export async function getSystemSettings() {
    const { data, error } = await supabase.from('system_settings').select('*').eq('id', 1).maybeSingle()
    if (error) {
        console.warn('无法加载系统设置，默认关闭注册:', error.message)
        return { registration_open: false, daily_post_limit: 10, max_image_size: 10 }
    }
    return data || { registration_open: false, daily_post_limit: 10, max_image_size: 10 }
}

/** 根据用户名查找完整 profile（用于用户名登录） */
export async function getProfileByUsername(username) {
    const { data, error } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle()
    if (error) throw error
    return data || null
}

/** 根据用户名查找邮箱（用于用户名登录，兼容旧调用） */
export async function getEmailByUsername(username) {
    const profile = await getProfileByUsername(username)
    return profile?.email || null
}

/** 更新系统设置 */
export async function updateSystemSettings(settings) {
    const { error } = await supabase.from('system_settings').update({
        ...settings,
        updated_at: new Date().toISOString()
    }).eq('id', 1)
    if (error) throw error
}

/* ==============================
   存储用量统计
   ============================== */

/** 获取存储概况 */
export async function getStorageUsage() {
    const [usersRes, contentsRes, imagesRes, logsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('contents').select('id', { count: 'exact', head: true }),
        supabase.from('content_images').select('id', { count: 'exact', head: true }),
        supabase.from('operation_logs').select('id', { count: 'exact', head: true })
    ])

    return {
        totalUsers: usersRes.count || 0,
        totalContents: contentsRes.count || 0,
        totalImages: imagesRes.count || 0,
        logsCount: logsRes.count || 0
    }
}

/* ==============================
   初始化：检查 session
   ============================== */

/** 检查是否有已登录的 session，返回用户信息 */
export async function restoreSession() {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) return null

        let { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()

        // profile 丢失时自动重建
        if (!profile) {
            const meta = session.user.user_metadata || {}
            const username = meta.username || session.user.email?.split('@')[0] || 'user'
            const name = meta.name || '用户'
            const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
            const level = count === 0 ? 3 : 1
            profile = await addUser({
                id: session.user.id,
                username,
                name,
                email: session.user.email,
                avatar: '👤',
                level
            })
            console.log('已自动重建 profile:', username)
        }

        return profile ? { ...session.user, ...profile } : null
    } catch {
        return null
    }
}

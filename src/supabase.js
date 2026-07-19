import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase 环境变量未配置，请复制 .env.example 为 .env 并填入实际值')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')

/**
 * 获取当前登录用户的 profile（含 level、avatar 等自定义字段）
 * @returns {Promise<Object|null>}
 */
export async function getCurrentProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    return profile ? { ...user, ...profile } : null
}

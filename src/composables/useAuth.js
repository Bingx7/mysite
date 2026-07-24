import { ref } from 'vue'
import { supabase } from '../supabase'
import { restoreSession, getUserByUsername, getProfileByUsername, addUser } from '../data'
import { getCurrentTime } from '../utils'

/* ===== 认证状态管理 ===== */
export function useAuth() {
    const currentUser = ref(null)
    const isLoggedIn = ref(false)
    const loading = ref(false)
    const isLoginPage = ref(true)
    const appReady = ref(false)
    const loginForm = ref({ email: '', password: '' })
    const registerForm = ref({ email: '', password: '', username: '', name: '' })
    const isRegisterMode = ref(false)
    const headerTime = ref(getCurrentTime())
    const toastMessage = ref('')
    const toastType = ref('success')
    const showToast = ref(false)

    let clockInterval = null

    function startClock() {
        clockInterval = setInterval(() => { headerTime.value = getCurrentTime() }, 1000)
    }

    function stopClock() {
        if (clockInterval) clearInterval(clockInterval)
    }

    function showToastMessage(message, type = 'success') {
        toastMessage.value = message
        toastType.value = type
        showToast.value = true
        setTimeout(() => { showToast.value = false }, 2500)
    }

    async function handleLogin() {
        const account = loginForm.value.email.trim()
        const { password } = loginForm.value
        if (!account || !password) {
            showToastMessage('请输入账号和密码', 'error')
            return
        }
        loading.value = true
        try {
            let email = account
            if (!account.includes('@')) {
                const profile = await getProfileByUsername(account)
                if (!profile) {
                    showToastMessage('用户名不存在', 'error')
                    return
                }
                if (!profile.email) {
                    showToastMessage('该账号未绑定邮箱，请直接用邮箱登录', 'error')
                    return
                }
                email = profile.email
            }
            const { data, error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) throw error
            await loadUserProfile(data.user)
        } catch (e) {
            showToastMessage(e.message === 'Invalid login credentials' ? '账号或密码错误' : e.message, 'error')
            loginForm.value.password = ''
        } finally {
            loading.value = false
        }
    }

    async function handleRegister(registrationOpen) {
        const { email, password, username, name } = registerForm.value
        if (!email || !password || !username || !name) {
            showToastMessage('请填写完整信息', 'error')
            return
        }
        if (!registrationOpen) {
            showToastMessage('当前不开放注册', 'error')
            return
        }
        if (!/^[a-zA-Z0-9_]{2,20}$/.test(username)) {
            showToastMessage('用户名仅支持字母、数字、下划线，2-20位', 'error')
            return
        }
        loading.value = true
        try {
            const existing = await getUserByUsername(username)
            if (existing) {
                showToastMessage('用户名已被占用，请换一个', 'error')
                loading.value = false
                return
            }
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { name, username } }
            })
            if (error) throw error
            if (data.user) {
                showToastMessage('注册成功，请登录')
                isRegisterMode.value = false
                loginForm.value = { email, password: '' }
            } else {
                showToastMessage('注册成功，请检查邮箱确认')
                isRegisterMode.value = false
            }
        } catch (e) {
            showToastMessage(e.message, 'error')
        } finally {
            loading.value = false
        }
    }

    async function handleLogout() {
        await supabase.auth.signOut()
        currentUser.value = null
        isLoggedIn.value = false
        isLoginPage.value = true
        showToastMessage('已退出登录')
    }

    async function loadUserProfile(authUser, afterLoginCallback) {
        // 尝试获取 profile
        let { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single()
        
        // profile 不存在时自动从 auth 元数据重建
        if (!profile) {
            const meta = authUser.user_metadata || {}
            const username = meta.username || authUser.email?.split('@')[0] || 'user'
            const name = meta.name || '用户'
            try {
                // 只有系统里没有其他用户时，才给 SUPER_ADMIN
                const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
                const level = count === 0 ? 3 : 1
                const newProfile = await addUser({
                    id: authUser.id,
                    username,
                    name,
                    email: authUser.email,
                    avatar: '👤',
                    level
                })
                profile = newProfile
                showToastMessage('已自动修复账号数据')
            } catch (e) {
                showToastMessage('账号数据异常，请联系管理员', 'error')
                console.error('自动创建 profile 失败:', e)
                return
            }
        }
        
        currentUser.value = { ...authUser, ...profile }
        isLoggedIn.value = true
        isLoginPage.value = false
        showToastMessage(`欢迎回来，${profile.name}`)
        if (afterLoginCallback) await afterLoginCallback()
    }

    async function initAuth(afterLoginCallback) {
        try {
            const user = await restoreSession()
            if (user) {
                currentUser.value = user
                isLoggedIn.value = true
                isLoginPage.value = false
                if (afterLoginCallback) await afterLoginCallback()
            }
        } catch { /* 网络异常，以访客身份进入 */ }
        appReady.value = true
    }

    function resetAfterLogout() {
        return { selectedContent: null, allContents: [], contentImagesMap: {} }
    }

    return {
        currentUser, isLoggedIn, loading, isLoginPage, appReady,
        loginForm, registerForm, isRegisterMode, headerTime,
        toastMessage, toastType, showToast,
        startClock, stopClock, showToastMessage,
        handleLogin, handleRegister, handleLogout,
        loadUserProfile, initAuth, resetAfterLogout
    }
}

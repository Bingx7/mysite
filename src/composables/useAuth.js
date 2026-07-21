import { ref } from 'vue'
import { supabase } from '../supabase'
import { restoreSession, getUserByUsername, getEmailByUsername } from '../data'
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
                email = await getEmailByUsername(account)
                if (!email) {
                    showToastMessage('用户名不存在', 'error')
                    return
                }
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
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single()
        if (profile) {
            currentUser.value = { ...authUser, ...profile }
            isLoggedIn.value = true
            isLoginPage.value = false
            showToastMessage(`欢迎回来，${profile.name}`)
            if (afterLoginCallback) await afterLoginCallback()
        }
    }

    async function initAuth(afterLoginCallback) {
        const user = await restoreSession()
        if (user) {
            currentUser.value = user
            isLoggedIn.value = true
            isLoginPage.value = false
            if (afterLoginCallback) await afterLoginCallback()
        }
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

<script setup>
import { computed, ref, watch } from 'vue'
import { CONFIG } from '../config'

const props = defineProps({
    loginForm: Object,
    registerForm: Object,
    isRegisterMode: Boolean,
    loading: Boolean,
    registrationOpen: Boolean
})
const emit = defineEmits(['login', 'register', 'switchMode', 'browseAsGuest', 'update:loginForm', 'update:registerForm'])
const showPassword = ref(false)
const registering = computed(() => props.isRegisterMode && props.registrationOpen)
watch(registering, () => { showPassword.value = false })
function submit() { if (!props.loading) emit(registering.value ? 'register' : 'login') }
function updateLogin(key, value) { emit('update:loginForm', { ...props.loginForm, [key]: value }) }
function updateRegister(key, value) { emit('update:registerForm', { ...props.registerForm, [key]: value }) }
</script>

<template>
    <main class="login-page">
        <div class="auth-shell">
            <header class="auth-brand">
                <div class="brand-name">
                    <svg width="30" height="30" viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect width="28" height="28" rx="7" fill="var(--btn-primary-bg)" /><path d="M8 7h8l4 4v10H8z M16 7v5h4 M11 15h6 M11 18h4" stroke="var(--btn-primary-text)" stroke-width="1.2" stroke-linejoin="round" /></svg>
                    <span>{{ CONFIG.siteName }}</span>
                </div>
                <span class="brand-note">一方小站，一点日常。</span>
            </header>

            <div class="auth-layout">
                <section class="welcome-panel" aria-label="欢迎来到小站">
                    <p class="welcome-kicker"><span aria-hidden="true">✳</span> 生活的片段</p>
                    <h2>把日常，<br><span>慢慢珍藏。</span></h2>
                    <p class="welcome-description">写下心绪，收好照片。<br>让值得记住的片刻，有处可寻。</p>
                    <div class="welcome-art" aria-hidden="true">
                        <svg viewBox="0 0 360 252" fill="none">
                            <circle cx="181" cy="130" r="108" stroke="currentColor" stroke-opacity=".13" stroke-dasharray="2 7" />
                            <g transform="rotate(-9 135 122)">
                                <rect x="52" y="42" width="142" height="177" rx="7" fill="var(--surface)" stroke="currentColor" stroke-opacity=".28" />
                                <path d="M76 42v177" stroke="currentColor" stroke-opacity=".22" />
                                <path d="M66 63H56 M66 87H56 M66 111H56 M66 135H56 M66 159H56 M66 183H56" stroke="currentColor" stroke-opacity=".5" stroke-width="2" stroke-linecap="round" />
                                <path d="M92 89h74 M92 105h74 M92 121h48" stroke="currentColor" stroke-opacity=".25" />
                                <path d="M93 170c8-18 16 17 24 0s15 10 24-4" stroke="currentColor" stroke-opacity=".6" stroke-width="1.5" stroke-linecap="round" />
                            </g>
                            <g transform="rotate(8 247 146)">
                                <rect x="163" y="80" width="145" height="145" rx="5" fill="var(--surface)" stroke="currentColor" stroke-opacity=".3" />
                                <rect x="173" y="90" width="125" height="101" rx="2" fill="var(--accent-soft)" />
                                <circle cx="265" cy="115" r="12" fill="currentColor" fill-opacity=".2" />
                                <path d="m173 160 37-35 39 40 23-20 26 28v18H173z" fill="currentColor" fill-opacity=".24" />
                                <path d="m173 177 28-18 40 32h-68z" fill="currentColor" fill-opacity=".18" />
                                <path d="M181 206h54 M274 206h12" stroke="currentColor" stroke-opacity=".3" stroke-linecap="round" />
                            </g>
                            <path d="M291 35v18 M282 44h18 M37 178v10 M32 183h10" stroke="currentColor" stroke-opacity=".6" stroke-linecap="round" />
                            <circle cx="216" cy="28" r="3" fill="currentColor" fill-opacity=".35" />
                        </svg>
                    </div>
                    <div class="welcome-footer"><span>日记</span><i aria-hidden="true"></i><span>文章</span><i aria-hidden="true"></i><span>照片</span><span class="welcome-line" aria-hidden="true"></span></div>
                </section>

                <section class="login-card auth-panel" aria-labelledby="auth-heading">
                    <div class="auth-form-heading">
                        <p class="auth-kicker">{{ registering ? '故事，从这一页开始' : '你的故事，接着写' }}</p>
                        <h1 id="auth-heading">{{ registering ? '创建账号' : '欢迎回来' }}<span class="heading-dot" aria-hidden="true">.</span></h1>
                        <p class="auth-description">{{ registering ? '留一个名字，开始记录自己的日常。' : '登录小站，翻开属于你的新一页。' }}</p>
                    </div>

                    <form class="login-form" :aria-busy="loading" @submit.prevent="submit">
                        <fieldset class="auth-fields" :disabled="loading">
                            <template v-if="!registering">
                                <div class="auth-field">
                                    <label for="login-account">邮箱或用户名</label>
                                    <input id="login-account" name="username" :value="loginForm.email" @input="updateLogin('email', $event.target.value)"
                                        type="text" class="auth-input" placeholder="输入邮箱或用户名" autocomplete="username" autocapitalize="none" :spellcheck="false" required>
                                </div>
                                <div class="auth-field">
                                    <label for="login-password">密码</label>
                                    <div class="password-field">
                                        <input id="login-password" name="password" :value="loginForm.password" @input="updateLogin('password', $event.target.value)"
                                            :type="showPassword ? 'text' : 'password'" class="auth-input" placeholder="输入你的密码" autocomplete="current-password" required>
                                        <button type="button" class="password-toggle" :aria-label="showPassword ? '隐藏密码' : '显示密码'" :aria-pressed="showPassword" aria-controls="login-password" @click="showPassword = !showPassword">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /><path v-if="showPassword" d="m4 3 16 18" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </template>
                            <template v-else>
                                <div class="auth-field">
                                    <label for="register-email">邮箱</label>
                                    <input id="register-email" name="email" :value="registerForm.email" @input="updateRegister('email', $event.target.value)"
                                        type="email" class="auth-input" placeholder="输入常用邮箱" autocomplete="email" autocapitalize="none" :spellcheck="false" required>
                                </div>
                                <div class="auth-field">
                                    <label for="register-username">用户名</label>
                                    <input id="register-username" name="username" :value="registerForm.username" @input="updateRegister('username', $event.target.value)"
                                        type="text" class="auth-input" placeholder="字母、数字或下划线，2–20 位" autocomplete="username" autocapitalize="none" :spellcheck="false" pattern="[a-zA-Z0-9_]{2,20}" maxlength="20" title="用户名使用 2–20 位字母、数字或下划线" required>
                                </div>
                                <div class="auth-field">
                                    <label for="register-password">密码</label>
                                    <div class="password-field">
                                        <input id="register-password" name="password" :value="registerForm.password" @input="updateRegister('password', $event.target.value)"
                                            :type="showPassword ? 'text' : 'password'" class="auth-input" placeholder="设置密码，至少 6 位" autocomplete="new-password" minlength="6" required>
                                        <button type="button" class="password-toggle" :aria-label="showPassword ? '隐藏密码' : '显示密码'" :aria-pressed="showPassword" aria-controls="register-password" @click="showPassword = !showPassword">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /><path v-if="showPassword" d="m4 3 16 18" /></svg>
                                        </button>
                                    </div>
                                </div>
                                <div class="auth-field">
                                    <label for="register-name">昵称</label>
                                    <input id="register-name" name="nickname" :value="registerForm.name" @input="updateRegister('name', $event.target.value)"
                                        type="text" class="auth-input" placeholder="在小站里，怎么称呼你？" autocomplete="nickname" required>
                                </div>
                            </template>
                            <button type="submit" class="auth-submit" :disabled="loading">
                                <span v-if="loading" class="auth-spinner" aria-hidden="true"></span>
                                <span>{{ loading ? (registering ? '注册中…' : '登录中…') : (registering ? '注册' : '登录') }}</span>
                                <svg v-if="!loading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14 M13 6l6 6-6 6" /></svg>
                            </button>
                        </fieldset>
                    </form>

                    <p v-if="registrationOpen" class="auth-switch">
                        {{ registering ? '已经有账号？' : '还没有账号？' }}
                        <button type="button" :disabled="loading" @click="$emit('switchMode', !registering)">{{ registering ? '立即登录' : '立即注册' }}</button>
                    </p>
                    <template v-if="!registering">
                        <div class="auth-divider"><span>或</span></div>
                        <button type="button" class="auth-guest" :disabled="loading" @click="$emit('browseAsGuest')">
                            <span>以访客身份浏览</span><span aria-hidden="true">↗</span>
                        </button>
                        <p class="guest-note">先逛一逛，仅查看公开内容</p>
                    </template>
                </section>
            </div>
            <footer class="auth-footer"><span aria-hidden="true">—</span> 让记录，成为生活的一部分 <span aria-hidden="true">—</span></footer>
        </div>
    </main>
</template>

<style scoped>
/* 柔光和静态纸纹仅用于入口，阅读区保持纯色；纹理不拦截表单操作。 */
.login-page {
    position: relative;
    isolation: isolate;
    min-height: 100vh;
    min-height: 100svh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 32px;
    background:
        radial-gradient(ellipse 65% 65% at 5% 8%, var(--entry-cool), transparent 72%),
        radial-gradient(ellipse 60% 60% at 96% 100%, var(--entry-warm), transparent 72%),
        var(--entry-bg);
}
.login-page::before { content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none; background: url('../assets/paper-grain.svg') repeat; background-size: 160px 160px; opacity: .055; }
.auth-shell { position: relative; z-index: 1; width: 100%; max-width: 1000px; }
.auth-brand { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; padding: 0 2px; }
.brand-name { display: flex; align-items: center; gap: 11px; font-size: 16px; font-weight: 600; letter-spacing: -.02em; color: var(--text); }
.brand-name svg { flex-shrink: 0; }
.brand-note { font-size: 11px; letter-spacing: .08em; color: var(--text-secondary); }
.auth-layout { display: grid; grid-template-columns: 1.04fr 1fr; min-height: 612px; overflow: hidden; border: 1px solid var(--border); border-radius: 18px; background: var(--surface); box-shadow: 0 20px 64px #00000005; }
.welcome-panel { position: relative; display: flex; flex-direction: column; padding: 46px 44px 30px; border-right: 1px solid var(--border); background: linear-gradient(145deg, var(--accent-soft), var(--surface-muted)); overflow: hidden; }
.welcome-panel::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(var(--border) .75px, transparent .75px); background-size: 14px 14px; opacity: .28; pointer-events: none; }
.welcome-panel > * { position: relative; }
.welcome-kicker { display: flex; align-items: center; gap: 10px; font-size: 10px; letter-spacing: .18em; color: var(--text-secondary); }
.welcome-kicker span { font-size: 18px; color: var(--brand-color); }
.welcome-panel h2 { margin-top: 25px; font-size: clamp(32px, 3.5vw, 43px); line-height: 1.45; letter-spacing: -.04em; font-weight: 600; color: var(--text); }
.welcome-panel h2 span { color: color-mix(in srgb, var(--brand-color) 45%, var(--text)); }
.welcome-description { margin-top: 17px; color: var(--text-secondary); font-size: 13px; line-height: 1.9; }
.welcome-art { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 180px; margin: 0 -16px; color: color-mix(in srgb, var(--brand-color) 55%, var(--text)); }
.welcome-art svg { display: block; width: 100%; max-width: 340px; height: auto; }
.welcome-footer { display: flex; align-items: center; gap: 12px; font-size: 11px; letter-spacing: .06em; color: var(--text-secondary); }
.welcome-footer i { width: 3px; height: 3px; border-radius: 50%; background: var(--brand-color); opacity: .5; }
.welcome-line { height: 1px; background: var(--border); flex: 1; margin-left: 12px; }
.auth-panel { padding: 47px 48px 35px; min-width: 0; align-self: center; }
.auth-form-heading { margin-bottom: 30px; }
.auth-kicker { margin-bottom: 12px; font-size: 10px; color: var(--text-secondary); letter-spacing: .12em; }
.auth-form-heading h1 { font-size: 30px; font-weight: 600; letter-spacing: -.035em; line-height: 1.4; color: var(--text); }
.heading-dot { color: var(--brand-color); margin-left: 4px; }
.auth-description { margin-top: 10px; color: var(--text-secondary); font-size: 12px; line-height: 1.7; }
.login-form { width: 100%; }
.auth-fields { display: flex; flex-direction: column; gap: 20px; padding: 0; margin: 0; border: 0; min-width: 0; }
.auth-field label { display: block; margin-bottom: 8px; font-size: 12px; font-weight: 500; color: var(--text); }
.auth-input { width: 100%; min-width: 0; height: 46px; padding: 11px 13px; border: 1px solid var(--border); border-radius: 7px; background: var(--bg); color: var(--text); font-size: 14px; transition: background .2s, border-color .2s, box-shadow .2s; }
.auth-input:hover:not(:disabled) { border-color: color-mix(in srgb, var(--brand-color) 35%, var(--border)); }
.auth-input:focus-visible { outline: none; border-color: var(--brand-color); box-shadow: 0 0 0 3px var(--accent-soft); background: var(--surface); }
.auth-input:disabled { opacity: .6; }
.password-field { position: relative; }
.password-field .auth-input { padding-right: 48px; }
.auth-input::-ms-reveal { display: none; }
.password-toggle { position: absolute; right: 3px; top: 3px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 5px; background: transparent; color: var(--text-secondary); cursor: pointer; }
.password-toggle:hover:not(:disabled) { color: var(--text); background: var(--accent-soft); }
.password-toggle svg { width: 18px; height: 18px; }
.auth-submit { position: relative; display: flex; align-items: center; justify-content: center; gap: 10px; height: 46px; width: 100%; margin-top: 6px; padding: 10px 20px; border: 1px solid transparent; border-radius: 7px; background: var(--btn-primary-bg); color: var(--btn-primary-text); font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 3px 8px #00000008; transition: transform .18s, box-shadow .18s; }
.auth-submit svg { position: absolute; right: 17px; width: 17px; height: 17px; transition: transform .18s; }
.auth-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 15px #00000012; }
.auth-submit:hover:not(:disabled) svg { transform: translateX(3px); }
.auth-submit:disabled { cursor: wait; opacity: .7; }
.auth-spinner { width: 14px; height: 14px; border: 1.5px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: auth-spin .8s linear infinite; }
@keyframes auth-spin { to { transform: rotate(360deg); } }
.auth-switch { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px; margin-top: 16px; font-size: 12px; color: var(--text-secondary); }
.auth-switch button { border: 0; background: transparent; color: var(--text); padding: 6px 2px; font-size: inherit; font-weight: 500; cursor: pointer; text-decoration: underline; text-underline-offset: 4px; text-decoration-color: var(--border); }
.auth-switch button:hover:not(:disabled) { text-decoration-color: var(--brand-color); }
.auth-divider { display: flex; align-items: center; gap: 12px; margin: 20px 0 16px; color: var(--text-secondary); font-size: 10px; }
.auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
.auth-guest { width: 100%; height: 42px; display: flex; align-items: center; justify-content: center; gap: 10px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text-secondary); cursor: pointer; font-size: 12px; transition: background .18s, color .18s; }
.auth-guest:hover:not(:disabled) { background: var(--accent-soft); color: var(--text); }
.guest-note { text-align: center; color: var(--text-secondary); font-size: 10px; margin-top: 10px; }
.auth-footer { display: flex; align-items: center; justify-content: center; gap: 14px; color: var(--text-secondary); font-size: 10px; letter-spacing: .12em; margin-top: 24px; }
.auth-footer span { opacity: .45; }
@media (max-width: 900px) {
    .welcome-panel { padding: 36px 30px 28px; }
    .auth-panel { padding: 38px 32px 32px; }
    .auth-layout { min-height: 590px; }
}
@media (max-width: 720px) {
    .login-page { padding: 30px 20px; align-items: flex-start; }
    .auth-shell { max-width: 440px; margin: auto; }
    .auth-brand { margin-bottom: 22px; }
    .brand-note { font-size: 10px; letter-spacing: 0; }
    .auth-layout { display: block; min-height: 0; border-radius: 14px; }
    .welcome-panel { display: none; }
    .auth-panel { padding: 30px 28px 26px; }
    .auth-form-heading { margin-bottom: 26px; }
    .auth-form-heading h1 { font-size: 29px; }
    .auth-input { font-size: 16px; height: 48px; }
    .password-toggle { top: 4px; }
    .auth-footer { font-size: 9px; margin-top: 22px; }
}
@media (max-width: 360px) {
    .login-page { padding: 22px 16px; }
    .auth-panel { padding: 26px 20px 24px; }
    .brand-note { display: none; }
    .auth-input { padding-left: 10px; }
}
</style>

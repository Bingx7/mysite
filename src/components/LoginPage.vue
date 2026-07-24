<script setup>
import { CONFIG } from '../config'

const props = defineProps({
    loginForm: Object,
    registerForm: Object,
    isRegisterMode: Boolean,
    loading: Boolean,
    registrationOpen: Boolean
})

const emit = defineEmits(['login', 'register', 'switchMode', 'browseAsGuest', 'update:loginForm', 'update:registerForm'])
</script>

<template>
    <div class="login-page">
        <div class="login-card">
            <div class="login-logo">📔</div>
            <div class="login-title">{{ CONFIG.siteName }}</div>
            <div class="login-subtitle">{{ isRegisterMode ? '创建新账号' : '欢迎回来' }}</div>

            <form v-if="!isRegisterMode" @submit.prevent="$emit('login')" class="login-form">
                <div class="form-group">
                    <label class="form-label">邮箱或用户名</label>
                    <input
                        :value="loginForm.email"
                        @input="$emit('update:loginForm', { ...loginForm, email: $event.target.value })"
                        type="text" class="form-input" placeholder="邮箱或用户名" required>
                </div>
                <div class="form-group">
                    <label class="form-label">密码</label>
                    <input
                        :value="loginForm.password"
                        @input="$emit('update:loginForm', { ...loginForm, password: $event.target.value })"
                        type="password" class="form-input" placeholder="请输入密码" required>
                </div>
                <button type="submit" class="btn btn-primary btn-full" :disabled="loading">
                    {{ loading ? '登录中...' : '登录' }}
                </button>
                <div v-if="registrationOpen" class="login-switch">
                    还没有账号？<span @click="$emit('switchMode', true)" class="link">立即注册</span>
                </div>
                <div class="login-guest">
                    <span @click="$emit('browseAsGuest')" class="link">以访客身份浏览</span>
                </div>
            </form>

            <form v-else @submit.prevent="$emit('register')" class="login-form">
                <div class="form-group">
                    <label class="form-label">邮箱</label>
                    <input
                        :value="registerForm.email"
                        @input="$emit('update:registerForm', { ...registerForm, email: $event.target.value })"
                        type="email" class="form-input" placeholder="请输入邮箱" required>
                </div>
                <div class="form-group">
                    <label class="form-label">用户名</label>
                    <input
                        :value="registerForm.username"
                        @input="$emit('update:registerForm', { ...registerForm, username: $event.target.value })"
                        type="text" class="form-input" placeholder="字母、数字、下划线，2-20位" required>
                </div>
                <div class="form-group">
                    <label class="form-label">密码</label>
                    <input
                        :value="registerForm.password"
                        @input="$emit('update:registerForm', { ...registerForm, password: $event.target.value })"
                        type="password" class="form-input" placeholder="请输入密码（至少6位）" required>
                </div>
                <div class="form-group">
                    <label class="form-label">昵称</label>
                    <input
                        :value="registerForm.name"
                        @input="$emit('update:registerForm', { ...registerForm, name: $event.target.value })"
                        type="text" class="form-input" placeholder="请输入昵称" required>
                </div>
                <button type="submit" class="btn btn-primary btn-full" :disabled="loading">
                    {{ loading ? '注册中...' : '注册' }}
                </button>
                <div class="login-switch">
                    已有账号？<span @click="$emit('switchMode', false)" class="link">立即登录</span>
                </div>
            </form>
        </div>
    </div>
</template>

<style scoped>
.login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.login-card {
    background-color: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(20px);
    border-radius: 16px;
    padding: 48px;
    width: 100%;
    max-width: 420px;
    text-align: center;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.login-logo { font-size: 56px; margin-bottom: 20px; }

.login-title {
    font-size: 28px; font-weight: 700;
    color: var(--text-color, #2D3436); margin-bottom: 10px;
}

.login-subtitle {
    font-size: 15px; color: var(--text-secondary-color, #636E72); margin-bottom: 36px;
}

.login-form { display: flex; flex-direction: column; gap: 24px; }

.form-group { text-align: left; }

.form-label {
    display: block; font-size: 14px; font-weight: 500;
    color: var(--text-color, #2D3436); margin-bottom: 10px;
}

.form-input {
    width: 100%; padding: 14px 16px;
    border: 1px solid var(--border-color, #E8E7E4); border-radius: 10px;
    font-size: 15px; background-color: rgba(255, 255, 255, 0.7);
    color: var(--text-color, #2D3436); transition: border-color 0.2s;
}

.form-input:focus { outline: none; border-color: var(--brand-color, #4A5C6B); }

.btn {
    padding: 12px 24px; border-radius: 10px; border: none;
    font-size: 15px; font-weight: 500; cursor: pointer; transition: opacity 0.2s;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }


.login-switch, .login-guest { font-size: 14px; color: var(--text-secondary-color, #636E72); }

.link { color: var(--brand-color, #4A5C6B); cursor: pointer; font-weight: 500; }
</style>

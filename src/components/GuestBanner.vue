<script setup>
defineEmits(['login'])
</script>

<template>
    <div class="guest-banner">
        <div class="banner-content">
            <span class="banner-icon">👀</span>
            <span class="banner-text">你正在以访客身份浏览，仅能看到公开内容。</span>
            <button class="banner-btn" @click="$emit('login')">登录查看更多</button>
        </div>
    </div>
</template>

<style scoped>
.guest-banner {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
    border: 1px solid var(--border-color, #E8E7E4);
    border-radius: 12px;
    margin-bottom: 24px;
    padding: 14px 20px;
}

.banner-content {
    display: flex; align-items: center; gap: 12px;
    font-size: 14px; color: var(--text-secondary-color, #636E72);
    flex-wrap: wrap;
}

.banner-icon { font-size: 18px; }

.banner-text { flex: 1; min-width: 200px; }

.banner-btn {
    background: var(--brand-color, #4A5C6B);
    color: white; border: none;
    padding: 8px 18px; border-radius: 8px;
    font-size: 13px; font-weight: 500; cursor: pointer;
    transition: opacity 0.2s; white-space: nowrap;
}
.banner-btn:hover { opacity: 0.9; }
</style>

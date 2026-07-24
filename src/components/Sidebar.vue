<script setup>
import { CONFIG, CONTENT_TYPE } from '../config'
import { getContentTypeLabel } from '../utils'

const props = defineProps({
    currentUser: Object,
    currentTab: String,
    isSidebarOpen: Boolean,
    isSuperAdmin: Boolean
})

const emit = defineEmits(['switchTab', 'closeSidebar', 'logout', 'create', 'admin'])
</script>

<template>
    <!-- 移动端遮罩 -->
    <div :class="['sidebar-overlay', { open: isSidebarOpen }]" @click="$emit('closeSidebar')"></div>

    <div :class="['sidebar', { open: isSidebarOpen }]">
        <div class="sidebar-header">
            <div class="sidebar-logo">{{ CONFIG.siteName }}</div>
        </div>
        <div v-if="currentUser" class="sidebar-user">
            <div class="user-avatar">{{ currentUser.avatar || '👤' }}</div>
            <div class="user-name">{{ currentUser.name }}</div>
        </div>
        <ul class="sidebar-nav">
            <li v-for="tab in ['all', CONTENT_TYPE.DIARY, CONTENT_TYPE.ARTICLE, CONTENT_TYPE.ALBUM]" :key="tab" class="nav-item">
                <div :class="['nav-link', { active: currentTab === tab }]" @click="$emit('switchTab', tab)">
                    <span class="nav-icon">{{ tab === 'all' ? '📋' : tab === CONTENT_TYPE.DIARY ? '📝' : tab === CONTENT_TYPE.ARTICLE ? '📄' : '🖼️' }}</span>
                    <span>{{ getContentTypeLabel(tab) }}</span>
                </div>
            </li>
        </ul>
        <div class="sidebar-bottom">
            <button v-if="currentUser" class="sidebar-btn sidebar-btn-primary" @click="$emit('create')">+ 新建</button>
            <button v-if="isSuperAdmin" class="sidebar-btn sidebar-btn-primary" @click="$emit('admin')" style="background:var(--warning);margin-top:8px;">⚙ 后台管理</button>
            <button v-if="currentUser" class="sidebar-btn sidebar-btn-secondary" @click="$emit('logout')">退出登录</button>
        </div>
    </div>
</template>

<style scoped>
/* 移动端遮罩 */
.sidebar-overlay {
    display: none;
    position: fixed; top: 60px; left: 0; right: 0; bottom: 0;
    background-color: rgba(0, 0, 0, 0.3); z-index: 80;
    opacity: 0; visibility: hidden; transition: all 0.3s ease;
}

/* 侧边栏 */
.sidebar {
    position: fixed; left: 0; top: 60px; bottom: 0; width: 260px;
    background-color: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    border-right: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.06);
    padding: 24px 16px; z-index: 90;
    display: flex; flex-direction: column;
    transform: translateX(-100%); opacity: 0; visibility: hidden;
    transition: all 0.3s ease;
}

/* 移动端打开状态 */
@media (max-width: 1023px) {
    .sidebar-overlay { display: block; }
    .sidebar-overlay.open { opacity: 1; visibility: visible; }
    .sidebar.open { transform: translateX(0); opacity: 1; visibility: visible; }
}

/* 桌面端常驻 */
@media (min-width: 1024px) {
    .sidebar {
        transform: translateX(0); opacity: 1; visibility: visible;
        transition: none;
    }
    .sidebar-overlay { display: none !important; }
}

.sidebar-header { margin-bottom: 28px; }
.sidebar-logo { font-size: 18px; font-weight: 700; color: var(--brand-color, #4A5C6B); }

.sidebar-user {
    display: flex; align-items: center; gap: 14px; padding: 16px;
    background-color: rgba(74, 92, 107, 0.06); border-radius: 12px; margin-bottom: 28px;
}
.user-avatar { width: 44px; height: 44px; border-radius: 50%; background-color: rgba(74, 92, 107, 0.15); display: flex; align-items: center; justify-content: center; font-size: 20px; }
.user-name { font-size: 15px; font-weight: 600; color: var(--text-color, #2D3436); }

.sidebar-nav { list-style: none; padding: 0; margin: 0; flex: 1; }
.nav-item { margin-bottom: 4px; }
.nav-link {
    display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: 10px;
    cursor: pointer; transition: all 0.2s; font-size: 15px; color: var(--text-secondary-color, #636E72);
    border: 1px solid transparent;
}
.nav-link:hover { background-color: rgba(0, 0, 0, 0.04); color: var(--text-color, #2D3436); }
.nav-link.active {
    background-color: rgba(74, 92, 107, 0.12); color: var(--brand-color, #4A5C6B);
    font-weight: 600; border: 1px solid rgba(74, 92, 107, 0.2);
}
.nav-icon { font-size: 18px; }

.sidebar-bottom {
    padding-top: 16px; border-top: 1px solid var(--border-color, #E8E7E4);
    display: flex; flex-direction: column; gap: 10px;
}
.sidebar-btn {
    width: 100%; padding: 14px; border-radius: 10px; border: none;
    font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity 0.2s;
}
.sidebar-btn-primary { background-color: var(--btn-primary-bg); color: var(--btn-primary-text); }
.sidebar-btn-secondary { background-color: transparent; color: var(--btn-secondary-text); }

/* 桌面端内容区缩进（由 App.vue 的 .content 配合） */
</style>

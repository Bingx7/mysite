<script setup>
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import { LEVEL, CONTENT_TYPE } from './config';
import { loadTheme, getTheme, setTheme, resetTheme } from './theme';
import { useAuth } from './composables/useAuth';
import { useContents } from './composables/useContents';

import LoginPage from './components/LoginPage.vue';
import Sidebar from './components/Sidebar.vue';
import ContentList from './components/ContentList.vue';
import ContentDetail from './components/ContentDetail.vue';
import ContentModal from './components/ContentModal.vue';
import SettingsModal from './components/SettingsModal.vue';
import SkeletonCard from './components/SkeletonCard.vue';
import GuestBanner from './components/GuestBanner.vue';

const AdminPanel = defineAsyncComponent(() => import('./admin/Admin.vue'));

/* ===== Composables ===== */
const auth = useAuth();
const {
    currentUser, isLoggedIn, loading, isLoginPage, appReady,
    loginForm, registerForm, isRegisterMode, headerTime,
    toastMessage, toastType, showToast,
    startClock, stopClock, showToastMessage,
    handleLogin, handleLogout, initAuth
} = auth;

const contents = useContents();
const {
    allContents, contentImagesMap, authorsMap, contentLoading, selectedContent, selectedContentImages,
    currentTab, sysSettings, folderColors,
    isModalOpen, modalMode, formImages, formCaptions,
    formTitle, formBody, formDescription, formVisibility,
    formStartDate, formEndDate,
    loadContents, loadSystemSettings, switchTab,
    openCreateModal, openEditModal, hasUnsavedContent, closeModal,
    handleFileUpload, removeImage, handleSaveContent,
    handleDeleteContent, selectContent, goBack
} = contents;

/* ===== 本地 UI 状态 ===== */
const isSettingsOpen = ref(false);
const isSidebarOpen = ref(false);
const showAdmin = ref(false);

/* ===== 计算属性 ===== */
const theme = computed(() => getTheme());
const registrationOpen = computed(() => sysSettings.value.registration_open);
const isSuperAdmin = computed(() => currentUser.value?.level === LEVEL.SUPER_ADMIN);

/* ===== 认证 ===== */
async function onLogin() {
    await handleLogin();
    if (isLoggedIn.value) {
        selectedContent.value = null;
        allContents.value = [];
        contentImagesMap.value = {};
        await loadContents(currentUser.value);
        await loadSystemSettings();
    }
}

async function onBrowseAsGuest() {
    isLoginPage.value = false;
    await loadContents(null);
    await loadSystemSettings();
}

async function onRegister() {
    await auth.handleRegister(registrationOpen.value);
}

async function onLogout() {
    await handleLogout();
    selectedContent.value = null;
    allContents.value = [];
    contentImagesMap.value = {};
    isSidebarOpen.value = false;
}

/* ===== 内容操作 ===== */
async function onSwitchTab(tab) {
    switchTab(tab);
    await loadContents(currentUser.value);
}

async function onSelectContent(content) {
    await selectContent(content);
}

async function onSaveContent() {
    const success = await handleSaveContent(currentUser.value, showToastMessage);
    if (success) await loadContents(currentUser.value);
}

async function onDeleteContent(content) {
    if (!confirm('确定要删除吗？')) return;
    const success = await handleDeleteContent(content, showToastMessage, currentUser.value);
    if (success) {
        selectedContent.value = null;
        await loadContents(currentUser.value);
    }
}

function onCloseModal() {
    if (hasUnsavedContent() && !confirm('有未保存的内容，确定放弃吗？')) return;
    closeModal();
}

/* ===== 其他 ===== */
function toggleSidebar() { isSidebarOpen.value = !isSidebarOpen.value; }
function closeSidebar() { isSidebarOpen.value = false; }
function openSettings() { isSettingsOpen.value = true; }
function closeSettings() { isSettingsOpen.value = false; }
function handleThemeChange(key, value) { setTheme({ [key]: value }); }
function handleResetTheme() { resetTheme(); showToastMessage('已重置为默认主题'); }

/* ===== 初始化 ===== */
onMounted(async () => {
    loadTheme();
    startClock();
    await initAuth(async () => {
        await loadContents(currentUser.value);
        await loadSystemSettings();
    });
});

watch(currentTab, async () => {
    if (isLoggedIn.value) await loadContents(currentUser.value);
});

onUnmounted(() => { stopClock(); });
</script>

<template>
    <div class="app-container">
        <!-- Toast -->
        <div v-if="showToast" :class="['toast', `toast-${toastType}`]">{{ toastMessage }}</div>

        <template v-if="appReady">
            <LoginPage
                v-if="isLoginPage"
                :loginForm="loginForm"
                :registerForm="registerForm"
                :isRegisterMode="isRegisterMode"
                :loading="loading"
                :registrationOpen="registrationOpen"
                @login="onLogin"
                @register="onRegister"
                @switchMode="isRegisterMode = $event"
                @browseAsGuest="onBrowseAsGuest"
                @update:loginForm="loginForm = $event"
                @update:registerForm="registerForm = $event"
            />

            <!-- 主页面 -->
            <div v-else class="main-page">
                <AdminPanel v-if="showAdmin" @close="showAdmin = false" :currentUser="currentUser" />

                <template v-else>
                    <!-- 导航栏 -->
                    <header class="header">
                        <div class="header-content">
                            <div class="header-left">
                                <button class="menu-btn" @click="toggleSidebar">☰</button>
                                <span class="logo">{{ isLoggedIn && currentUser ? currentUser.name + ' 的小站' : '我的小站' }}</span>
                            </div>
                            <div class="header-actions">
                                <button v-if="isSuperAdmin" class="header-btn admin-entry-btn" @click="showAdmin = true" title="后台管理">⚙</button>
                                <button class="header-btn" @click="openSettings" title="外观设置">🎨</button>
                                <span class="header-time">{{ headerTime }}</span>
                            </div>
                        </div>
                    </header>

                    <!-- 侧边栏 -->
                    <Sidebar
                        :currentUser="currentUser"
                        :currentTab="currentTab"
                        :isSidebarOpen="isSidebarOpen"
                        :isSuperAdmin="isSuperAdmin"
                        @switchTab="onSwitchTab"
                        @closeSidebar="closeSidebar"
                        @logout="onLogout"
                        @create="openCreateModal"
                        @admin="showAdmin = true"
                    />

                    <!-- 内容区 -->
                    <div class="content">
                        <!-- 访客引导横幅 -->
                        <GuestBanner v-if="!isLoggedIn" @login="isLoginPage = true" />

                        <ContentDetail
                            v-if="selectedContent"
                            :content="selectedContent"
                            :images="selectedContentImages"
                            :currentUser="currentUser"
                            :isLoggedIn="isLoggedIn"
                            :author="authorsMap[selectedContent.author_id]"
                            @back="goBack"
                            @edit="openEditModal"
                            @delete="onDeleteContent"
                        />

                        <div v-else-if="contentLoading">
                            <SkeletonCard :count="6" />
                        </div>

                        <ContentList
                            v-else
                            :contents="allContents"
                            :imagesMap="contentImagesMap"
                            :authorsMap="authorsMap"
                            :currentTab="currentTab"
                            :folderColors="folderColors"
                            @select="onSelectContent"
                        />
                    </div>

                    <!-- FAB -->
                    <button v-if="currentUser && !selectedContent" class="fab" @click="openCreateModal">+</button>
                </template>
            </div>

            <!-- 发布/编辑弹窗 -->
            <ContentModal
                :isOpen="isModalOpen"
                :mode="modalMode"
                :currentTab="currentTab"
                :formTitle="formTitle"
                :formBody="formBody"
                :formDescription="formDescription"
                :formVisibility="formVisibility"
                :formStartDate="formStartDate"
                :formEndDate="formEndDate"
                :formImages="formImages"
                :formCaptions="formCaptions"
                @close="onCloseModal"
                @save="onSaveContent"
                @update:formTitle="formTitle = $event"
                @update:formBody="formBody = $event"
                @update:formDescription="formDescription = $event"
                @update:formVisibility="formVisibility = $event"
                @update:formStartDate="formStartDate = $event"
                @update:formEndDate="formEndDate = $event"
                @fileUpload="handleFileUpload"
                @removeImage="removeImage"
            />

            <!-- 设置弹窗 -->
            <SettingsModal
                :isOpen="isSettingsOpen"
                :theme="theme"
                @close="closeSettings"
                @change="handleThemeChange"
                @reset="handleResetTheme"
            />
        </template>
        <div v-else class="app-loading">
            <div class="app-loading-spinner"></div>
            <p class="app-loading-text">加载中...</p>
        </div>
    </div>
</template>

<style scoped>
.app-container {
    min-height: 100vh;
    background-color: transparent;
    position: relative;
}

/* Loading */
.app-loading {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    min-height: 100vh; gap: 20px;
}

.app-loading-spinner {
    width: 32px; height: 32px;
    border: 3px solid #E8E7E4;
    border-top-color: var(--brand-color, #4A5C6B);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.app-loading-text {
    font-size: 14px; color: #6B6A67; margin: 0;
}

/* Toast */
.toast {
    position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
    padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;
    z-index: 1000; animation: fadeIn 0.2s ease;
}
.toast-success { background-color: rgba(16, 185, 129, 0.9); color: white; }
.toast-error { background-color: rgba(239, 68, 68, 0.9); color: white; }

@keyframes fadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* 主页面 */
.main-page { min-height: 100vh; }

/* Header */
.header {
    background-color: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    position: sticky; top: 0; z-index: 100;
}
.header-content {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 24px;
}
.header-left { display: flex; align-items: center; gap: 14px; }
.menu-btn {
    color: var(--brand-color, #4A5C6B); font-size: 22px;
    width: 44px; height: 44px; border-radius: 10px;
    transition: background-color 0.2s; background: none; border: none;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.menu-btn:hover { background-color: rgba(74, 92, 107, 0.1); }
.logo {
    font-size: 20px; font-weight: 700; color: var(--brand-color, #4A5C6B);
    letter-spacing: -0.02em;
}
.header-actions { display: flex; align-items: center; gap: 20px; }
.header-btn {
    background: none; border: none; font-size: 20px; cursor: pointer;
    padding: 8px; border-radius: 8px; transition: background-color 0.2s;
}
.header-btn:hover { background-color: rgba(0, 0, 0, 0.05); }
.admin-entry-btn { font-size: 17px; color: var(--brand-color, #4A5C6B); }
.header-time {
    font-size: 15px; font-weight: 500; color: var(--brand-color, #4A5C6B);
    letter-spacing: 1px; font-variant-numeric: tabular-nums;
}

/* 内容区 */
.content {
    flex: 1; min-width: 0; padding: 32px; max-width: 1200px;
}

@media (min-width: 1024px) {
    .content { margin-left: 260px; }
}

/* FAB */
.fab {
    position: fixed; bottom: 40px; right: 40px;
    width: 64px; height: 64px; border-radius: 50%;
    background-color: var(--brand-color, #4A5C6B);
    color: white; font-size: 28px; border: none; cursor: pointer;
    box-shadow: 0 5px 20px rgba(74, 92, 107, 0.35);
    transition: transform 0.3s; z-index: 50;
}
.fab:hover { transform: scale(1.1); }

@media (max-width: 768px) {
    .content { padding: 20px; max-width: 100%; }
}

@media (max-width: 480px) {
    .header-content { padding: 10px 16px; }
    .logo { font-size: 18px; }
    .header-time { font-size: 14px; }
    .content { padding: 16px; }
}
</style>

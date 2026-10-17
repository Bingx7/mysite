<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted, defineAsyncComponent, watch } from 'vue';
import { LEVEL, CONTENT_TYPE } from './config';
import { getContentTypeLabel } from './utils';
import { loadTheme, getTheme, setTheme, resetTheme } from './theme';
import { useAuth } from './composables/useAuth';
import { useContents } from './composables/useContents';

import LoginPage from './components/LoginPage.vue';
import Sidebar from './components/Sidebar.vue';
import ContentList from './components/ContentList.vue';
import ContentDetail from './components/ContentDetail.vue';
import AsyncPanelStatus from './components/AsyncPanelStatus.vue';
import GuestBanner from './components/GuestBanner.vue';

const AdminPanel = defineAsyncComponent(() => import('./admin/Admin.vue'));
const lazyPanel = loader => defineAsyncComponent({ loader, loadingComponent: AsyncPanelStatus, errorComponent: AsyncPanelStatus, delay: 150, timeout: 15000 });
const ContentModal = lazyPanel(() => import('./components/ContentModal.vue'));
const SettingsModal = lazyPanel(() => import('./components/SettingsModal.vue'));

/* ===== Composables ===== */
const auth = useAuth();
const {
    currentUser, isLoggedIn, loading, isLoginPage, appReady,
    loginForm, registerForm, isRegisterMode,
    toastMessage, toastType, showToast,
    showToastMessage,
    handleLogin, handleLogout, initAuth
} = auth;

const contents = useContents();
const {
    allContents, contentImagesMap, authorsMap, contentLoading, selectedContent, selectedContentImages,
    currentTab, sysSettings,
    currentPage, pageSize, searchQuery, totalContents, contentError, imagesLoading, imagesError,
    detailImagesLoading, detailImagesError, retryImages,
    resetContentState, prepareListChange,
    isModalOpen, modalMode, formImages, formCaptions,
    formTitle, formBody, formDescription, formVisibility,
    formStartDate, formEndDate, formType,
    saving, uploading, modalBusy, uploadProgress, moveImage, setCover,
    loadContents, loadSystemSettings, switchTab,
    openCreateModal, openEditModal, hasUnsavedContent, closeModal,
    handleFileUpload, removeImage, handleSaveContent,
    handleDeleteContent, selectContent, goBack
} = contents;

/* ===== 本地 UI 状态 ===== */
const isSettingsOpen = ref(false);
const accountMenu = ref(null);
const showAdmin = ref(false);
let listScrollPosition = 0;
let selectedListTrigger = null;
let searchTimer = null;
watch(() => [currentUser.value?.id, currentUser.value?.level], () => {
    clearTimeout(searchTimer);
    listScrollPosition = 0;
    selectedListTrigger = null;
    resetContentState();
}, { flush: 'sync' });

/* ===== 计算属性 ===== */
const theme = computed(() => getTheme());
const tabTitle = computed(() => currentTab.value === 'all' ? '全部记录' : getContentTypeLabel(currentTab.value));
const tabDescription = computed(() => ({ all: '把日常、想法和照片，慢慢留在这里。', diary: '记录平常日子里的细小感受。', article: '一些想法，一些值得留下的文字。', album: '用照片收藏走过的地方和时光。' }[currentTab.value]));
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
        void loadSystemSettings();
    }
}

async function onBrowseAsGuest() {
    isLoginPage.value = false;
    await loadContents(null);
    void loadSystemSettings();
}

async function onRegister() {
    await auth.handleRegister(registrationOpen.value);
}

async function onLogout() {
    if (modalBusy.value) return;
    clearTimeout(searchTimer);
    resetContentState();
    isSettingsOpen.value = false;
    showAdmin.value = false;
    await handleLogout();
    selectedContent.value = null;
    allContents.value = [];
    contentImagesMap.value = {};
    closeAccountMenu();
}

/* ===== 内容操作 ===== */
async function onSwitchTab(tab) {
    clearTimeout(searchTimer);
    listScrollPosition = 0;
    selectedListTrigger = null;
    switchTab(tab);
    await loadContents(currentUser.value);
}

async function onSearch(value) {
    searchQuery.value = value;
    currentPage.value = 1;
    clearTimeout(searchTimer);
    prepareListChange();
    searchTimer = setTimeout(() => { void loadContents(currentUser.value); }, value.trim() ? 250 : 0);
}

async function onPage(page) {
    clearTimeout(searchTimer);
    currentPage.value = page;
    await loadContents(currentUser.value);
    window.scrollTo({ top: 0, behavior: 'instant' });
}

async function onAdminRefresh() {
    await Promise.all([loadContents(currentUser.value, { force: true }), loadSystemSettings({ force: true })]);
}

async function onSelectContent(content, trigger) {
    listScrollPosition = window.scrollY;
    selectedListTrigger = trigger;
    void selectContent(content);
    await nextTick();
    window.scrollTo({ top: 0, behavior: 'instant' });
}

async function onBackToList() {
    goBack();
    await nextTick();
    window.scrollTo({ top: listScrollPosition, behavior: 'instant' });
    if (selectedListTrigger?.isConnected) selectedListTrigger.focus({ preventScroll: true });
}

async function onSaveContent() {
    const success = await handleSaveContent(currentUser.value, showToastMessage);
    if (success) await loadContents(currentUser.value, { force: true });
}

async function onDeleteContent(content) {
    if (!confirm('确定要删除吗？')) return;
    const success = await handleDeleteContent(content, showToastMessage, currentUser.value);
    if (success) {
        selectedContent.value = null;
        await loadContents(currentUser.value, { force: true });
    }
}

async function onCloseModal() {
    if (modalBusy.value) return;
    if (hasUnsavedContent() && !confirm('有未保存的内容，确定放弃吗？')) return;
    await closeModal();
}

async function onFileUpload(event) {
    await handleFileUpload(event, showToastMessage);
}

/* ===== 其他 ===== */
function closeAccountMenu() { accountMenu.value?.removeAttribute('open'); }
function onOutsideClick(event) { if (accountMenu.value && !accountMenu.value.contains(event.target)) closeAccountMenu(); }
function openSettings() { closeAccountMenu(); isSettingsOpen.value = true; }
function openAdmin() { closeAccountMenu(); showAdmin.value = true; }
function closeSettings() { isSettingsOpen.value = false; }
function handleThemeChange(key, value) { setTheme({ [key]: value }); }
function handleResetTheme() { resetTheme(); showToastMessage('已重置为默认主题'); }

/* ===== 初始化 ===== */
function preventBusyLeave(event) {
    if (modalBusy.value) { event.preventDefault(); event.returnValue = ''; }
}
onMounted(async () => {
    window.addEventListener('beforeunload', preventBusyLeave);
    window.addEventListener('click', onOutsideClick);
    loadTheme();
    void loadSystemSettings();
    await initAuth();
    if (isLoggedIn.value) await loadContents(currentUser.value);
});

onUnmounted(() => { clearTimeout(searchTimer); resetContentState(); window.removeEventListener('beforeunload', preventBusyLeave); window.removeEventListener('click', onOutsideClick); });
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
            <div v-else :class="['main-page', { 'reading-view': selectedContent && selectedContent.type !== CONTENT_TYPE.ALBUM }]">
                <AdminPanel v-if="showAdmin" @close="showAdmin = false; onAdminRefresh()" @refresh="onAdminRefresh" :currentUser="currentUser" />

                <template v-else>
                    <header class="header">
                        <div class="header-content">
                            <div class="header-left">
                                <svg class="site-mark" viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect width="28" height="28" rx="7" fill="var(--btn-primary-bg)" /><path d="M8 7h8l4 4v10H8z M16 7v5h4 M11 15h6 M11 18h4" stroke="var(--btn-primary-text)" stroke-width="1.2" stroke-linejoin="round" /></svg>
                                <span class="logo">{{ isLoggedIn && currentUser ? currentUser.name + ' 的小站' : '我的小站' }}</span>
                                <span class="header-note">记录与收藏</span>
                            </div>
                            <details ref="accountMenu" class="account-menu" @keydown.esc.prevent="closeAccountMenu">
                                <summary class="account-trigger">
                                    <span class="account-avatar" aria-hidden="true">{{ currentUser?.name?.slice(0, 1) || '访' }}</span>
                                    <span>{{ currentUser ? '我的' : '访客' }}</span><span class="account-chevron" aria-hidden="true">⌄</span>
                                </summary>
                                <div class="account-dropdown">
                                    <p class="account-name">{{ currentUser?.name || '以访客身份浏览' }}</p>
                                    <button @click="openSettings">外观设置</button>
                                    <button v-if="isSuperAdmin" @click="openAdmin">后台管理</button>
                                    <button v-if="isLoggedIn" :disabled="modalBusy" @click="onLogout">退出登录</button>
                                    <button v-else @click="closeAccountMenu(); isLoginPage = true">登录账号</button>
                                </div>
                            </details>
                        </div>
                    </header>

                    <Sidebar :currentTab="currentTab" @switchTab="onSwitchTab" />

                    <!-- 内容区 -->
                    <main class="content">
                        <div class="content-inner">
                        <div v-if="!selectedContent" class="page-heading">
                            <div class="heading-copy">
                                <p class="page-eyebrow"><span aria-hidden="true">✳</span> 生活的片段</p>
                                <div class="page-title-row"><h1>{{ tabTitle }}</h1><span v-if="!contentLoading" class="content-count">{{ totalContents }} 条</span></div>
                                <p class="page-description">{{ tabDescription }}</p>
                            </div>
                            <svg class="heading-art" viewBox="0 0 210 170" fill="none" aria-hidden="true">
                                <circle cx="113" cy="83" r="63" stroke="currentColor" stroke-dasharray="2 6" opacity=".25" />
                                <path d="M38 32h96v119H38z" transform="rotate(-12 86 91)" fill="var(--accent-soft)" stroke="currentColor" stroke-opacity=".25" />
                                <path d="M72 19h68l23 24v110H72z" fill="var(--surface)" stroke="currentColor" stroke-opacity=".45" />
                                <path d="M140 19v25h23 M91 68h50 M91 81h50 M91 94h31" stroke="currentColor" stroke-opacity=".35" />
                                <path d="m112 115 7 7 14-16" stroke="currentColor" stroke-width="1.5" />
                                <path d="M180 62v14 M173 69h14 M26 120v10 M21 125h10" stroke="currentColor" stroke-opacity=".6" />
                                <circle cx="48" cy="19" r="3" fill="currentColor" opacity=".65" />
                            </svg>
                            <button v-if="currentUser" class="btn btn-primary publish-btn" @click="openCreateModal"><span aria-hidden="true">+</span>{{ currentTab === CONTENT_TYPE.ALBUM ? '新建相册' : '写一篇' }}</button>
                        </div>
                        <!-- 访客引导横幅 -->
                        <GuestBanner v-if="!isLoggedIn" @login="isLoginPage = true" />

                        <ContentDetail
                            v-if="selectedContent"
                            :content="selectedContent"
                            :images="selectedContentImages"
                            :imagesLoading="detailImagesLoading"
                            :imagesError="detailImagesError"
                            @retryImages="retryImages"
                            :currentUser="currentUser"
                            :isLoggedIn="isLoggedIn"
                            :author="authorsMap[selectedContent.author_id]"
                            @back="onBackToList"
                            @edit="openEditModal"
                            @delete="onDeleteContent"
                        />

                        <div v-show="!selectedContent" class="list-view">
                        <ContentList
                            :contents="allContents"
                            :imagesMap="contentImagesMap"
                            :authorsMap="authorsMap"
                            :currentTab="currentTab"
                            :currentPage="currentPage" :pageSize="pageSize" :total="totalContents" :searchQuery="searchQuery"
                            :loading="contentLoading" :error="contentError" :imagesLoading="imagesLoading" :imagesError="imagesError"
                            @search="onSearch" @page="onPage"
                            @retry="loadContents(currentUser, { force: true })" @retryImages="retryImages"
                            @select="onSelectContent"
                        />
                        </div>
                        </div>
                    </main>
                </template>
            </div>

            <!-- 发布/编辑弹窗 -->
            <ContentModal v-if="isModalOpen"
                :isOpen="isModalOpen"
                :mode="modalMode"
                :busy="modalBusy"
                :saving="saving"
                :uploading="uploading"
                :uploadProgress="uploadProgress"
                :currentTab="formType"
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
                @fileUpload="onFileUpload"
                @removeImage="removeImage"
                @moveImage="moveImage"
                @setCover="setCover"
            />

            <!-- 设置弹窗 -->
            <SettingsModal v-if="isSettingsOpen"
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
.app-container, .main-page { min-height: 100vh; }
.app-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 16px; }
.app-loading-spinner { width: 28px; height: 28px; border: 2px solid var(--border); border-top-color: var(--brand-color); border-radius: 50%; animation: spin .7s linear infinite; }
.app-loading-text { font-size: 12px; color: var(--text-secondary); }
@keyframes spin { to { transform: rotate(360deg); } }
.toast { position: fixed; top: 88px; left: 50%; transform: translateX(-50%); max-width: calc(100vw - 32px); padding: 12px 20px; border-radius: 6px; font-size: 13px; z-index: 1000; background: var(--surface); color: var(--text); border: 1px solid var(--border); box-shadow: 0 8px 32px #00000012; }
.toast-error { color: var(--danger); }
.header { position: sticky; top: 0; z-index: 100; background: var(--surface); border-bottom: 1px solid var(--border); }
.header-content { height: 72px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 0 32px; }
.header-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.site-mark { width: 30px; height: 30px; color: var(--text); flex-shrink: 0; }
.logo { font-size: 16px; font-weight: 600; color: var(--text); letter-spacing: -.03em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.header-note { color: var(--text-secondary); font-size: 11px; padding-left: 18px; margin-left: 8px; border-left: 1px solid var(--border); white-space: nowrap; }
.account-menu { position: relative; flex-shrink: 0; }
.account-trigger { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 4px 6px; font-size: 12px; color: var(--text-secondary); cursor: pointer; list-style: none; border-radius: 5px; }
.account-trigger::-webkit-details-marker { display: none; }
.account-trigger:hover { background: var(--surface-muted); }
.account-avatar { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: var(--surface-muted); border: 1px solid var(--border); border-radius: 50%; color: var(--text); font-size: 11px; }
.account-chevron { margin-left: 3px; font-size: 12px; }
.account-dropdown { position: absolute; top: 48px; right: 0; width: 190px; padding: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; box-shadow: 0 8px 32px #00000012; }
.account-name { padding: 10px; font-size: 11px; color: var(--text-secondary); overflow-wrap: anywhere; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
.account-dropdown button { width: 100%; min-height: 38px; border: 0; border-radius: 4px; text-align: left; padding: 8px 10px; font-size: 12px; background: transparent; color: var(--text); cursor: pointer; }
.account-dropdown button:hover { background: var(--surface-muted); }
.content { margin-left: 216px; padding: 42px clamp(32px, 5vw, 80px) 64px; min-width: 0; }
.content-inner { max-width: 1080px; margin: 0 auto; }
.page-heading { position: relative; isolation: isolate; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; min-height: 194px; padding: 6px 0 32px; margin-bottom: 28px; border-bottom: 1px solid var(--border); }
.page-heading::after { content: ''; position: absolute; left: 0; bottom: -1px; width: 48px; height: 2px; background: var(--brand-color); }
.heading-copy { position: relative; z-index: 1; max-width: 70%; }
.heading-art { position: absolute; top: -7px; right: 122px; width: 190px; height: 154px; color: var(--brand-color); pointer-events: none; z-index: -1; }
.page-eyebrow { display: flex; align-items: center; gap: 9px; font-size: 10px; letter-spacing: .18em; color: var(--text-secondary); margin-bottom: 16px; }
.page-eyebrow span { font-size: 18px; line-height: 1; color: var(--brand-color); }
.page-title-row { display: flex; align-items: baseline; gap: 12px; }
.page-title-row h1 { font-size: 42px; font-weight: 650; line-height: 1.3; letter-spacing: -.045em; }
.content-count { font-size: 10px; color: var(--text-secondary); padding: 2px 8px; border: 1px solid var(--border); border-radius: 20px; white-space: nowrap; }
.page-description { font-size: 13px; color: var(--text-secondary); margin-top: 14px; line-height: 1.8; }
.publish-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex-shrink: 0; position: relative; z-index: 1; box-shadow: 0 3px 8px #0000000a; transition: transform .18s, box-shadow .18s; }
.publish-btn:hover { transform: translateY(-2px); box-shadow: 0 5px 14px #00000012; }
.publish-btn span { font-size: 18px; line-height: 1; font-weight: 400; }
@media (max-width: 1023px) {
    .header-content { height: 64px; padding: 0 24px; }
    .content { margin-left: 0; padding: 36px 28px 48px; }
    .header-note { display: none; }
}
@media (max-width: 1200px) { .heading-art { width: 150px; right: 112px; opacity: .7; } }
@media (max-width: 600px) {
    .header-content { padding: 0 20px; }
    .logo { font-size: 15px; }
    .site-mark { width: 28px; height: 28px; }
    .content { padding: 30px 20px 40px; }
    .page-heading { gap: 12px; min-height: 160px; margin-bottom: 24px; padding-bottom: 24px; align-items: flex-end; }
    .heading-copy { max-width: calc(100% - 88px); }
    .heading-art { right: 0; top: -16px; width: 90px; height: 88px; opacity: .65; }
    .page-eyebrow { margin-bottom: 14px; font-size: 9px; }
    .page-title-row { flex-wrap: wrap; gap: 6px 10px; }
    .page-title-row h1 { font-size: 32px; }
    .page-description { font-size: 12px; }
    .publish-btn { font-size: 12px; padding: 8px 12px; }
    .content-count { font-size: 9px; padding: 1px 6px; }
}

@media (max-width: 1023px) {
    .reading-view .header, .reading-view :deep(.sidebar), .reading-view :deep(.guest-banner) { display: none; }
    .reading-view .content { padding-top: 0; }
    .reading-view :deep(.detail-toolbar) { position: sticky; top: 0; z-index: 70; min-height: 56px; margin: 0 -28px 28px; padding: 8px 28px; background: var(--bg); }
    .reading-view :deep(.back-btn) { min-height: 40px; }
}
@media (max-width: 600px) {
    .reading-view :deep(.detail-toolbar) { margin-left: -20px; margin-right: -20px; padding-left: 20px; padding-right: 20px; }
}
</style>

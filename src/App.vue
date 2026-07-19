<script setup>
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import { CONFIG, LEVEL, VISIBILITY, CONTENT_TYPE, visibilityConfig } from './config';
import { supabase } from './supabase';
import { restoreSession, getUserByUsername, getEmailByUsername, getSystemSettings } from './data';
import { getVisibleContents, canEditContent, canDeleteContent } from './permissions';
import { getContentsByType, getImagesByContentId, createContent, updateContentApi, deleteContentApi, uploadImages } from './api';
import { formatDate, formatDateRange, truncateText, getContentTypeLabel, getVisibilityLabel, getVisibilityIcon, getVisibilityColor, getCurrentTime } from './utils';
import { loadTheme, getTheme, setTheme, resetTheme, getBrandColors, getBrightnessOptions, getCardStyleOptions, getFontSizeOptions } from './theme';

const AdminPanel = defineAsyncComponent(() => import('./admin/Admin.vue'));

/* ===== 状态 ===== */
const currentUser = ref(null);
const isLoggedIn = ref(false);
const currentTab = ref(CONTENT_TYPE.DIARY);
const selectedContent = ref(null);
const isModalOpen = ref(false);
const modalMode = ref('create');
const formImages = ref([]);
const formCaptions = ref([]);
const formTitle = ref('');
const formBody = ref('');
const formDescription = ref('');
const formVisibility = ref(VISIBILITY.PUBLIC);
const formStartDate = ref('');
const formEndDate = ref('');
const isSettingsOpen = ref(false);
const isSidebarOpen = ref(false);
const showAdmin = ref(false);
const headerTime = ref(getCurrentTime());
const toastMessage = ref('');
const toastType = ref('success');
const showToast = ref(false);

const isLoginPage = ref(true);
const loginForm = ref({ email: '', password: '' });
const registerForm = ref({ email: '', password: '', username: '', name: '' });
const isRegisterMode = ref(false);
const loading = ref(false);

const allContents = ref([]);
const contentImagesMap = ref({});
const selectedContentImages = ref([]);
const sysSettings = ref({ registration_open: true, daily_post_limit: 10, max_image_size: 10 });

let clockInterval = null;

/* ===== 计算属性 ===== */
const theme = computed(() => getTheme());
const brandColors = computed(() => getBrandColors());
const brightnessOptions = computed(() => getBrightnessOptions());
const cardStyleOptions = computed(() => getCardStyleOptions());
const fontSizeOptions = computed(() => getFontSizeOptions());
const registrationOpen = computed(() => sysSettings.value.registration_open);

const folderColors = ['#FF6B9D', '#4ECDC4', '#1A535C', '#FFE66D', '#FF9F1C', '#9B5DE5', '#00BBF9', '#00F5D4'];

/* ===== 工具函数 ===== */
function startClock() {
    clockInterval = setInterval(() => { headerTime.value = getCurrentTime(); }, 1000);
}

function showToastMessage(message, type = 'success') {
    toastMessage.value = message;
    toastType.value = type;
    showToast.value = true;
    setTimeout(() => { showToast.value = false; }, 2500);
}

/* ===== 认证 ===== */
async function handleLogin() {
    const account = loginForm.value.email.trim();
    const { password } = loginForm.value;
    if (!account || !password) {
        showToastMessage('请输入账号和密码', 'error');
        return;
    }
    loading.value = true;
    try {
        // 判断是邮箱还是用户名
        let email = account;
        if (!account.includes('@')) {
            email = await getEmailByUsername(account);
            if (!email) {
                showToastMessage('用户名不存在', 'error');
                return;
            }
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await loadUserProfile(data.user);
    } catch (e) {
        showToastMessage(e.message === 'Invalid login credentials' ? '账号或密码错误' : e.message, 'error');
        loginForm.value.password = '';
    } finally {
        loading.value = false;
    }
}

async function handleRegister() {
    const { email, password, username, name } = registerForm.value;
    if (!email || !password || !username || !name) {
        showToastMessage('请填写完整信息', 'error');
        return;
    }
    if (!sysSettings.value.registration_open) {
        showToastMessage('当前不开放注册', 'error');
        return;
    }
    // 校验用户名格式
    if (!/^[a-zA-Z0-9_]{2,20}$/.test(username)) {
        showToastMessage('用户名仅支持字母、数字、下划线，2-20位', 'error');
        return;
    }
    loading.value = true;
    try {
        // 检查用户名是否重复
        const existing = await getUserByUsername(username);
        if (existing) {
            showToastMessage('用户名已被占用，请换一个', 'error');
            loading.value = false;
            return;
        }
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name, username } }
        });
        if (error) throw error;
        if (data.user) {
            showToastMessage('注册成功，请登录');
            isRegisterMode.value = false;
            loginForm.value = { email, password: '' };
        } else {
            showToastMessage('注册成功，请检查邮箱确认');
            isRegisterMode.value = false;
        }
    } catch (e) {
        showToastMessage(e.message, 'error');
    } finally {
        loading.value = false;
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    currentUser.value = null;
    isLoggedIn.value = false;
    isLoginPage.value = true;
    selectedContent.value = null;
    allContents.value = [];
    contentImagesMap.value = {};
    isSidebarOpen.value = false;
    showToastMessage('已退出登录');
}

/** 加载用户完整信息 */
async function loadUserProfile(authUser) {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
    if (profile) {
        currentUser.value = { ...authUser, ...profile };
        isLoggedIn.value = true;
        isLoginPage.value = false;
        showToastMessage(`欢迎回来，${profile.name}`);
        await loadContents();
        await loadSystemSettings();
    }
}

/* ===== 数据加载 ===== */
async function loadContents() {
    if (!isLoggedIn.value) return;

    let contents;
    if (currentTab.value === 'all') {
        const types = [CONTENT_TYPE.DIARY, CONTENT_TYPE.ARTICLE, CONTENT_TYPE.ALBUM];
        const results = await Promise.all(types.map(t => getContentsByType(t)));
        contents = results.flat();
    } else {
        contents = await getContentsByType(currentTab.value);
    }

    contents = getVisibleContents(contents, currentUser.value);
    contents.sort((a, b) => b.created_at - a.created_at);

    // 预加载图片
    const imageMap = {};
    await Promise.all(contents.map(async (c) => {
        const imgs = await getImagesByContentId(c.id);
        imageMap[c.id] = imgs;
    }));
    contentImagesMap.value = imageMap;
    allContents.value = contents;
}

async function loadSystemSettings() {
    const settings = await getSystemSettings();
    sysSettings.value = settings;
}

async function handleRefresh() {
    await loadContents();
    await loadSystemSettings();
}

/* ===== 导航 ===== */
function switchTab(tab) {
    currentTab.value = tab;
    selectedContent.value = null;
    loadContents();
}

function toggleSidebar() { isSidebarOpen.value = !isSidebarOpen.value; }
function openSettings() { isSettingsOpen.value = true; }
function closeSettings() { isSettingsOpen.value = false; }

/* ===== 主题 ===== */
function handleThemeChange(key, value) { setTheme({ [key]: value }); }
function handleResetTheme() { resetTheme(); showToastMessage('已重置为默认主题'); }

/* ===== 内容弹窗 ===== */
function openCreateModal() {
    modalMode.value = 'create';
    selectedContent.value = null;
    formImages.value = [];
    formCaptions.value = [];
    formTitle.value = '';
    formBody.value = '';
    formDescription.value = '';
    formVisibility.value = VISIBILITY.PUBLIC;
    formStartDate.value = '';
    formEndDate.value = '';
    isModalOpen.value = true;
}

function openEditModal(content) {
    modalMode.value = 'edit';
    selectedContent.value = content;
    const imgs = contentImagesMap.value[content.id] || [];
    formImages.value = imgs.map(img => img.url);
    formCaptions.value = imgs.map(img => img.caption);
    formTitle.value = content.title || '';
    formBody.value = content.body || '';
    formDescription.value = content.description || '';
    formVisibility.value = content.visibility || VISIBILITY.PUBLIC;
    formStartDate.value = content.start_date ? formatDate(new Date(content.start_date).getTime()) : '';
    formEndDate.value = content.end_date ? formatDate(new Date(content.end_date).getTime()) : '';
    isModalOpen.value = true;
}

function closeModal() {
    isModalOpen.value = false;
    selectedContent.value = null;
    formImages.value = [];
    formCaptions.value = [];
}

async function handleFileUpload(event) {
    const files = event.target.files;
    if (files && files.length > 0) {
        const urls = await uploadImages(files);
        formImages.value = [...formImages.value, ...urls];
        formCaptions.value = [...formCaptions.value, ...new Array(urls.length).fill('')];
    }
}

function removeImage(index) {
    formImages.value.splice(index, 1);
    formCaptions.value.splice(index, 1);
}

async function handleSaveContent() {
    if (!formTitle.value) {
        showToastMessage('请输入标题', 'error');
        return;
    }
    const contentData = {
        authorId: currentUser.value.id,
        type: currentTab.value,
        title: formTitle.value,
        body: formBody.value,
        description: formDescription.value,
        visibility: formVisibility.value,
        images: formImages.value,
        captions: formCaptions.value
    };
    if (formStartDate.value) contentData.startDate = new Date(formStartDate.value).getTime();
    if (formEndDate.value) contentData.endDate = new Date(formEndDate.value).getTime();

    try {
        if (modalMode.value === 'create') {
            await createContent(contentData);
            showToastMessage('发布成功');
        } else {
            await updateContentApi(selectedContent.value.id, contentData);
            showToastMessage('更新成功');
        }
        closeModal();
        await loadContents();
    } catch (e) {
        showToastMessage('操作失败: ' + e.message, 'error');
    }
}

async function handleDeleteContent(content) {
    if (!confirm('确定要删除吗？')) return;
    try {
        await deleteContentApi(content.id);
        selectedContent.value = null;
        showToastMessage('已删除');
        await loadContents();
    } catch (e) {
        showToastMessage('删除失败: ' + e.message, 'error');
    }
}

async function selectContent(content) {
    selectedContent.value = content;
    const imgs = contentImagesMap.value[content.id] || [];
    if (imgs.length === 0) {
        selectedContentImages.value = await getImagesByContentId(content.id);
    } else {
        selectedContentImages.value = imgs;
    }
}

function goBack() {
    selectedContent.value = null;
    selectedContentImages.value = [];
}

/* ===== 初始化 ===== */
onMounted(async () => {
    loadTheme();
    startClock();
    const user = await restoreSession();
    if (user) {
        currentUser.value = user;
        isLoggedIn.value = true;
        isLoginPage.value = false;
        await loadContents();
        await loadSystemSettings();
    }
});

/* ===== 监听 ===== */
watch(currentTab, () => {
    if (isLoggedIn.value) loadContents();
});

onUnmounted(() => { if (clockInterval) clearInterval(clockInterval); });
</script>

<template>
    <div class="app-container">
        <div v-if="showToast" :class="['toast', `toast-${toastType}`]">
            {{ toastMessage }}
        </div>
        
        <!-- 登录页 -->
        <div v-if="isLoginPage" class="login-page">
            <div class="login-card">
                <div class="login-logo">📔</div>
                <div class="login-title">{{ CONFIG.siteName }}</div>
                <div class="login-subtitle">{{ isRegisterMode ? '创建新账号' : '欢迎回来' }}</div>
                
                <form v-if="!isRegisterMode" @submit.prevent="handleLogin" class="login-form">
                    <div class="form-group">
                        <label class="form-label">邮箱或用户名</label>
                        <input v-model="loginForm.email" type="text" class="form-input" placeholder="邮箱或用户名" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">密码</label>
                        <input v-model="loginForm.password" type="password" class="form-input" placeholder="请输入密码" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full" :disabled="loading">
                        {{ loading ? '登录中...' : '登录' }}
                    </button>
                    <div v-if="registrationOpen" class="login-switch">
                        还没有账号？<span @click="isRegisterMode = true" class="link">立即注册</span>
                    </div>
                    <div class="login-guest">
                        <span @click="isLoginPage = false" class="link">以访客身份浏览</span>
                    </div>
                </form>
                
                <form v-else @submit.prevent="handleRegister" class="login-form">
                    <div class="form-group">
                        <label class="form-label">邮箱</label>
                        <input v-model="registerForm.email" type="email" class="form-input" placeholder="请输入邮箱" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">用户名</label>
                        <input v-model="registerForm.username" type="text" class="form-input" placeholder="字母、数字、下划线，2-20位" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">密码</label>
                        <input v-model="registerForm.password" type="password" class="form-input" placeholder="请输入密码（至少6位）" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">昵称</label>
                        <input v-model="registerForm.name" type="text" class="form-input" placeholder="请输入昵称" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full" :disabled="loading">
                        {{ loading ? '注册中...' : '注册' }}
                    </button>
                    <div class="login-switch">
                        已有账号？<span @click="isRegisterMode = false" class="link">立即登录</span>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- 主页面 -->
        <div v-else class="main-page">
            <AdminPanel v-if="showAdmin" :currentUser="currentUser" @close="showAdmin = false" @refresh="handleRefresh" />
            <template v-else>
            <div class="header">
                <div class="header-content">
                    <div class="header-left">
                        <button class="header-btn menu-btn" @click="toggleSidebar">☰</button>
                        <div class="logo">{{ CONFIG.siteName }}</div>
                    </div>
                    <div class="header-actions">
                        <button v-if="currentUser?.level === LEVEL.SUPER_ADMIN" class="header-btn admin-entry-btn" @click="showAdmin = true" title="后台管理">🔧</button>
                        <button class="header-btn" @click="openSettings">⚙️</button>
                        <div class="header-time">{{ headerTime }}</div>
                    </div>
                </div>
            </div>
            
            <div :class="['sidebar', { open: isSidebarOpen }]">
                <div class="sidebar-header">
                    <div class="sidebar-logo">{{ CONFIG.siteName }}</div>
                </div>
                
                <div v-if="currentUser" class="sidebar-user">
                    <div class="user-avatar">{{ currentUser.avatar }}</div>
                    <div class="user-name">{{ currentUser.name }}</div>
                </div>
                
                <ul class="sidebar-nav">
                    <li class="nav-item">
                        <div :class="['nav-link', { active: currentTab === 'all' }]" @click="switchTab('all'); toggleSidebar()">
                            <span class="nav-icon">📋</span>
                            <span>全部</span>
                        </div>
                    </li>
                    <li class="nav-item">
                        <div :class="['nav-link', { active: currentTab === CONTENT_TYPE.DIARY }]" @click="switchTab(CONTENT_TYPE.DIARY); toggleSidebar()">
                            <span class="nav-icon">📔</span>
                            <span>{{ getContentTypeLabel(CONTENT_TYPE.DIARY) }}</span>
                        </div>
                    </li>
                    <li class="nav-item">
                        <div :class="['nav-link', { active: currentTab === CONTENT_TYPE.ARTICLE }]" @click="switchTab(CONTENT_TYPE.ARTICLE); toggleSidebar()">
                            <span class="nav-icon">📝</span>
                            <span>{{ getContentTypeLabel(CONTENT_TYPE.ARTICLE) }}</span>
                        </div>
                    </li>
                    <li class="nav-item">
                        <div :class="['nav-link', { active: currentTab === CONTENT_TYPE.ALBUM }]" @click="switchTab(CONTENT_TYPE.ALBUM); toggleSidebar()">
                            <span class="nav-icon">🖼️</span>
                            <span>{{ getContentTypeLabel(CONTENT_TYPE.ALBUM) }}</span>
                        </div>
                    </li>
                </ul>
                
                <div class="sidebar-bottom">
                    <button class="sidebar-btn sidebar-btn-primary" @click="openCreateModal(); toggleSidebar()">+ 新建</button>
                    <button v-if="currentUser" class="sidebar-btn sidebar-btn-secondary" @click="handleLogout">退出登录</button>
                </div>
            </div>
            
            <div :class="['sidebar-overlay', { open: isSidebarOpen }]" @click="toggleSidebar"></div>
            
            <div class="content">
                <!-- 内容详情 -->
                <div v-if="selectedContent" class="content-detail">
                    <div class="detail-header">
                        <button class="btn btn-secondary" @click="goBack">← 返回</button>
                        <div class="detail-title">{{ selectedContent.title }}</div>
                        <div class="detail-meta">
                            <span :style="{ color: getVisibilityColor(selectedContent.visibility) }">
                                {{ getVisibilityIcon(selectedContent.visibility) }} {{ getVisibilityLabel(selectedContent.visibility) }}
                            </span>
                            <span>{{ getContentTypeLabel(selectedContent.type) }}</span>
                            <span>⏰ {{ formatDate(new Date(selectedContent.created_at).getTime(), true) }}</span>
                            <span v-if="selectedContent.start_date">📅 {{ formatDateRange(new Date(selectedContent.start_date).getTime(), selectedContent.end_date ? new Date(selectedContent.end_date).getTime() : null) }}</span>
                        </div>
                    </div>
                    <div class="detail-body">
                        {{ selectedContent.type === CONTENT_TYPE.ALBUM ? selectedContent.description : selectedContent.body }}
                    </div>
                    <div v-if="selectedContentImages.length > 0" class="detail-images">
                        <div v-for="img in selectedContentImages" :key="img.id" class="detail-image">
                            <img :src="img.url" :alt="img.caption">
                            <div v-if="img.caption" class="image-caption">{{ img.caption }}</div>
                        </div>
                    </div>
                    <div class="detail-actions">
                        <button v-if="canEditContent(selectedContent, currentUser)" class="btn btn-primary" @click="openEditModal(selectedContent)">✏️ 编辑</button>
                        <button v-if="canDeleteContent(selectedContent, currentUser)" class="btn btn-danger" @click="handleDeleteContent(selectedContent)">🗑️ 删除</button>
                    </div>
                </div>
                
                <!-- 内容列表 -->
                <div v-else class="content-list">
                    <div v-if="currentTab === CONTENT_TYPE.ALBUM && allContents.length > 0" class="album-grid">
                        <div v-for="(album, index) in allContents" :key="album.id" 
                             class="album-card" @click="selectContent(album)"
                             :style="{ '--folder-color': folderColors[index % folderColors.length] }">
                            <div class="album-visual">
                                <div class="album-folder">
                                    <div class="folder-tab"></div>
                                    <div class="folder-content">
                                        <div v-for="(img, idx) in (contentImagesMap[album.id] || []).slice(0, 3)" :key="img.id"
                                             class="folder-image" :style="{ backgroundImage: `url(${img.url})` }">
                                        </div>
                                        <div v-if="(contentImagesMap[album.id] || []).length === 0" class="folder-placeholder">📷</div>
                                    </div>
                                </div>
                            </div>
                            <div class="album-info">
                                <div class="album-title">{{ album.title }}</div>
                                <div class="album-stats">{{ (contentImagesMap[album.id] || []).length }} photos</div>
                            </div>
                        </div>
                    </div>
                    
                    <div v-else-if="allContents.length > 0">
                        <div v-for="content in allContents" :key="content.id" 
                             :class="['card', `card-${theme.cardStyle}`]" @click="selectContent(content)">
                            <div class="card-header">
                                <div class="card-title">{{ content.title }}</div>
                                <div class="card-meta">
                                    <span :style="{ color: getVisibilityColor(content.visibility) }">
                                        {{ getVisibilityIcon(content.visibility) }} {{ getVisibilityLabel(content.visibility) }}
                                    </span>
                                    <span>{{ getContentTypeLabel(content.type) }}</span>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="card-text">
                                    {{ truncateText(content.type === CONTENT_TYPE.ALBUM ? content.description : content.body, 100) }}
                                </div>
                                <div v-if="(contentImagesMap[content.id] || []).length > 0" class="card-images">
                                    <div v-for="(img, idx) in (contentImagesMap[content.id] || []).slice(0, 3)" :key="img.id"
                                         class="card-image" :style="{ backgroundImage: `url(${img.url})` }">
                                    </div>
                                </div>
                            </div>
                            <div class="card-footer">
                                <span v-if="content.type === CONTENT_TYPE.ALBUM">📅 {{ formatDateRange(content.start_date ? new Date(content.start_date).getTime() : null, content.end_date ? new Date(content.end_date).getTime() : null) }}</span>
                                <span v-else>📅 {{ formatDate(new Date(content.created_at).getTime()) }}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div v-else class="empty-state">
                        <div class="empty-state-icon">📭</div>
                        <div class="empty-state-text">暂无内容</div>
                        <div class="empty-state-hint">当前用户没有可见的内容</div>
                    </div>
                </div>
            </div>
            
            <button v-if="currentUser" class="fab" @click="openCreateModal">+</button>
            </template>
        </div>
        
        <!-- 发布/编辑弹窗 -->
        <div v-if="isModalOpen" class="modal-overlay open" @click="closeModal">
            <div class="modal" @click.stop>
                <div class="modal-header">
                    <div class="modal-title">{{ modalMode === 'edit' ? '编辑' : '发布' }}{{ getContentTypeLabel(currentTab) }}</div>
                    <button class="modal-close" @click="closeModal">✕</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">标题</label>
                        <input v-model="formTitle" type="text" class="form-input" placeholder="请输入标题">
                    </div>
                    <div v-if="currentTab === CONTENT_TYPE.ALBUM" class="form-group">
                        <label class="form-label">描述</label>
                        <textarea v-model="formDescription" class="form-textarea" placeholder="请输入描述"></textarea>
                    </div>
                    <div v-if="currentTab !== CONTENT_TYPE.ALBUM" class="form-group">
                        <label class="form-label">正文</label>
                        <textarea v-model="formBody" class="form-textarea" placeholder="请输入正文"></textarea>
                    </div>
                    <div v-if="currentTab === CONTENT_TYPE.ALBUM" class="form-group">
                        <label class="form-label">时间段</label>
                        <div class="date-range">
                            <input v-model="formStartDate" type="date" class="form-input">
                            <span>~</span>
                            <input v-model="formEndDate" type="date" class="form-input">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">可见性</label>
                        <div class="visibility-options">
                            <label v-for="key in Object.keys(visibilityConfig)" :key="key" 
                                   :class="['visibility-option', { selected: formVisibility === key }]">
                                <input type="radio" name="visibility" :value="key" v-model="formVisibility">
                                <span :style="{ color: getVisibilityColor(key) }">{{ getVisibilityIcon(key) }}</span>
                                <span>{{ getVisibilityLabel(key) }}</span>
                            </label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">图片上传</label>
                        <input type="file" accept="image/*" multiple @change="handleFileUpload" class="file-input">
                        <div v-if="formImages.length > 0" class="uploaded-images">
                            <div v-for="(url, idx) in formImages" :key="idx" class="uploaded-image">
                                <img :src="url" :alt="`图片${idx + 1}`">
                                <button class="uploaded-image-remove" @click="removeImage(idx)">✕</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" @click="closeModal">取消</button>
                    <button class="btn btn-primary" @click="handleSaveContent">{{ modalMode === 'edit' ? '保存' : '发布' }}</button>
                </div>
            </div>
        </div>
        
        <!-- 设置弹窗 -->
        <div v-if="isSettingsOpen" class="modal-overlay open" @click="closeSettings">
            <div class="modal settings-modal" @click.stop>
                <div class="modal-header">
                    <div class="modal-title">⚙️ 外观设置</div>
                    <button class="modal-close" @click="closeSettings">✕</button>
                </div>
                <div class="modal-body">
                    <div class="settings-section">
                        <div class="settings-title">品牌色</div>
                        <div class="brand-colors">
                            <div v-for="color in brandColors" :key="color" 
                                 :class="['brand-color', { active: theme.brandColor === color }]"
                                 :style="{ backgroundColor: color }"
                                 @click="handleThemeChange('brandColor', color)">
                            </div>
                            <input type="color" :value="theme.brandColor" 
                                   @input="handleThemeChange('brandColor', $event.target.value)" class="color-picker">
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-title">背景亮度</div>
                        <div class="style-options">
                            <button v-for="option in brightnessOptions" :key="option.value"
                                    :class="['style-option', { active: theme.brightness === option.value }]"
                                    @click="handleThemeChange('brightness', option.value)">
                                {{ option.label }}
                            </button>
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-title">毛玻璃强度</div>
                        <div class="glass-slider-container">
                            <input type="range" min="0" max="100" :value="theme.glassStrength"
                                   @input="handleThemeChange('glassStrength', parseInt($event.target.value))" class="glass-slider">
                            <div class="glass-value">{{ theme.glassStrength }}%</div>
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-title">背景模糊</div>
                        <div class="glass-slider-container">
                            <input type="range" min="0" max="50" :value="theme.backgroundBlur"
                                   @input="handleThemeChange('backgroundBlur', parseInt($event.target.value))" class="glass-slider">
                            <div class="glass-value">{{ theme.backgroundBlur }}px</div>
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-title">卡片样式</div>
                        <div class="style-options">
                            <button v-for="option in cardStyleOptions" :key="option.value"
                                    :class="['style-option', { active: theme.cardStyle === option.value }]"
                                    @click="handleThemeChange('cardStyle', option.value)">
                                {{ option.label }}
                            </button>
                        </div>
                    </div>
                    <div class="settings-section">
                        <div class="settings-title">字体大小</div>
                        <div class="style-options">
                            <button v-for="option in fontSizeOptions" :key="option.value"
                                    :class="['style-option', { active: theme.fontSize === option.value }]"
                                    @click="handleThemeChange('fontSize', option.value)">
                                {{ option.label }}
                            </button>
                        </div>
                    </div>
                </div>
                <div class="settings-footer">
                    <button class="btn btn-secondary" @click="handleResetTheme">重置默认</button>
                    <button class="btn btn-primary" @click="closeSettings">关闭</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.app-container {
    min-height: 100vh;
    background-color: transparent;
    position: relative;
}

.toast {
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000;
    animation: fadeIn 0.2s ease;
}

.toast-success {
    background-color: rgba(16, 185, 129, 0.9);
    color: white;
}

.toast-error {
    background-color: rgba(239, 68, 68, 0.9);
    color: white;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

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

.login-logo {
    font-size: 56px;
    margin-bottom: 20px;
}

.login-title {
    font-size: 28px;
    font-weight: 700;
    color: var(--text-color, #2D3436);
    margin-bottom: 10px;
}

.login-subtitle {
    font-size: 15px;
    color: var(--text-secondary-color, #636E72);
    margin-bottom: 36px;
}

.login-form {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.form-group {
    text-align: left;
}

.form-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color, #2D3436);
    margin-bottom: 10px;
}

.form-input {
    width: 100%;
    padding: 14px 16px;
    border: 1px solid var(--border-color, #E8E7E4);
    border-radius: 10px;
    font-size: 15px;
    background-color: rgba(255, 255, 255, 0.7);
    color: var(--text-color, #2D3436);
    transition: border-color 0.2s;
}

.form-input:focus {
    outline: none;
    border-color: var(--brand-color, #4A5C6B);
}

.form-textarea {
    width: 100%;
    padding: 14px 16px;
    border: 1px solid var(--border-color, #E8E7E4);
    border-radius: 10px;
    font-size: 15px;
    background-color: rgba(255, 255, 255, 0.7);
    color: var(--text-color, #2D3436);
    min-height: 120px;
    resize: vertical;
}

.btn {
    padding: 12px 24px;
    border-radius: 10px;
    border: none;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
}

.btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-primary {
    background-color: var(--brand-color, #4A5C6B);
    color: white;
}

.btn-secondary {
    background-color: rgba(0, 0, 0, 0.05);
    color: var(--text-color, #2D3436);
}

.btn-danger {
    background-color: #EF4444;
    color: white;
}

.btn-full {
    width: 100%;
    padding: 16px;
}

.login-switch, .login-guest {
    font-size: 14px;
    color: var(--text-secondary-color, #636E72);
}

.link {
    color: var(--brand-color, #4A5C6B);
    cursor: pointer;
    font-weight: 500;
}

.main-page {
    min-height: 100vh;
}

.header {
    background-color: rgba(255, 255, 255, 0.6);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
    position: sticky;
    top: 0;
    z-index: 100;
}

.header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 14px;
}

.menu-btn {
    color: var(--brand-color, #4A5C6B);
    font-size: 22px;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    transition: background-color 0.2s;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.menu-btn:hover {
    background-color: rgba(74, 92, 107, 0.1);
}

.logo {
    font-size: 20px;
    font-weight: 700;
    color: var(--brand-color, #4A5C6B);
    letter-spacing: -0.02em;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 20px;
}

.header-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 8px;
    border-radius: 8px;
    transition: background-color 0.2s;
}

.header-btn:hover {
    background-color: rgba(0, 0, 0, 0.05);
}

.admin-entry-btn {
    font-size: 17px;
    color: var(--brand-color, #4A5C6B);
}

.header-time {
    font-size: 15px;
    font-weight: 500;
    color: var(--brand-color, #4A5C6B);
    letter-spacing: 1px;
    font-variant-numeric: tabular-nums;
}

.sidebar {
    position: fixed;
    left: 0;
    top: 60px;
    bottom: 0;
    width: 260px;
    background-color: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-right: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 4px 0 20px rgba(0, 0, 0, 0.06);
    padding: 24px 16px;
    z-index: 90;
    transform: translateX(-100%);
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
}

.sidebar.open {
    transform: translateX(0);
    opacity: 1;
    visibility: visible;
}

.sidebar-overlay {
    position: fixed;
    top: 60px;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.3);
    z-index: 80;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s ease;
}

.sidebar-overlay.open {
    opacity: 1;
    visibility: visible;
}

.sidebar-header {
    margin-bottom: 28px;
}

.sidebar-logo {
    font-size: 18px;
    font-weight: 700;
    color: var(--brand-color, #4A5C6B);
}

.sidebar-user {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    background-color: rgba(74, 92, 107, 0.06);
    border-radius: 12px;
    margin-bottom: 28px;
}

.user-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background-color: rgba(74, 92, 107, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
}

.user-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color, #2D3436);
}

.sidebar-nav {
    list-style: none;
    padding: 0;
    margin: 0;
    flex: 1;
}

.nav-item {
    margin-bottom: 4px;
}

.nav-link {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 15px;
    color: var(--text-secondary-color, #636E72);
    border: 1px solid transparent;
}

.nav-link:hover {
    background-color: rgba(0, 0, 0, 0.04);
    color: var(--text-color, #2D3436);
}

.nav-link.active {
    background-color: rgba(74, 92, 107, 0.12);
    color: var(--brand-color, #4A5C6B);
    font-weight: 600;
    border: 1px solid rgba(74, 92, 107, 0.2);
}

.nav-icon {
    font-size: 18px;
}

.sidebar-bottom {
    padding-top: 16px;
    border-top: 1px solid var(--border-color, #E8E7E4);
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.sidebar-btn {
    width: 100%;
    padding: 14px;
    border-radius: 10px;
    border: none;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
}

.sidebar-btn-primary {
    background-color: var(--brand-color, #4A5C6B);
    color: white;
}

.sidebar-btn-secondary {
    background-color: transparent;
    color: var(--text-secondary-color, #636E72);
}

.content {
    flex: 1;
    min-width: 0;
    padding: 32px;
    max-width: 1200px;
}

.content-list {
    display: flex;
    flex-direction: column;
}

.album-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 28px;
}

.album-card {
    cursor: pointer;
    transition: transform 0.3s;
}

.album-card:hover {
    transform: translateY(-6px);
}

.album-visual {
    margin-bottom: 16px;
}

.album-folder {
    background-color: var(--folder-color);
    border-radius: 14px;
    padding: 20px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    position: relative;
    min-height: 180px;
}

.folder-tab {
    position: absolute;
    top: -12px;
    left: 24px;
    width: 50px;
    height: 20px;
    background-color: var(--folder-color);
    border-radius: 10px 10px 0 0;
    box-shadow: 0 -4px 8px rgba(0, 0, 0, 0.12);
}

.folder-content {
    position: relative;
    padding-top: 12px;
    height: 140px;
}

.folder-image {
    position: absolute;
    width: 65%;
    aspect-ratio: 3/4;
    background-size: cover;
    background-position: center;
    border-radius: 8px;
    box-shadow: 0 5px 14px rgba(0, 0, 0, 0.3);
    transition: all 0.3s;
}

.folder-image:nth-child(1) {
    z-index: 3;
    left: 0;
    top: 0;
    transform: rotate(-3deg);
}

.folder-image:nth-child(2) {
    z-index: 2;
    right: 0;
    top: 10px;
    width: 55%;
    transform: rotate(4deg);
}

.folder-image:nth-child(3) {
    z-index: 1;
    left: 50%;
    top: -8px;
    transform: translateX(-50%) rotate(0deg);
    width: 60%;
}

.folder-placeholder {
    width: 100%;
    aspect-ratio: 4/3;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 8px;
}

.album-info {
    text-align: center;
}

.album-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-color, #2D3436);
    margin-bottom: 6px;
    letter-spacing: -0.02em;
}

.album-stats {
    font-size: 13px;
    color: var(--text-secondary-color, #636E72);
}

.card {
    background-color: rgba(255, 255, 255, 0.85);
    border-radius: 14px;
    padding: 24px;
    margin-bottom: 20px;
    cursor: pointer;
    transition: all 0.3s;
}

.card:hover {
    transform: translateY(-3px);
}

.card-shadow {
    box-shadow: 0 5px 16px rgba(0, 0, 0, 0.08);
}

.card-border {
    border: 1px solid var(--border-color, #E8E7E4);
}

.card-glass {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
}

.card-header {
    margin-bottom: 16px;
}

.card-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color, #2D3436);
    margin-bottom: 10px;
}

.card-meta {
    font-size: 13px;
    color: var(--text-secondary-color, #636E72);
    display: flex;
    gap: 14px;
}

.card-body {
    margin-bottom: 16px;
}

.card-text {
    font-size: 15px;
    color: var(--text-color, #2D3436);
    line-height: 1.7;
    margin-bottom: 16px;
}

.card-images {
    display: flex;
    gap: 10px;
}

.card-image {
    width: 100px;
    height: 100px;
    border-radius: 10px;
    background-size: cover;
    background-position: center;
}

.card-footer {
    font-size: 13px;
    color: var(--text-secondary-color, #636E72);
}

.empty-state {
    text-align: center;
    padding: 80px 20px;
}

.empty-state-icon {
    font-size: 56px;
    margin-bottom: 20px;
}

.empty-state-text {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-color, #2D3436);
    margin-bottom: 10px;
}

.empty-state-hint {
    font-size: 15px;
    color: var(--text-secondary-color, #636E72);
}

.content-detail {
    padding: 0;
}

.detail-header {
    margin-bottom: 32px;
}

.detail-title {
    font-size: 28px;
    font-weight: 700;
    color: var(--text-color, #2D3436);
    margin: 20px 0;
}

.detail-meta {
    font-size: 14px;
    color: var(--text-secondary-color, #636E72);
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
}

.detail-body {
    font-size: 16px;
    color: var(--text-color, #2D3436);
    line-height: 1.8;
    margin-bottom: 32px;
}

.detail-images {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
    margin-bottom: 32px;
}

.detail-image {
    border-radius: 14px;
    overflow: hidden;
}

.detail-image img {
    width: 100%;
    height: auto;
}

.image-caption {
    padding: 10px 14px;
    font-size: 14px;
    color: var(--text-secondary-color, #636E72);
    background-color: rgba(0, 0, 0, 0.03);
}

.detail-actions {
    display: flex;
    gap: 16px;
}

.fab {
    position: fixed;
    bottom: 40px;
    right: 40px;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background-color: var(--brand-color, #4A5C6B);
    color: white;
    font-size: 28px;
    border: none;
    cursor: pointer;
    box-shadow: 0 5px 20px rgba(74, 92, 107, 0.35);
    transition: transform 0.3s;
    z-index: 50;
}

.fab:hover {
    transform: scale(1.1);
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    opacity: 0;
    visibility: hidden;
    transition: all 0.3s;
}

.modal-overlay.open {
    opacity: 1;
    visibility: visible;
}

.modal {
    background-color: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 18px;
    width: 90%;
    max-width: 560px;
    max-height: 85vh;
    overflow-y: auto;
    opacity: 0;
    transform: scale(0.95);
    transition: all 0.3s;
}

.modal-overlay.open .modal {
    opacity: 1;
    transform: scale(1);
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px 28px;
    border-bottom: 1px solid var(--border-color, #E8E7E4);
}

.modal-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-color, #2D3436);
}

.modal-close {
    background: none;
    border: none;
    font-size: 22px;
    cursor: pointer;
    color: var(--text-secondary-color, #636E72);
    padding: 4px;
}

.modal-body {
    padding: 28px;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 16px;
    padding: 20px 28px;
    border-top: 1px solid var(--border-color, #E8E7E4);
}

.date-range {
    display: flex;
    align-items: center;
    gap: 14px;
}

.date-range input {
    flex: 1;
}

.visibility-options {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
}

.visibility-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 10px;
    background-color: rgba(0, 0, 0, 0.03);
    cursor: pointer;
    font-size: 14px;
}

.visibility-option input {
    display: none;
}

.visibility-option.selected {
    background-color: rgba(74, 92, 107, 0.1);
}

.file-input {
    width: 100%;
    padding: 14px;
    border: 1px dashed var(--border-color, #E8E7E4);
    border-radius: 10px;
    cursor: pointer;
    background-color: rgba(0, 0, 0, 0.02);
}

.uploaded-images {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 14px;
}

.uploaded-image {
    position: relative;
    width: 100px;
    height: 100px;
    border-radius: 10px;
    overflow: hidden;
}

.uploaded-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.uploaded-image-remove {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    border: none;
    font-size: 14px;
    cursor: pointer;
}

.settings-modal {
    max-width: 500px;
}

.settings-section {
    margin-bottom: 28px;
}

.settings-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color, #2D3436);
    margin-bottom: 14px;
}

.brand-colors {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.brand-color {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    cursor: pointer;
    transition: transform 0.2s;
    border: 2px solid transparent;
}

.brand-color.active {
    border-color: var(--text-color, #2D3436);
    transform: scale(1.1);
}

.color-picker {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    padding: 0;
}

.style-options {
    display: flex;
    gap: 10px;
}

.style-option {
    flex: 1;
    padding: 12px 10px;
    border: 1px solid var(--border-color, #E8E7E4);
    border-radius: 10px;
    cursor: pointer;
    text-align: center;
    font-size: 14px;
    font-weight: 400;
    color: var(--text-secondary-color, #636E72);
    transition: all 0.2s;
}

.style-option:hover {
    border-color: var(--brand-color, #4A5C6B);
}

.style-option.active {
    border-color: var(--brand-color, #4A5C6B);
    background-color: rgba(74, 92, 107, 0.06);
    color: var(--text-color, #2D3436);
    font-weight: 500;
}

.glass-slider-container {
    display: flex;
    align-items: center;
    gap: 14px;
}

.glass-slider {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background-color: var(--border-color, #E8E7E4);
    outline: none;
    cursor: pointer;
}

.glass-value {
    font-size: 14px;
    color: var(--text-secondary-color, #636E72);
    min-width: 50px;
}

.settings-footer {
    display: flex;
    gap: 14px;
    padding: 20px 28px;
    border-top: 1px solid var(--border-color, #E8E7E4);
}

.settings-footer .btn-secondary {
    flex: 1;
}

.settings-footer .btn-primary {
    flex: 1;
}

@media (max-width: 768px) {
    .content {
        padding: 20px;
        max-width: 100%;
    }
    .album-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
    }
    .detail-images {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 480px) {
    .header-content {
        padding: 10px 16px;
    }
    .logo {
        font-size: 18px;
    }
    .header-time {
        font-size: 14px;
    }
    .sidebar {
        width: 100%;
        top: 56px;
    }
    .content {
        padding: 16px;
    }
    .album-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
    }
    .album-folder {
        min-height: 140px;
        padding: 16px;
    }
    .folder-content {
        height: 110px;
    }
}
</style>

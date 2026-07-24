<script setup>
import { ref, computed, onMounted } from 'vue';
import { LEVEL, levelNameMap, levelColorMap, VISIBILITY, visibilityConfig, CONTENT_TYPE, typeLabelMap, CONFIG } from '../config';
import { supabase } from '../supabase';
import { getUsers, getContents, updateUser, deleteUser, updateContent, deleteContent, pinContent, addLog, getLogs, getSystemSettings, updateSystemSettings, getStorageUsage } from '../data';
import { formatDate, getLevelName, getLevelColor, getVisibilityLabel, getVisibilityIcon, getVisibilityColor, getContentTypeLabel } from '../utils';

const props = defineProps({
    currentUser: { type: Object, required: true }
});

const emit = defineEmits(['close', 'refresh']);

const activeTab = ref('users');

/* ===== 异步数据 ===== */
const users = ref([]);
const contents = ref([]);
const logs = ref([]);
const settings = ref({ registration_open: true, daily_post_limit: 10, max_image_size: 10 });
const storage = ref({ totalUsers: 0, totalContents: 0, totalImages: 0, logsCount: 0 });
const isLoading = ref(false);

async function loadUsers() {
    users.value = await getUsers();
}

async function loadContents() {
    contents.value = await getContents();
}

async function loadLogs() {
    logs.value = await getLogs();
}

async function loadSettings() {
    settings.value = await getSystemSettings();
    storage.value = await getStorageUsage();
}

async function loadAll() {
    isLoading.value = true;
    try {
        await Promise.all([loadUsers(), loadContents(), loadLogs(), loadSettings()]);
    } finally {
        isLoading.value = false;
    }
}

/* ===== 用户管理 ===== */
const userSearch = ref('');
const showUserModal = ref(false);
const userModalMode = ref('add');
const editingUserId = ref(null);
const userForm = ref({ email: '', password: '', name: '', level: LEVEL.MEMBER, avatar: '👤' });

const filteredUsers = computed(() => {
    if (!userSearch.value) return users.value;
    const q = userSearch.value.toLowerCase();
    return users.value.filter(u =>
        (u.username || '').toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q)
    );
});

function openAddUser() {
    userModalMode.value = 'add';
    editingUserId.value = null;
    userForm.value = { email: '', password: '', name: '', level: LEVEL.MEMBER, avatar: '👤' };
    showUserModal.value = true;
}

function openEditUser(user) {
    userModalMode.value = 'edit';
    editingUserId.value = user.id;
    userForm.value = {
        email: user.username || user.email || '',
        password: '',
        name: user.name,
        level: user.level,
        avatar: user.avatar
    };
    showUserModal.value = true;
}

async function handleSaveUser() {
    const { email, password, name, level, avatar } = userForm.value;
    if (!email || !name) return;

    if (userModalMode.value === 'add') {
        if (!password) return;
        loading.value = true;
        try {
            // 保存当前管理员 session
            const { data: { session: adminSession } } = await supabase.auth.getSession();

            // 通过 signUp 创建用户（数据库触发器自动创建 profile）
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { name } }
            });
            if (signUpError) {
                if (signUpError.message.includes('already registered')) {
                    alert('该邮箱已被注册');
                    return;
                }
                throw signUpError;
            }

            if (signUpData.user) {
                // 更新新用户的等级和头像
                await updateUser(signUpData.user.id, { level, avatar });
            }

            // 恢复管理员 session
            if (adminSession) {
                await supabase.auth.setSession({
                    access_token: adminSession.access_token,
                    refresh_token: adminSession.refresh_token
                });
            }

            await addLog({
                userId: props.currentUser.id,
                userName: props.currentUser.name,
                action: 'create_user',
                target: email,
                targetType: 'user',
                detail: `新建用户「${name}」，等级 ${getLevelName(level)}`
            });
            showUserModal.value = false;
            await loadUsers();
            emit('refresh');
        } catch (e) {
            alert('创建失败: ' + e.message);
        } finally {
            loading.value = false;
        }
    } else {
        loading.value = true;
        try {
            const updates = { name, email, level, avatar };
            await updateUser(editingUserId.value, updates);
            await addLog({
                userId: props.currentUser.id,
                userName: props.currentUser.name,
                action: 'edit_user',
                target: email,
                targetType: 'user',
                detail: `编辑用户「${name}」`
            });
            showUserModal.value = false;
            await loadUsers();
            emit('refresh');
        } catch (e) {
            alert('保存失败: ' + e.message);
        } finally {
            loading.value = false;
        }
    }
}

async function handleDeleteUser(user) {
    if (user.id === props.currentUser.id) {
        alert('不能删除自己');
        return;
    }
    if (!confirm(`确定删除用户「${user.name}」吗？其所有内容也会被删除。`)) return;
    try {
        await deleteUser(user.id);
        await addLog({
            userId: props.currentUser.id,
            userName: props.currentUser.name,
            action: 'delete_user',
            target: user.username || user.email,
            targetType: 'user',
            detail: `删除用户「${user.name}」及其全部内容`
        });
        await loadUsers();
        emit('refresh');
    } catch (e) {
        alert('删除失败: ' + e.message);
    }
}

async function handleChangeLevel(user, newLevel) {
    if (user.level === newLevel) return;
    try {
        await updateUser(user.id, { level: newLevel });
        await addLog({
            userId: props.currentUser.id,
            userName: props.currentUser.name,
            action: 'change_level',
            target: user.username || user.email,
            targetType: 'user',
            detail: `将「${user.name}」等级从 ${getLevelName(user.level)} 改为 ${getLevelName(newLevel)}`
        });
        await loadUsers();
        emit('refresh');
    } catch (e) {
        alert('修改失败: ' + e.message);
    }
}

/* ===== 内容管理 ===== */
const contentSearch = ref('');
const contentTypeFilter = ref('all');
const contentVisibilityFilter = ref('all');

const filteredContents = computed(() => {
    let list = contents.value;
    if (contentTypeFilter.value !== 'all') list = list.filter(c => c.type === contentTypeFilter.value);
    if (contentVisibilityFilter.value !== 'all') list = list.filter(c => c.visibility === contentVisibilityFilter.value);
    if (contentSearch.value) {
        const q = contentSearch.value.toLowerCase();
        list = list.filter(c => (c.title || '').toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
});

function getAuthorName(authorId) {
    const user = users.value.find(u => u.id === authorId);
    return user ? user.name : '未知';
}

const showContentModal = ref(false);
const editingContent = ref(null);
const contentForm = ref({ title: '', body: '', description: '', visibility: VISIBILITY.PUBLIC });

function openEditContent(content) {
    editingContent.value = content;
    contentForm.value = {
        title: content.title || '',
        body: content.body || '',
        description: content.description || '',
        visibility: content.visibility || VISIBILITY.PUBLIC
    };
    showContentModal.value = true;
}

async function handleSaveContent() {
    if (!contentForm.value.title) return;
    try {
        await updateContent(editingContent.value.id, contentForm.value);
        await addLog({
            userId: props.currentUser.id,
            userName: props.currentUser.name,
            action: 'edit_content',
            target: editingContent.value.title,
            targetType: 'content',
            detail: `编辑了${getContentTypeLabel(editingContent.value.type)}「${contentForm.value.title}」`
        });
        showContentModal.value = false;
        await loadContents();
        emit('refresh');
    } catch (e) {
        alert('保存失败: ' + e.message);
    }
}

async function handleDeleteContent(content) {
    if (!confirm(`确定删除「${content.title}」吗？`)) return;
    try {
        await deleteContent(content.id);
        await addLog({
            userId: props.currentUser.id,
            userName: props.currentUser.name,
            action: 'delete_content',
            target: content.title,
            targetType: 'content',
            detail: `删除了${getContentTypeLabel(content.type)}「${content.title}」`
        });
        await loadContents();
        emit('refresh');
    } catch (e) {
        alert('删除失败: ' + e.message);
    }
}

async function handlePinContent(content) {
    try {
        await pinContent(content.id);
        const action = !content.pinned ? 'pin_content' : 'unpin_content';
        const detail = !content.pinned ? `置顶了「${content.title}」` : `取消置顶「${content.title}」`;
        await addLog({
            userId: props.currentUser.id,
            userName: props.currentUser.name,
            action,
            target: content.title,
            targetType: 'content',
            detail
        });
        await loadContents();
        emit('refresh');
    } catch (e) {
        alert('操作失败: ' + e.message);
    }
}

/* ===== 系统设置 ===== */
async function handleSaveSettings() {
    try {
        await updateSystemSettings({ ...settings.value });
        await addLog({
            userId: props.currentUser.id,
            userName: props.currentUser.name,
            action: 'update_settings',
            target: '系统设置',
            targetType: 'system',
            detail: '更新了系统设置'
        });
        alert('设置已保存');
    } catch (e) {
        alert('保存失败: ' + e.message);
    }
}

/* ===== 数据导出 ===== */
const exportTimeStart = ref('')
const exportTimeEnd = ref('')
const exportTypeFilter = ref('all')
const checkedExportIds = ref(new Set())

const exportableContents = computed(() => {
    let list = contents.value
    if (exportTypeFilter.value !== 'all') list = list.filter(c => c.type === exportTypeFilter.value)
    if (exportTimeStart.value) {
        const start = new Date(exportTimeStart.value).getTime()
        list = list.filter(c => new Date(c.created_at).getTime() >= start)
    }
    if (exportTimeEnd.value) {
        const end = new Date(exportTimeEnd.value).setHours(23, 59, 59, 999)
        list = list.filter(c => new Date(c.created_at).getTime() <= end)
    }
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
})

const exportSelectAll = computed({
    get() { return exportableContents.value.length > 0 && exportableContents.value.every(c => checkedExportIds.value.has(c.id)) },
    set(v) {
        if (v) { exportableContents.value.forEach(c => checkedExportIds.value.add(c.id)) }
        else { checkedExportIds.value = new Set([...checkedExportIds.value].filter(id => !exportableContents.value.some(c => c.id === id))) }
    }
})

const exportCheckedCount = computed(() => 
    exportableContents.value.filter(c => checkedExportIds.value.has(c.id)).length
)

function toggleExportCheck(id) {
    const s = new Set(checkedExportIds.value)
    s.has(id) ? s.delete(id) : s.add(id)
    checkedExportIds.value = s
}

async function exportSelectedMarkdown() {
    const selected = exportableContents.value.filter(c => checkedExportIds.value.has(c.id))
    if (selected.length === 0) { alert('请至少选择一条内容'); return }

    const contentIds = selected.map(c => c.id)
    const { data: imgs } = await supabase.from('content_images').select('*').in('content_id', contentIds)
    const imageMap = {}
    if (imgs) imgs.forEach(img => { (imageMap[img.content_id] ||= []).push(img) })

    let md = `# ${CONFIG.siteName} 数据备份\n\n`
    md += `> 导出时间：${new Date().toLocaleString('zh-CN')}\n`
    md += `> 共 ${selected.length} 条内容\n\n---\n\n`

    for (const c of selected) {
        const authorName = getAuthorName(c.author_id)
        const typeLabel = getContentTypeLabel(c.type)
        const visLabel = getVisibilityLabel(c.visibility)
        const date = formatDate(new Date(c.created_at).getTime(), true)
        const cImgs = imageMap[c.id] || []

        md += `## ${c.title}\n\n`
        md += `| 属性 | 值 |\n|------|----|\n`
        md += `| 类型 | ${typeLabel} |\n| 作者 | ${authorName} |\n| 可见性 | ${visLabel} |\n| 时间 | ${date} |\n`
        if (c.start_date) {
            let r = formatDate(new Date(c.start_date).getTime())
            if (c.end_date) r += ` ~ ${formatDate(new Date(c.end_date).getTime())}`
            md += `| 时间段 | ${r} |\n`
        }
        md += `\n`
        if (c.body) md += `${c.body}\n\n`
        if (c.description) md += `> ${c.description}\n\n`
        if (cImgs.length > 0) {
            md += `**图片 (${cImgs.length} 张)**\n\n`
            for (const img of cImgs) {
                md += `![${img.caption || '图片'}](${img.url})\n`
                if (img.caption) md += `*${img.caption}*\n`
            }
            md += `\n`
        }
        md += `---\n\n`
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${CONFIG.siteName}_备份_${new Date().toISOString().slice(0, 10)}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/* ===== 操作日志 ===== */
const logActionFilter = ref('all');

const logActions = [
    { value: 'all', label: '全部' },
    { value: 'create_user', label: '创建用户' },
    { value: 'edit_user', label: '编辑用户' },
    { value: 'delete_user', label: '删除用户' },
    { value: 'change_level', label: '修改等级' },
    { value: 'edit_content', label: '编辑内容' },
    { value: 'delete_content', label: '删除内容' },
    { value: 'pin_content', label: '置顶内容' },
    { value: 'unpin_content', label: '取消置顶' },
    { value: 'update_settings', label: '更新设置' }
];

const filteredLogs = computed(() => {
    let list = logs.value;
    if (logActionFilter.value !== 'all') list = list.filter(l => l.action === logActionFilter.value);
    return list;
});

/* ===== 头像选择 ===== */
const avatarOptions = ['👤', '👨', '👩', '👨\u200D💼', '👩\u200D💼', '🧑\u200D💼', '👨\u200D💻', '👩\u200D💻', '👨\u200D🎨', '👩\u200D🎨', '👨\u200D🔬', '👩\u200D🔬', '🦸', '🦹', '🧑\u200D🚀', '👑'];

const loading = ref(false);

/* ===== 初始化 ===== */
onMounted(() => {
    loadAll();
});
</script>

<template>
    <div class="admin-panel">
        <!-- 顶栏 -->
        <div class="admin-topbar">
            <div class="admin-topbar-left">
                <div class="admin-logo">🔧 后台管理</div>
                <div class="admin-user-tag">{{ props.currentUser.name }} · 高级管理员</div>
            </div>
            <button class="admin-close-btn" @click="$emit('close')">← 返回前台</button>
        </div>

        <div class="admin-body">
            <!-- 侧边导航 -->
            <div class="admin-sidebar">
                <div :class="['admin-nav-item', { active: activeTab === 'users' }]" @click="activeTab = 'users'">
                    <span class="admin-nav-icon">👥</span> 用户管理
                </div>
                <div :class="['admin-nav-item', { active: activeTab === 'contents' }]" @click="activeTab = 'contents'">
                    <span class="admin-nav-icon">📄</span> 内容管理
                </div>
                <div :class="['admin-nav-item', { active: activeTab === 'settings' }]" @click="activeTab = 'settings'">
                    <span class="admin-nav-icon">⚙️</span> 系统设置
                </div>
                <div :class="['admin-nav-item', { active: activeTab === 'logs' }]" @click="activeTab = 'logs'">
                    <span class="admin-nav-icon">📋</span> 操作日志
                </div>
                <div :class="['admin-nav-item', { active: activeTab === 'export' }]" @click="activeTab = 'export'">
                    <span class="admin-nav-icon">💾</span> 数据备份
                </div>
            </div>

            <!-- 主内容区 -->
            <div class="admin-content">
                <div v-if="isLoading" class="admin-loading">加载中...</div>

                <!-- ===== 用户管理 ===== -->
                <div v-if="activeTab === 'users' && !isLoading" class="admin-section">
                    <div class="admin-section-header">
                        <h2 class="admin-section-title">用户管理</h2>
                        <div class="admin-section-actions">
                            <input v-model="userSearch" type="text" class="admin-search" placeholder="搜索用户名或昵称...">
                            <button class="admin-btn admin-btn-primary" @click="openAddUser">+ 新增用户</button>
                        </div>
                    </div>
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>头像</th>
                                <th>邮箱</th>
                                <th>昵称</th>
                                <th>等级</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="user in filteredUsers" :key="user.id">
                                <td class="td-avatar">{{ user.avatar }}</td>
                                <td>{{ user.username || user.email }}</td>
                                <td>{{ user.name }}</td>
                                <td>
                                    <select class="admin-select-sm" :value="user.level" @change="handleChangeLevel(user, parseInt($event.target.value))">
                                        <option v-for="(label, lv) in levelNameMap" :key="lv" :value="lv">{{ label }}</option>
                                    </select>
                                </td>
                                <td class="td-actions">
                                    <button class="admin-btn-sm" @click="openEditUser(user)">编辑</button>
                                    <button class="admin-btn-sm admin-btn-sm-danger" @click="handleDeleteUser(user)" :disabled="user.id === props.currentUser.id">删除</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div v-if="filteredUsers.length === 0" class="admin-empty">暂无匹配的用户</div>
                </div>

                <!-- ===== 内容管理 ===== -->
                <div v-if="activeTab === 'contents' && !isLoading" class="admin-section">
                    <div class="admin-section-header">
                        <h2 class="admin-section-title">内容管理</h2>
                        <div class="admin-section-actions">
                            <input v-model="contentSearch" type="text" class="admin-search" placeholder="搜索标题...">
                            <select v-model="contentTypeFilter" class="admin-select">
                                <option value="all">全部类型</option>
                                <option v-for="(label, type) in typeLabelMap" :key="type" :value="type">{{ label }}</option>
                            </select>
                            <select v-model="contentVisibilityFilter" class="admin-select">
                                <option value="all">全部可见性</option>
                                <option v-for="(cfg, key) in visibilityConfig" :key="key" :value="key">{{ cfg.icon }} {{ cfg.label }}</option>
                            </select>
                        </div>
                    </div>
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th style="width:30px"></th>
                                <th>标题</th>
                                <th>类型</th>
                                <th>作者</th>
                                <th>可见性</th>
                                <th>创建时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="content in filteredContents" :key="content.id" :class="{ 'row-pinned': content.pinned }">
                                <td>
                                    <span v-if="content.pinned" class="pinned-badge" title="已置顶">📌</span>
                                </td>
                                <td class="td-title">{{ content.title }}</td>
                                <td>{{ getContentTypeLabel(content.type) }}</td>
                                <td>{{ getAuthorName(content.author_id) }}</td>
                                <td>
                                    <span :style="{ color: getVisibilityColor(content.visibility) }">
                                        {{ getVisibilityIcon(content.visibility) }} {{ getVisibilityLabel(content.visibility) }}
                                    </span>
                                </td>
                                <td>{{ formatDate(new Date(content.created_at).getTime()) }}</td>
                                <td class="td-actions">
                                    <button class="admin-btn-sm" @click="handlePinContent(content)">
                                        {{ content.pinned ? '取消置顶' : '置顶' }}
                                    </button>
                                    <button class="admin-btn-sm" @click="openEditContent(content)">编辑</button>
                                    <button class="admin-btn-sm admin-btn-sm-danger" @click="handleDeleteContent(content)">删除</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <div v-if="filteredContents.length === 0" class="admin-empty">暂无匹配的内容</div>
                </div>

                <!-- ===== 系统设置 ===== -->
                <div v-if="activeTab === 'settings' && !isLoading" class="admin-section">
                    <h2 class="admin-section-title">系统设置</h2>

                    <div class="settings-card">
                        <div class="settings-card-title">存储概览</div>
                        <div class="storage-grid">
                            <div class="storage-item">
                                <div class="storage-value">{{ storage.totalUsers }}</div>
                                <div class="storage-label">用户数</div>
                            </div>
                            <div class="storage-item">
                                <div class="storage-value">{{ storage.totalContents }}</div>
                                <div class="storage-label">内容数</div>
                            </div>
                            <div class="storage-item">
                                <div class="storage-value">{{ storage.totalImages }}</div>
                                <div class="storage-label">图片数</div>
                            </div>
                            <div class="storage-item">
                                <div class="storage-value">{{ storage.logsCount }}</div>
                                <div class="storage-label">日志条数</div>
                            </div>
                        </div>
                    </div>

                    <div class="settings-card">
                        <div class="settings-card-title">注册控制</div>
                        <div class="setting-row">
                            <div>
                                <div class="setting-label">开放注册</div>
                                <div class="setting-desc">关闭后新用户无法自行注册</div>
                            </div>
                            <label class="toggle-switch">
                                <input type="checkbox" v-model="settings.registration_open">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>

                    <div class="settings-card">
                        <div class="settings-card-title">发布限制</div>
                        <div class="setting-row">
                            <div>
                                <div class="setting-label">每人每日发布上限</div>
                                <div class="setting-desc">0 表示不限制</div>
                            </div>
                            <input type="number" v-model.number="settings.daily_post_limit" class="admin-input-num" min="0" max="100">
                        </div>
                        <div class="setting-row">
                            <div>
                                <div class="setting-label">图片大小上限 (MB)</div>
                                <div class="setting-desc">单张图片最大体积</div>
                            </div>
                            <input type="number" v-model.number="settings.max_image_size" class="admin-input-num" min="1" max="50">
                        </div>
                    </div>

                    <button class="admin-btn admin-btn-primary" @click="handleSaveSettings">保存设置</button>
                </div>

                <!-- ===== 操作日志 ===== -->
                <div v-if="activeTab === 'logs' && !isLoading" class="admin-section">
                    <div class="admin-section-header">
                        <h2 class="admin-section-title">操作日志</h2>
                        <select v-model="logActionFilter" class="admin-select">
                            <option v-for="act in logActions" :key="act.value" :value="act.value">{{ act.label }}</option>
                        </select>
                    </div>
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>时间</th>
                                <th>操作人</th>
                                <th>操作类型</th>
                                <th>目标</th>
                                <th>详情</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="log in filteredLogs" :key="log.id">
                                <td>{{ formatDate(new Date(log.created_at).getTime(), true) }}</td>
                                <td>{{ log.user_name }}</td>
                                <td>
                                    <span class="log-action-tag">{{ logActions.find(a => a.value === log.action)?.label || log.action }}</span>
                                </td>
                                <td>{{ log.target }}</td>
                                <td class="td-detail">{{ log.detail }}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div v-if="filteredLogs.length === 0" class="admin-empty">暂无操作记录</div>
                </div>

                <!-- ===== 数据备份 ===== -->
                <div v-if="activeTab === 'export' && !isLoading" class="admin-section">
                    <h2 class="admin-section-title">数据备份</h2>
                    <p class="admin-section-desc">选择需要导出的内容，生成 Markdown 文件下载到本地</p>

                    <!-- 筛选栏 -->
                    <div class="export-filters">
                        <div class="export-filter-group">
                            <label class="export-filter-label">类型</label>
                            <select v-model="exportTypeFilter" class="admin-select">
                                <option value="all">全部类型</option>
                                <option v-for="(label, type) in typeLabelMap" :key="type" :value="type">{{ label }}</option>
                            </select>
                        </div>
                        <div class="export-filter-group">
                            <label class="export-filter-label">开始日期</label>
                            <input type="date" v-model="exportTimeStart" class="admin-search" style="width:160px">
                        </div>
                        <div class="export-filter-group">
                            <label class="export-filter-label">结束日期</label>
                            <input type="date" v-model="exportTimeEnd" class="admin-search" style="width:160px">
                        </div>
                    </div>

                    <!-- 操作栏 -->
                    <div class="export-toolbar">
                        <label class="export-check-all">
                            <input type="checkbox" v-model="exportSelectAll">
                            <span>全选</span>
                        </label>
                        <span class="export-count">已选 {{ exportCheckedCount }} / {{ exportableContents.length }} 条</span>
                        <button class="admin-btn admin-btn-primary" @click="exportSelectedMarkdown" :disabled="exportCheckedCount === 0">
                            导出选中内容
                        </button>
                    </div>

                    <!-- 内容列表 -->
                    <div class="export-list">
                        <div v-for="c in exportableContents" :key="c.id" class="export-item">
                            <label class="export-item-check">
                                <input type="checkbox" :checked="checkedExportIds.has(c.id)" @change="toggleExportCheck(c.id)">
                            </label>
                            <div class="export-item-info">
                                <div class="export-item-title">{{ c.title }}</div>
                                <div class="export-item-meta">
                                    <span>{{ getContentTypeLabel(c.type) }}</span>
                                    <span class="export-sep">·</span>
                                    <span>{{ getAuthorName(c.author_id) }}</span>
                                    <span class="export-sep">·</span>
                                    <span :style="{ color: getVisibilityColor(c.visibility) }">{{ getVisibilityIcon(c.visibility) }} {{ getVisibilityLabel(c.visibility) }}</span>
                                    <span class="export-sep">·</span>
                                    <span>{{ formatDate(new Date(c.created_at).getTime()) }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-if="exportableContents.length === 0" class="admin-empty">暂无匹配的内容</div>
                </div>

            </div>
        </div>

        <!-- 用户新增/编辑弹窗 -->
        <div v-if="showUserModal" class="admin-modal-overlay" @click.self="showUserModal = false">
            <div class="admin-modal">
                <div class="admin-modal-header">
                    <div class="admin-modal-title">{{ userModalMode === 'add' ? '新增用户' : '编辑用户' }}</div>
                    <button class="admin-modal-close" @click="showUserModal = false">✕</button>
                </div>
                <div class="admin-modal-body">
                    <div class="admin-form-group">
                        <label class="admin-form-label">头像</label>
                        <div class="avatar-picker">
                            <span v-for="a in avatarOptions" :key="a" :class="['avatar-option', { selected: userForm.avatar === a }]" @click="userForm.avatar = a">{{ a }}</span>
                        </div>
                    </div>
                    <div class="admin-form-group">
                        <label class="admin-form-label">邮箱</label>
                        <input v-model="userForm.email" type="email" class="admin-form-input" placeholder="请输入邮箱">
                    </div>
                    <div class="admin-form-group">
                        <label class="admin-form-label">密码{{ userModalMode === 'edit' ? '（留空不修改）' : '' }}</label>
                        <input v-model="userForm.password" type="password" class="admin-form-input" :placeholder="userModalMode === 'edit' ? '留空则不修改密码' : '请输入密码'">
                    </div>
                    <div class="admin-form-group">
                        <label class="admin-form-label">昵称</label>
                        <input v-model="userForm.name" type="text" class="admin-form-input" placeholder="请输入昵称">
                    </div>
                    <div class="admin-form-group">
                        <label class="admin-form-label">等级</label>
                        <select v-model.number="userForm.level" class="admin-form-input">
                            <option v-for="(label, lv) in levelNameMap" :key="lv" :value="lv">{{ label }}</option>
                        </select>
                    </div>
                </div>
                <div class="admin-modal-footer">
                    <button class="admin-btn admin-btn-secondary" @click="showUserModal = false">取消</button>
                    <button class="admin-btn admin-btn-primary" @click="handleSaveUser" :disabled="loading">
                        {{ loading ? '保存中...' : '保存' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- 内容编辑弹窗 -->
        <div v-if="showContentModal" class="admin-modal-overlay" @click.self="showContentModal = false">
            <div class="admin-modal">
                <div class="admin-modal-header">
                    <div class="admin-modal-title">编辑内容</div>
                    <button class="admin-modal-close" @click="showContentModal = false">✕</button>
                </div>
                <div class="admin-modal-body">
                    <div class="admin-form-group">
                        <label class="admin-form-label">标题</label>
                        <input v-model="contentForm.title" type="text" class="admin-form-input">
                    </div>
                    <div v-if="editingContent?.type !== CONTENT_TYPE.ALBUM" class="admin-form-group">
                        <label class="admin-form-label">正文</label>
                        <textarea v-model="contentForm.body" class="admin-form-textarea" rows="6"></textarea>
                    </div>
                    <div v-if="editingContent?.type === CONTENT_TYPE.ALBUM" class="admin-form-group">
                        <label class="admin-form-label">描述</label>
                        <textarea v-model="contentForm.description" class="admin-form-textarea" rows="4"></textarea>
                    </div>
                    <div class="admin-form-group">
                        <label class="admin-form-label">可见性</label>
                        <select v-model="contentForm.visibility" class="admin-form-input">
                            <option v-for="(cfg, key) in visibilityConfig" :key="key" :value="key">{{ cfg.icon }} {{ cfg.label }}</option>
                        </select>
                    </div>
                </div>
                <div class="admin-modal-footer">
                    <button class="admin-btn admin-btn-secondary" @click="showContentModal = false">取消</button>
                    <button class="admin-btn admin-btn-primary" @click="handleSaveContent">保存</button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.admin-panel {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 300;
    background-color: #F5F4F1;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
    color: #2D3436;
}

/* ===== 加载 ===== */
.admin-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    font-size: 16px;
    color: #636E72;
}

/* ===== 顶栏 ===== */
.admin-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    background-color: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid #E8E7E4;
}

.admin-topbar-left {
    display: flex;
    align-items: center;
    gap: 16px;
}

.admin-logo {
    font-size: 18px;
    font-weight: 700;
    color: var(--brand-color, #4A5C6B);
}

.admin-user-tag {
    font-size: 13px;
    color: #636E72;
    padding: 4px 12px;
    background-color: rgba(74, 92, 107, 0.08);
    border-radius: 6px;
}

.admin-close-btn {
    padding: 8px 16px;
    border: 1px solid #E8E7E4;
    border-radius: 8px;
    background: none;
    font-size: 14px;
    color: #636E72;
    cursor: pointer;
    transition: all 0.2s;
}

.admin-close-btn:hover {
    border-color: var(--btn-primary-bg);
    color: var(--btn-primary-bg);
}

/* ===== 主体布局 ===== */
.admin-body {
    display: flex;
    flex: 1;
    overflow: hidden;
}

/* ===== 侧边栏 ===== */
.admin-sidebar {
    width: 200px;
    padding: 20px 12px;
    border-right: 1px solid #E8E7E4;
    background-color: rgba(255, 255, 255, 0.5);
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.admin-nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    color: #636E72;
    transition: all 0.15s;
}

.admin-nav-item:hover {
    background-color: rgba(0, 0, 0, 0.04);
    color: #2D3436;
}

.admin-nav-item.active {
    background-color: rgba(74, 92, 107, 0.1);
    color: var(--brand-color, #4A5C6B);
    font-weight: 600;
}

.admin-nav-icon {
    font-size: 16px;
}

/* ===== 内容区 ===== */
.admin-content {
    flex: 1;
    overflow-y: auto;
    padding: 28px 32px;
}

.admin-section {
    max-width: 1100px;
}

.admin-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 12px;
}

.admin-section-title {
    font-size: 22px;
    font-weight: 700;
    color: #2D3436;
    margin: 0 0 20px 0;
}

.admin-section-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

/* ===== 搜索/下拉 ===== */
.admin-search {
    padding: 8px 14px;
    border: 1px solid #E8E7E4;
    border-radius: 8px;
    font-size: 14px;
    background-color: rgba(255, 255, 255, 0.7);
    color: #2D3436;
    outline: none;
    width: 200px;
}

.admin-search:focus {
    border-color: var(--brand-color, #4A5C6B);
}

.admin-select {
    padding: 8px 12px;
    border: 1px solid #E8E7E4;
    border-radius: 8px;
    font-size: 14px;
    background-color: rgba(255, 255, 255, 0.7);
    color: #2D3436;
    outline: none;
    cursor: pointer;
}

.admin-select-sm {
    padding: 4px 8px;
    border: 1px solid #E8E7E4;
    border-radius: 6px;
    font-size: 13px;
    background-color: rgba(255, 255, 255, 0.5);
    color: #2D3436;
    outline: none;
    cursor: pointer;
}

/* ===== 按钮 ===== */
.admin-btn {
    padding: 8px 18px;
    border-radius: 8px;
    border: none;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: opacity 0.2s;
}

.admin-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.admin-btn-primary {
    background-color: var(--btn-primary-bg);
    color: var(--btn-primary-text);
}

.admin-btn-secondary {
    background-color: var(--btn-secondary-bg);
    color: var(--btn-secondary-text);
}

.admin-btn-sm {
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid #E8E7E4;
    background: none;
    font-size: 13px;
    color: #636E72;
    cursor: pointer;
    transition: all 0.15s;
}

.admin-btn-sm:hover {
    border-color: var(--btn-primary-bg);
    color: var(--btn-primary-bg);
}

.admin-btn-sm-danger:hover {
    border-color: var(--btn-danger-bg);
    color: var(--btn-danger-bg);
}

.admin-btn-sm:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

/* ===== 表格 ===== */
.admin-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
}

.admin-table th {
    text-align: left;
    padding: 10px 14px;
    font-weight: 600;
    font-size: 13px;
    color: #636E72;
    border-bottom: 1px solid #E8E7E4;
    white-space: nowrap;
}

.admin-table td {
    padding: 12px 14px;
    border-bottom: 1px solid #F0EFEC;
    color: #2D3436;
}

.admin-table tr:hover td {
    background-color: rgba(0, 0, 0, 0.02);
}

.admin-table tr.row-pinned td {
    background-color: rgba(74, 92, 107, 0.04);
}

.td-avatar {
    font-size: 20px;
}

.td-title {
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.td-actions {
    display: flex;
    gap: 6px;
    white-space: nowrap;
}

.td-detail {
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #636E72;
    font-size: 13px;
}

.pinned-badge {
    font-size: 16px;
}

.admin-empty {
    text-align: center;
    padding: 40px;
    color: #636E72;
    font-size: 14px;
}

/* ===== 系统设置卡片 ===== */
.settings-card {
    background-color: rgba(255, 255, 255, 0.7);
    border: 1px solid #E8E7E4;
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 16px;
}

.settings-card-title {
    font-size: 16px;
    font-weight: 600;
    color: #2D3436;
    margin-bottom: 16px;
}

.storage-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
}

.storage-item {
    text-align: center;
    padding: 16px;
    background-color: rgba(74, 92, 107, 0.04);
    border-radius: 10px;
}

.storage-value {
    font-size: 28px;
    font-weight: 700;
    color: var(--brand-color, #4A5C6B);
}

.storage-label {
    font-size: 13px;
    color: #636E72;
    margin-top: 4px;
}

.setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 0;
    border-bottom: 1px solid #F0EFEC;
}

.setting-row:last-child {
    border-bottom: none;
}

.setting-label {
    font-size: 15px;
    font-weight: 500;
    color: #2D3436;
}

.setting-desc {
    font-size: 13px;
    color: #636E72;
    margin-top: 2px;
}

.admin-input-num {
    width: 80px;
    padding: 8px 12px;
    border: 1px solid #E8E7E4;
    border-radius: 8px;
    font-size: 14px;
    text-align: center;
    background-color: rgba(255, 255, 255, 0.7);
    color: #2D3436;
    outline: none;
}

.admin-input-num:focus {
    border-color: var(--brand-color, #4A5C6B);
}

/* ===== 开关 ===== */
.toggle-switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 26px;
    cursor: pointer;
}

.toggle-switch input {
    display: none;
}

.toggle-slider {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #D0D0D0;
    border-radius: 26px;
    transition: 0.2s;
}

.toggle-slider::before {
    content: '';
    position: absolute;
    width: 22px;
    height: 22px;
    left: 2px;
    bottom: 2px;
    background-color: white;
    border-radius: 50%;
    transition: 0.2s;
}

.toggle-switch input:checked + .toggle-slider {
    background-color: var(--brand-color, #4A5C6B);
}

.toggle-switch input:checked + .toggle-slider::before {
    transform: translateX(22px);
}

/* ===== 日志标签 ===== */
.log-action-tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    background-color: rgba(74, 92, 107, 0.08);
    color: #636E72;
}

/* ===== 弹窗 ===== */
.admin-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 400;
}

.admin-modal {
    background-color: rgba(255, 255, 255, 0.97);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 14px;
    width: 90%;
    max-width: 480px;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.12);
}

.admin-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid #E8E7E4;
}

.admin-modal-title {
    font-size: 18px;
    font-weight: 600;
    color: #2D3436;
}

.admin-modal-close {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    color: #636E72;
}

.admin-modal-body {
    padding: 24px;
}

.admin-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid #E8E7E4;
}

.admin-form-group {
    margin-bottom: 18px;
}

.admin-form-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: #2D3436;
    margin-bottom: 8px;
}

.admin-form-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #E8E7E4;
    border-radius: 8px;
    font-size: 14px;
    background-color: rgba(255, 255, 255, 0.7);
    color: #2D3436;
    outline: none;
}

.admin-form-input:focus {
    border-color: var(--brand-color, #4A5C6B);
}

.admin-form-textarea {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid #E8E7E4;
    border-radius: 8px;
    font-size: 14px;
    background-color: rgba(255, 255, 255, 0.7);
    color: #2D3436;
    outline: none;
    resize: vertical;
    font-family: inherit;
}

.admin-form-textarea:focus {
    border-color: var(--brand-color, #4A5C6B);
}

/* ===== 头像选择器 ===== */
.avatar-picker {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.avatar-option {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.15s;
    background-color: rgba(0, 0, 0, 0.04);
}

.avatar-option:hover {
    background-color: rgba(74, 92, 107, 0.1);
}

.avatar-option.selected {
    border-color: var(--brand-color, #4A5C6B);
    background-color: rgba(74, 92, 107, 0.12);
}

/* ===== 数据备份 ===== */
.admin-section-desc {
    font-size: 14px; color: #636E72; margin-bottom: 24px;
}

.export-filters {
    display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 20px;
}

.export-filter-group {
    display: flex; flex-direction: column; gap: 6px;
}

.export-filter-label {
    font-size: 13px; color: #636E72; font-weight: 500;
}

.export-toolbar {
    display: flex; align-items: center; gap: 20px;
    padding: 14px 0; border-top: 1px solid #E8E7E4; border-bottom: 1px solid #E8E7E4;
    margin-bottom: 12px;
}

.export-check-all {
    display: flex; align-items: center; gap: 8px;
    font-size: 14px; color: #2D3436; cursor: pointer;
}

.export-check-all input { width: 16px; height: 16px; cursor: pointer; }

.export-count {
    font-size: 14px; color: #636E72; flex: 1;
}

.export-list {
    max-height: 55vh; overflow-y: auto;
}

.export-item {
    display: flex; align-items: center; gap: 14px;
    padding: 12px 4px; border-bottom: 1px solid #F0EFEC;
    transition: background-color 0.15s;
}

.export-item:hover { background-color: rgba(0, 0, 0, 0.02); }

.export-item-check input {
    width: 18px; height: 18px; cursor: pointer; accent-color: var(--brand-color, #4A5C6B);
}

.export-item-info { flex: 1; min-width: 0; }

.export-item-title {
    font-size: 15px; font-weight: 500; color: #2D3436;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    margin-bottom: 4px;
}

.export-item-meta {
    font-size: 13px; color: #636E72; display: flex; gap: 6px; flex-wrap: wrap;
}

.export-sep { color: #D0D0D0; }

/* ===== 响应式 ===== */
@media (max-width: 768px) {
    .admin-sidebar {
        width: 120px;
        padding: 12px 6px;
    }

    .admin-content {
        padding: 16px 12px;
    }

    .admin-nav-item {
        padding: 6px 8px;
        font-size: 12px;
        gap: 6px;
    }

    .storage-grid {
        grid-template-columns: repeat(2, 1fr);
    }

    .admin-search {
        width: 120px;
    }

    .export-filters {
        flex-direction: column; gap: 12px;
    }

    .export-toolbar {
        flex-wrap: wrap; gap: 12px;
    }

    .export-item-title {
        font-size: 14px; max-width: 200px;
    }
}

@media (max-width: 480px) {
    .admin-sidebar {
        width: 80px;
    }

    .admin-nav-item span:not(.admin-nav-icon) {
        display: none;
    }

    .export-item-meta {
        font-size: 12px;
    }
}
</style>

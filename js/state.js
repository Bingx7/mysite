/* ===== js/state.js ===== */

let state = {
    currentUser: null,
    isLoggedIn: false,
    currentTab: CONTENT_TYPE.DIARY,
    filterVisibility: 'all',
    selectedContent: null,
    isModalOpen: false,
    modalMode: 'create',
    loginMode: 'login',
    formImages: [],
    formCover: '',
    isSettingsOpen: false,
    isSidebarOpen: false
};

let renderCallback = null;

/**
 * 设置渲染回调函数
 * @param {Function} callback - 渲染函数
 */
function setRenderCallback(callback) {
    renderCallback = callback;
}

/**
 * 获取当前状态
 * @returns {Object} 状态对象
 */
function getState() {
    return { ...state };
}

/**
 * 更新状态
 * @param {Object} newState - 新状态对象
 */
function setState(newState) {
    state = { ...state, ...newState };
    if (renderCallback) {
        renderCallback();
    }
}

/**
 * 切换当前用户
 * @param {string} userId - 用户ID
 */
function switchUser(userId) {
    const user = getUserById(userId);
    if (user) {
        setState({ 
            currentUser: user, 
            isLoggedIn: true,
            selectedContent: null 
        });
        localStorage.setItem(CONFIG.storageUserKey, JSON.stringify(user));
        showToast(`已切换为 ${user.name}`, 'success');
    }
}

/**
 * 切换为访客模式
 */
function switchToGuest() {
    const guestUser = { 
        id: 'guest', 
        name: '访客', 
        level: LEVEL.GUEST, 
        avatar: '客' 
    };
    setState({ 
        currentUser: guestUser,
        isLoggedIn: false,
        selectedContent: null 
    });
    localStorage.removeItem(CONFIG.storageUserKey);
    showToast('已切换为访客模式', 'success');
}

/**
 * 登录用户
 * @param {Object} user - 用户对象
 */
function login(user) {
    setState({ 
        currentUser: user, 
        isLoggedIn: true,
        selectedContent: null 
    });
    localStorage.setItem(CONFIG.storageUserKey, JSON.stringify(user));
    showToast(`欢迎回来，${user.name}`, 'success');
}

/**
 * 登出用户
 */
function logout() {
    setState({ 
        currentUser: null, 
        isLoggedIn: false,
        selectedContent: null 
    });
    localStorage.removeItem(CONFIG.storageUserKey);
    showToast('已安全退出', 'success');
}

/**
 * 重置状态为初始值
 */
function resetState() {
    state = {
        currentUser: null,
        isLoggedIn: false,
        currentTab: CONTENT_TYPE.DIARY,
        filterVisibility: 'all',
        selectedContent: null,
        isModalOpen: false,
        modalMode: 'create',
        loginMode: 'login',
        formImages: [],
        formCover: ''
    };
    if (renderCallback) {
        renderCallback();
    }
}

/**
 * 加载保存的用户状态
 */
function loadSavedUser() {
    const savedUser = localStorage.getItem(CONFIG.storageUserKey);
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            setState({ currentUser: user, isLoggedIn: true });
        } catch (e) {
            console.error('Failed to load saved user:', e);
        }
    }
}

/**
 * 显示提示消息
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型 success/error/warning
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast show ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2500);
}
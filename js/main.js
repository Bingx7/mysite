/* ===== js/main.js ===== */

/**
 * 初始化应用
 * 加载数据、设置初始state、渲染、绑定事件
 */
function init() {
    loadData();
    setRenderCallback(renderApp);
    
    const theme = loadTheme();
    applyTheme(theme);
    
    const savedUserId = localStorage.getItem('currentUserId');
    let initialUser = null;
    
    if (savedUserId === 'guest') {
        initialUser = { id: 'guest', name: '访客', level: LEVEL.GUEST, avatar: '客' };
    } else if (savedUserId) {
        initialUser = getUserById(savedUserId);
    }
    
    setState({
        currentUser: initialUser,
        isLoggedIn: !!initialUser && initialUser.id !== 'guest',
        currentTab: 'all',
        filterVisibility: 'all',
        selectedContent: null,
        isModalOpen: false,
        modalMode: 'create',
        formImages: [],
        formCover: '',
        loginMode: 'login',
        isSettingsOpen: false,
        isSidebarOpen: false
    });
    
    bindEvents();
    renderApp();
    startClock();
}

/**
 * 启动时钟，每秒更新时间
 */
function startClock() {
    setInterval(() => {
        const timeEl = document.getElementById('headerTime');
        if (timeEl) {
            timeEl.textContent = getCurrentTime();
        }
    }, 1000);
}

/**
 * 绑定所有事件
 */
function bindEvents() {
    document.addEventListener('click', handleClick);
    document.addEventListener('change', handleChange);
    document.addEventListener('submit', handleSubmit);
}

/**
 * 处理点击事件
 * @param {Event} e - 事件对象
 */
function handleClick(e) {
    const target = e.target;
    
    if (target.matches('.login-tab')) {
        handleLoginTabClick(target.dataset.loginMode);
    }
    
    if (target.matches('#guestLogin')) {
        handleGuestLogin();
    }
    
    if (target.matches('.nav-link')) {
        handleNavClick(target.dataset.tab);
    }
    
    if (target.matches('.card')) {
        handleCardClick(target.dataset.contentId);
    }
    
    if (target.matches('#backBtn')) {
        handleBackClick();
    }
    
    if (target.matches('#editBtn')) {
        handleEditClick();
    }
    
    if (target.matches('#deleteBtn')) {
        handleDeleteClick();
    }
    
    if (target.matches('#fab')) {
        handleFabClick();
    }
    
    if (target.matches('#fabSidebar')) {
        handleFabClick();
        setState({ isSidebarOpen: false });
    }
    
    if (target.matches('#modalClose') || target.matches('#modalOverlay')) {
        handleModalClose();
    }
    
    if (target.matches('#modalCancel')) {
        handleModalCancel();
    }
    
    if (target.matches('#modalSubmit')) {
        handleModalSubmit();
    }
    
    if (target.matches('.visibility-option')) {
        handleVisibilityClick(target.dataset.visibility);
    }
    
    if (target.matches('#imageUploadArea')) {
        document.getElementById('imageFileInput')?.click();
    }
    
    if (target.matches('#coverUploadArea')) {
        document.getElementById('coverFileInput')?.click();
    }
    
    if (target.matches('.uploaded-image-remove')) {
        handleImageRemove(parseInt(target.dataset.removeIndex));
    }
    
    if (target.matches('#userInfo')) {
        toggleSidebar();
    }
    
    if (target.matches('#sidebarOverlay')) {
        closeSidebar();
    }
    
    if (target.matches('#logoutBtn')) {
        handleLogout();
    }
    
    if (target.matches('#settingsBtn')) {
        openSettings();
    }
    
    if (target.matches('#menuBtn')) {
        toggleSidebar();
    }
    
    if (target.matches('#settingsClose')) {
        closeSettings();
    }
    
    if (target.matches('#saveSettings')) {
        saveSettings();
    }
    
    if (target.matches('#resetSettings')) {
        resetTheme();
        setState({ isSettingsOpen: false });
        renderApp();
    }
    
    if (target.matches('.brand-color-item')) {
        const color = target.dataset.brandColor;
        const theme = getTheme();
        applyTheme({ ...theme, brandColor: color });
        updateSettingsPanel();
    }
    
    if (target.matches('[data-brightness]')) {
        const brightness = target.dataset.brightness;
        const theme = getTheme();
        applyTheme({ ...theme, brightness });
        updateSettingsPanel();
    }
    
    if (target.matches('[data-card-style]')) {
        const cardStyle = target.dataset.cardStyle;
        const theme = getTheme();
        applyTheme({ ...theme, cardStyle });
        updateSettingsPanel();
    }
    
    if (target.matches('[data-font-size]')) {
        const fontSize = target.dataset.fontSize;
        const theme = getTheme();
        applyTheme({ ...theme, fontSize });
        updateSettingsPanel();
    }
}

/**
 * 处理表单提交事件
 * @param {Event} e - 事件对象
 */
function handleSubmit(e) {
    if (e.target.matches('#loginForm')) {
        e.preventDefault();
        handleLoginSubmit();
    }
}

/**
 * 处理输入变化事件
 * @param {Event} e - 事件对象
 */
function handleChange(e) {
    const target = e.target;
    
    if (target.matches('#imageFileInput')) {
        handleImageUpload(target.files);
    }
    
    if (target.matches('#coverFileInput')) {
        handleCoverUpload(target.files);
    }
    
    if (target.matches('#brandColorInput')) {
        const color = target.value;
        const theme = getTheme();
        applyTheme({ ...theme, brandColor: color });
        updateSettingsPanel();
    }
    
    if (target.matches('#glassSlider')) {
        const value = parseInt(target.value);
        const theme = getTheme();
        applyTheme({ ...theme, glassStrength: value });
        updateSettingsPanel();
    }
}

/**
 * 更新设置面板UI状态
 */
function updateSettingsPanel() {
    const theme = getTheme();
    
    const activeColor = document.querySelector('.brand-color-item.active');
    if (activeColor) activeColor.classList.remove('active');
    const newActiveColor = document.querySelector(`.brand-color-item[data-brand-color="${theme.brandColor}"]`);
    if (newActiveColor) newActiveColor.classList.add('active');
    
    document.querySelectorAll('[data-brightness]').forEach(el => {
        el.classList.toggle('active', el.dataset.brightness === theme.brightness);
    });
    
    document.querySelectorAll('[data-card-style]').forEach(el => {
        el.classList.toggle('active', el.dataset.cardStyle === theme.cardStyle);
    });
    
    document.querySelectorAll('[data-font-size]').forEach(el => {
        el.classList.toggle('active', el.dataset.fontSize === theme.fontSize);
    });
    
    const glassSlider = document.getElementById('glassSlider');
    if (glassSlider) glassSlider.value = theme.glassStrength;
    
    const glassValue = document.querySelector('.glass-value');
    if (glassValue) glassValue.textContent = `${theme.glassStrength}%`;
    
    const colorInput = document.getElementById('brandColorInput');
    if (colorInput) colorInput.value = theme.brandColor;
}

/**
 * 处理登录Tab切换
 * @param {string} mode - 登录模式
 */
function handleLoginTabClick(mode) {
    setState({ loginMode: mode });
}

/**
 * 处理访客登录
 */
function handleGuestLogin() {
    setState({
        currentUser: { id: 'guest', name: '访客', level: LEVEL.GUEST, avatar: '客' },
        isLoggedIn: false,
        selectedContent: null
    });
    localStorage.setItem('currentUserId', 'guest');
}

/**
 * 处理登录表单提交
 */
function handleLoginSubmit() {
    const state = getState();
    const isLogin = state.loginMode === 'login';
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const username = usernameInput?.value;
    const password = passwordInput?.value;
    
    if (!username || !password) return;
    
    if (isLogin) {
        const user = getUsers().find(u => u.username === username && u.password === password);
        if (user) {
            setState({
                currentUser: user,
                isLoggedIn: true,
                selectedContent: null
            });
            localStorage.setItem('currentUserId', user.id);
        } else {
            passwordInput.value = '';
            passwordInput.focus();
            showToast('用户名或密码错误', 'error');
        }
    } else {
        const nameInput = document.getElementById('registerName');
        const name = nameInput?.value;
        if (!name) return;
        
        const users = getUsers();
        if (users.find(u => u.username === username)) {
            showToast('用户名已存在', 'error');
            usernameInput.focus();
            return;
        }
        
        const newUser = {
            id: generateId(),
            username: username,
            password: password,
            name: name,
            level: LEVEL.MEMBER,
            avatar: name.charAt(0)
        };
        
        users.push(newUser);
        saveData();
        
        setState({
            currentUser: newUser,
            isLoggedIn: true,
            selectedContent: null,
            loginMode: 'login'
        });
        localStorage.setItem('currentUserId', newUser.id);
    }
}

/**
 * 显示提示消息
 * @param {string} message - 提示内容
 * @param {string} type - 提示类型（success/error）
 */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 200);
    }, 2500);
}

/**
 * 处理导航点击
 * @param {string} tab - 内容类型或'all'
 */
function handleNavClick(tab) {
    setState({
        currentTab: tab,
        selectedContent: null
    });
}

/**
 * 处理卡片点击
 * @param {string} contentId - 内容ID
 */
function handleCardClick(contentId) {
    const content = getContentById(contentId);
    if (content) {
        setState({ selectedContent: content });
    }
}

/**
 * 处理返回列表点击
 */
function handleBackClick() {
    setState({ selectedContent: null });
}

/**
 * 处理编辑点击
 */
function handleEditClick() {
    const state = getState();
    if (state.selectedContent) {
        const images = getImagesByContentId(state.selectedContent.id);
        setState({
            isModalOpen: true,
            modalMode: 'edit',
            formImages: images.map(img => img.url),
            formCover: state.selectedContent.coverImage || ''
        });
    }
}

/**
 * 处理删除点击
 */
function handleDeleteClick() {
    const state = getState();
    if (state.selectedContent && confirm('确定要删除这条内容吗？')) {
        deleteContent(state.selectedContent.id);
        setState({
            selectedContent: null,
            isModalOpen: false
        });
    }
}

/**
 * 处理浮动按钮点击（发布）
 */
function handleFabClick() {
    setState({
        isModalOpen: true,
        modalMode: 'create',
        formImages: [],
        formCover: ''
    });
}

/**
 * 处理弹窗关闭
 */
function handleModalClose() {
    setState({
        isModalOpen: false,
        formImages: [],
        formCover: ''
    });
}

/**
 * 处理弹窗取消
 */
function handleModalCancel() {
    setState({
        isModalOpen: false,
        formImages: [],
        formCover: ''
    });
}

/**
 * 处理弹窗提交（发布/保存）
 */
function handleModalSubmit() {
    const state = getState();
    const title = document.getElementById('formTitle')?.value;
    const body = document.getElementById('formBody')?.value;
    const description = document.getElementById('formDescription')?.value;
    const startDate = document.getElementById('formStartDate')?.value;
    const endDate = document.getElementById('formEndDate')?.value;
    
    if (!title) {
        alert('请输入标题');
        return;
    }
    
    const selectedVisibility = document.querySelector('.visibility-option.active')?.dataset.visibility || VISIBILITY.PUBLIC;
    
    let contentType = state.currentTab;
    if (contentType === 'all') {
        contentType = CONTENT_TYPE.DIARY;
    }
    
    if (state.modalMode === 'create') {
        createContent({
            type: contentType,
            title: title,
            body: body || '',
            description: description || '',
            visibility: selectedVisibility,
            authorId: state.currentUser.id,
            uploadedImages: state.formImages,
            coverImage: state.formCover,
            startDate: startDate,
            endDate: endDate
        });
    } else {
        updateContent(state.selectedContent.id, {
            title: title,
            body: body || '',
            description: description || '',
            visibility: selectedVisibility,
            coverImage: state.formCover,
            startDate: startDate,
            endDate: endDate,
            uploadedImages: state.formImages
        });
    }
    
    setState({
        isModalOpen: false,
        selectedContent: null,
        formImages: [],
        formCover: ''
    });
}

/**
 * 处理可见性选项点击
 * @param {string} visibility - 可见性类型
 */
function handleVisibilityClick(visibility) {
    const options = document.querySelectorAll('.visibility-option');
    options.forEach(opt => opt.classList.remove('active'));
    const target = document.querySelector(`.visibility-option[data-visibility="${visibility}"]`);
    if (target) {
        target.classList.add('active');
    }
}

/**
 * 处理图片上传
 * @param {FileList} files - 文件列表
 */
function handleImageUpload(files) {
    if (!files || files.length === 0) return;
    
    const state = getState();
    const availableSlots = CONFIG.maxImagesPerContent - state.formImages.length;
    const filesToUpload = Array.from(files).slice(0, availableSlots);
    
    uploadImages(filesToUpload).then(urls => {
        setState({
            formImages: [...state.formImages, ...urls]
        });
    });
}

/**
 * 处理封面图上传
 * @param {FileList} files - 文件列表
 */
function handleCoverUpload(files) {
    if (!files || files.length === 0) return;
    
    uploadImages([files[0]]).then(urls => {
        if (urls.length > 0) {
            setState({ formCover: urls[0] });
        }
    });
}

/**
 * 处理图片删除
 * @param {number} index - 图片索引
 */
function handleImageRemove(index) {
    const state = getState();
    const newImages = state.formImages.filter((_, idx) => idx !== index);
    setState({ formImages: newImages });
}

/**
 * 切换侧边栏显示状态
 */
function toggleSidebar() {
    const state = getState();
    setState({ isSidebarOpen: !state.isSidebarOpen });
}

/**
 * 关闭侧边栏
 */
function closeSidebar() {
    setState({ isSidebarOpen: false });
}

/**
 * 处理登出
 */
function handleLogout() {
    setState({
        currentUser: null,
        isLoggedIn: false,
        selectedContent: null,
        isSidebarOpen: false
    });
    localStorage.removeItem('currentUserId');
}

/**
 * 打开设置面板
 */
function openSettings() {
    setState({ isSettingsOpen: true });
}

/**
 * 关闭设置面板并保存
 */
function closeSettings() {
    saveTheme(getTheme());
    setState({ isSettingsOpen: false });
}

/**
 * 保存设置
 */
function saveSettings() {
    saveTheme(getTheme());
    setState({ isSettingsOpen: false });
}

document.addEventListener('DOMContentLoaded', init);
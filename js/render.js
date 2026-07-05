/* ===== js/render.js ===== */

/**
 * 主渲染入口，根据 state 渲染不同页面
 */
function renderApp() {
    const app = document.getElementById('app');
    if (!app) return;
    
    const state = getState();
    
    if (!state.currentUser) {
        app.innerHTML = renderLoginPage();
    } else {
        app.innerHTML = renderListPage();
    }
    
    if (state.isModalOpen) {
        app.innerHTML += renderModal();
    }
    
    if (state.isSettingsOpen) {
        app.innerHTML += renderSettingsPanel();
    }
    
    if (state.isSidebarOpen) {
        app.innerHTML += renderSidebarOverlay();
        app.innerHTML += renderSidebar();
    }
}

/**
 * 渲染登录/注册页面
 * @returns {string} HTML字符串
 */
function renderLoginPage() {
    const state = getState();
    const isLogin = state.loginMode === 'login';
    
    return `
        <div class="login-page">
            <div class="login-card">
                <div class="login-logo">${CONFIG.siteName}</div>
                <div class="login-subtitle">私密内容记录工具</div>
                
                <div class="login-tabs">
                    <div class="login-tab ${isLogin ? 'active' : ''}" data-login-mode="login">登录</div>
                    <div class="login-tab ${!isLogin ? 'active' : ''}" data-login-mode="register">注册</div>
                </div>
                
                <form class="login-form" id="loginForm">
                    ${!isLogin ? `
                        <div class="form-group">
                            <label class="form-label">昵称</label>
                            <input type="text" class="form-input" id="registerName" placeholder="请输入昵称" required>
                        </div>
                    ` : ''}
                    
                    <div class="form-group">
                        <label class="form-label">用户名</label>
                        <input type="text" class="form-input" id="loginUsername" placeholder="请输入用户名" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">密码</label>
                        <input type="password" class="form-input" id="loginPassword" placeholder="请输入密码" required>
                    </div>
                    
                    <button type="submit" class="btn btn-primary">${isLogin ? '登录' : '注册'}</button>
                </form>
                
                <div class="guest-login">
                    <span class="guest-link" id="guestLogin">以访客身份浏览</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * 渲染列表页面（侧边栏 + 内容列表）
 * @returns {string} HTML字符串
 */
function renderListPage() {
    const state = getState();
    let contents = getVisibleContents(getContents(), state.currentUser);
    
    if (state.currentTab !== 'all') {
        contents = contents.filter(c => c.type === state.currentTab);
    }
    
    contents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return `
        <div class="header">
            <div class="header-content">
                <div class="header-left">
                    <button class="header-btn menu-btn" id="menuBtn">☰</button>
                    <div class="logo">${CONFIG.siteName}</div>
                </div>
                <div class="header-actions">
                    <button class="header-btn" id="settingsBtn">⚙️</button>
                    <div class="header-time" id="headerTime">${getCurrentTime()}</div>
                </div>
            </div>
        </div>
        
        <main class="${state.selectedContent ? 'content-detail' : 'content-list'}">
            ${state.selectedContent ? renderContentDetail(state.selectedContent) : renderContentList(contents)}
        </main>
        
        ${state.isLoggedIn ? `<div class="fab" id="fab">+</div>` : ''}
    `;
}

/**
 * 渲染侧边栏
 * @returns {string} HTML字符串
 */
function renderSidebar() {
    const state = getState();
    
    return `
        <div class="sidebar open">
            <div class="sidebar-header">
                <div class="sidebar-site-name">${CONFIG.siteName}</div>
                <div class="sidebar-user">
                    <div class="user-avatar">${state.currentUser.avatar}</div>
                    <div>
                        <div class="sidebar-user-name">${state.currentUser.name}</div>
                        <div class="sidebar-user-level">${getLevelName(state.currentUser.level)}</div>
                    </div>
                </div>
            </div>
            
            <ul class="nav-list">
                <li class="nav-item">
                    <div class="nav-link ${state.currentTab === 'all' ? 'active' : ''}" data-tab="all">
                        <span class="nav-icon">📋</span>
                        <span>全部</span>
                    </div>
                </li>
                <li class="nav-item">
                    <div class="nav-link ${state.currentTab === CONTENT_TYPE.DIARY ? 'active' : ''}" data-tab="${CONTENT_TYPE.DIARY}">
                        <span class="nav-icon">📔</span>
                        <span>${getContentTypeLabel(CONTENT_TYPE.DIARY)}</span>
                    </div>
                </li>
                <li class="nav-item">
                    <div class="nav-link ${state.currentTab === CONTENT_TYPE.ARTICLE ? 'active' : ''}" data-tab="${CONTENT_TYPE.ARTICLE}">
                        <span class="nav-icon">📝</span>
                        <span>${getContentTypeLabel(CONTENT_TYPE.ARTICLE)}</span>
                    </div>
                </li>
                <li class="nav-item">
                    <div class="nav-link ${state.currentTab === CONTENT_TYPE.ALBUM ? 'active' : ''}" data-tab="${CONTENT_TYPE.ALBUM}">
                        <span class="nav-icon">🖼️</span>
                        <span>${getContentTypeLabel(CONTENT_TYPE.ALBUM)}</span>
                    </div>
                </li>
            </ul>
            
            <div class="sidebar-bottom">
                <button class="sidebar-btn sidebar-btn-primary" id="fabSidebar">+ 新建</button>
                <button class="sidebar-btn sidebar-btn-secondary" id="logoutBtn">退出登录</button>
            </div>
        </div>
    `;
}

/**
 * 渲染侧边栏遮罩层
 * @returns {string} HTML字符串
 */
function renderSidebarOverlay() {
    return `
        <div class="sidebar-overlay open" id="sidebarOverlay"></div>
    `;
}

/**
 * 渲染内容列表
 * @param {Array} contents - 内容数组
 * @returns {string} HTML字符串
 */
function renderContentList(contents) {
    if (contents.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-text">暂无内容</div>
                <div class="empty-state-hint">当前用户没有可见的内容</div>
            </div>
        `;
    }
    
    const state = getState();
    if (state.currentTab === CONTENT_TYPE.ALBUM) {
        return renderAlbumGrid(contents);
    }
    
    return contents.map(content => renderContentCard(content)).join('');
}

/**
 * 渲染照片集网格布局
 * @param {Array} albums - 照片集数组
 * @returns {string} HTML字符串
 */
function renderAlbumGrid(albums) {
    const folderColors = ['#FF6B9D', '#4ECDC4', '#1A535C', '#FFE66D', '#FF9F1C', '#9B5DE5', '#00BBF9', '#00F5D4'];
    
    return `
        <div class="album-grid">
            ${albums.map((album, index) => {
                const images = getImagesByContentId(album.id);
                const color = folderColors[index % folderColors.length];
                const displayImages = images.slice(0, 3);
                
                return `
                    <div class="album-card" data-content-id="${album.id}" style="--folder-color: ${color}">
                        <div class="album-visual">
                            <div class="album-folder">
                                <div class="folder-tab"></div>
                                <div class="folder-content">
                                    ${displayImages.map((img, idx) => `
                                        <div class="folder-image" style="background-image: url(${img.url}); --offset: ${idx * 8}px;">
                                        </div>
                                    `).join('')}
                                    ${images.length === 0 ? '<div class="folder-placeholder">📷</div>' : ''}
                                </div>
                            </div>
                        </div>
                        <div class="album-info">
                            <div class="album-title">${album.title}</div>
                            <div class="album-stats">${images.length} photos</div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * 渲染单张卡片
 * @param {Object} content - 内容对象
 * @returns {string} HTML字符串
 */
function renderContentCard(content) {
    const author = getUserById(content.authorId);
    const images = getImagesByContentId(content.id);
    const isAlbum = content.type === CONTENT_TYPE.ALBUM;
    const theme = getTheme();
    
    let bodyHtml = '';
    if (isAlbum) {
        bodyHtml = `<div class="card-text">${truncateText(content.description, 80)}</div>`;
    } else {
        bodyHtml = `<div class="card-text">${truncateText(content.body, 100)}</div>`;
    }
    
    let imagesHtml = '';
    if (images.length > 0) {
        const displayImages = images.slice(0, 9);
        imagesHtml = `
            <div class="card-images">
                ${displayImages.map((img, idx) => `
                    <div class="card-image ${idx >= 3 && images.length > 3 ? 'more' : ''}" style="background-image: url(${img.url}); background-size: cover;">
                        ${idx >= 3 && images.length > 3 ? `<span>+${images.length - 3}</span>` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    let footerHtml = '';
    if (isAlbum) {
        footerHtml = `
            <div class="album-period">📅 ${formatDateRange(content.startDate, content.endDate)}</div>
            <div class="album-count">🖼️ ${images.length}张照片</div>
        `;
    } else {
        footerHtml = `
            <div>👤 ${author?.name || '未知'}</div>
            <div>📅 ${formatDate(content.createdAt)}</div>
        `;
    }
    
    return `
        <div class="card card-${theme.cardStyle}" data-content-id="${content.id}">
            <div class="card-header">
                <div class="card-title">${content.title}</div>
                <div class="card-meta">
                    ${renderVisibilityTag(content.visibility)}
                    <span>${getContentTypeLabel(content.type)}</span>
                </div>
            </div>
            <div class="card-body">
                ${bodyHtml}
                ${imagesHtml}
            </div>
            <div class="card-footer">
                ${footerHtml}
            </div>
        </div>
    `;
}

/**
 * 渲染内容详情
 * @param {Object} content - 内容对象
 * @returns {string} HTML字符串
 */
function renderContentDetail(content) {
    const state = getState();
    const author = getUserById(content.authorId);
    const images = getImagesByContentId(content.id);
    const isAlbum = content.type === CONTENT_TYPE.ALBUM;
    const canEdit = canEditContent(content, state.currentUser);
    const canDelete = canDeleteContent(content, state.currentUser);
    
    let imagesHtml = '';
    if (images.length > 0) {
        imagesHtml = `
            <div class="detail-images">
                ${images.map(img => `
                    <div class="detail-image"><img src="${img.url}" alt="照片"></div>
                `).join('')}
            </div>
        `;
    }
    
    let periodHtml = '';
    if (isAlbum && content.startDate) {
        periodHtml = `<span>📅 ${formatDateRange(content.startDate, content.endDate)}</span>`;
    }
    
    return `
        <div class="content-detail">
            <div class="detail-header">
                <div class="detail-title">${content.title}</div>
                <div class="detail-meta">
                    ${renderVisibilityTag(content.visibility)}
                    <span>👤 ${author?.name || '未知'}</span>
                    <span>📝 ${getContentTypeLabel(content.type)}</span>
                    <span>⏰ ${formatDate(content.createdAt, true)}</span>
                    ${periodHtml}
                </div>
            </div>
            <div class="detail-body">${isAlbum ? content.description : content.body}</div>
            ${imagesHtml}
            <div class="detail-actions">
                <button class="btn btn-secondary" id="backBtn">← 返回列表</button>
                ${canEdit ? `<button class="btn btn-primary" id="editBtn">✏️ 编辑</button>` : ''}
                ${canDelete ? `<button class="btn btn-danger" id="deleteBtn">🗑️ 删除</button>` : ''}
            </div>
        </div>
    `;
}

/**
 * 渲染弹窗（发布/编辑）
 * @returns {string} HTML字符串
 */
function renderModal() {
    const state = getState();
    const isAlbum = state.currentTab === CONTENT_TYPE.ALBUM || (state.selectedContent?.type === CONTENT_TYPE.ALBUM);
    const isArticle = state.currentTab === CONTENT_TYPE.ARTICLE || (state.selectedContent?.type === CONTENT_TYPE.ARTICLE);
    const content = state.selectedContent;
    const isEdit = state.modalMode === 'edit';
    
    const currentImages = state.formImages;
    const currentCover = state.formCover;
    
    let uploadedImagesHtml = '';
    if (currentImages.length > 0) {
        uploadedImagesHtml = `
            <div class="uploaded-images">
                ${currentImages.map((url, idx) => `
                    <div class="uploaded-image">
                        <img src="${url}" alt="图片${idx + 1}">
                        <button class="uploaded-image-remove" data-remove-index="${idx}">✕</button>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    return `
        <div class="modal-overlay open" id="modalOverlay">
            <div class="modal" id="modal">
                <div class="modal-header">
                    <div class="modal-title">${isEdit ? `编辑${getContentTypeLabel(state.selectedContent?.type || state.currentTab)}` : `发布${getContentTypeLabel(state.currentTab)}`}</div>
                    <button class="modal-close" id="modalClose">✕</button>
                </div>
                <div class="modal-body" id="modalBody">
                    <div class="form-group">
                        <label class="form-label">标题</label>
                        <input type="text" class="form-input" id="formTitle" placeholder="请输入标题" value="${content?.title || ''}" required>
                    </div>
                    
                    ${isAlbum ? `
                        <div class="form-group">
                            <label class="form-label">描述</label>
                            <textarea class="form-textarea" id="formDescription" placeholder="请输入描述">${content?.description || ''}</textarea>
                        </div>
                    ` : `
                        <div class="form-group">
                            <label class="form-label">正文</label>
                            <textarea class="form-textarea" id="formBody" placeholder="请输入正文">${content?.body || ''}</textarea>
                        </div>
                    `}
                    
                    ${isArticle ? `
                        <div class="form-group">
                            <label class="form-label">封面图</label>
                            <div class="image-upload-area ${currentCover ? 'has-images' : ''}" id="coverUploadArea">
                                <div class="image-upload-icon">🖼️</div>
                                <div class="image-upload-text">点击上传封面图</div>
                                <input type="file" id="coverFileInput" accept="image/*" style="display:none;">
                            </div>
                            ${currentCover ? `<img src="${currentCover}" style="width:100%; max-height:200px; object-fit:cover; border-radius:8px; margin-top:8px;">` : ''}
                        </div>
                    ` : ''}
                    
                    ${!isArticle ? `
                        <div class="form-group">
                            <label class="form-label">图片（最多${CONFIG.maxImagesPerContent}张）</label>
                            <div class="image-upload-area ${currentImages.length > 0 ? 'has-images' : ''}" id="imageUploadArea">
                                <div class="image-upload-icon">📷</div>
                                <div class="image-upload-text">点击上传图片</div>
                                <div class="image-upload-count">${currentImages.length}/${CONFIG.maxImagesPerContent}</div>
                                <input type="file" id="imageFileInput" accept="image/*" multiple style="display:none;">
                            </div>
                            ${uploadedImagesHtml}
                        </div>
                    ` : ''}
                    
                    ${isAlbum ? `
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">开始日期</label>
                                <input type="date" class="form-input" id="formStartDate" value="${content?.startDate || ''}">
                            </div>
                            <div class="form-group">
                                <label class="form-label">结束日期</label>
                                <input type="date" class="form-input" id="formEndDate" value="${content?.endDate || ''}">
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="form-group">
                        <label class="form-label">可见性</label>
                        ${renderVisibilityRadio(content?.visibility || VISIBILITY.PUBLIC)}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" id="modalCancel">取消</button>
                    <button class="btn btn-primary" id="modalSubmit">${isEdit ? '保存' : '发布'}</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * 渲染设置面板
 * @returns {string} HTML字符串
 */
function renderSettingsPanel() {
    const theme = getTheme();
    
    return `
        <div class="settings-panel open">
            <div class="settings-modal">
                <div class="settings-header">
                    <div class="settings-title">外观设置</div>
                    <button class="settings-close" id="settingsClose">✕</button>
                </div>
                <div class="settings-body">
                    <div class="settings-section">
                        <div class="settings-section-title">品牌色</div>
                        <div class="brand-colors">
                            ${BRAND_COLORS.map(color => `
                                <div class="brand-color-item ${theme.brandColor === color ? 'active' : ''}" 
                                     style="background-color: ${color}" 
                                     data-brand-color="${color}"></div>
                            `).join('')}
                            <input type="color" class="brand-color-input" value="${theme.brandColor}" id="brandColorInput">
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <div class="settings-section-title">背景亮度</div>
                        <div class="brightness-options">
                            <div class="style-option ${theme.brightness === BRIGHTNESS_MODES.LIGHT ? 'active' : ''}" data-brightness="${BRIGHTNESS_MODES.LIGHT}">亮色</div>
                            <div class="style-option ${theme.brightness === BRIGHTNESS_MODES.NEUTRAL ? 'active' : ''}" data-brightness="${BRIGHTNESS_MODES.NEUTRAL}">中性</div>
                            <div class="style-option ${theme.brightness === BRIGHTNESS_MODES.DARK ? 'active' : ''}" data-brightness="${BRIGHTNESS_MODES.DARK}">暗色</div>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <div class="settings-section-title">毛玻璃强度</div>
                        <div class="glass-slider-container">
                            <input type="range" class="glass-slider" min="0" max="100" value="${theme.glassStrength}" id="glassSlider">
                            <div class="glass-value">${theme.glassStrength}%</div>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <div class="settings-section-title">卡片样式</div>
                        <div class="card-style-options">
                            <div class="style-option ${theme.cardStyle === CARD_STYLES.SHADOW ? 'active' : ''}" data-card-style="${CARD_STYLES.SHADOW}">阴影</div>
                            <div class="style-option ${theme.cardStyle === CARD_STYLES.BORDER ? 'active' : ''}" data-card-style="${CARD_STYLES.BORDER}">边框</div>
                            <div class="style-option ${theme.cardStyle === CARD_STYLES.GLASS ? 'active' : ''}" data-card-style="${CARD_STYLES.GLASS}">毛玻璃</div>
                            <div class="style-option ${theme.cardStyle === CARD_STYLES.TRANSPARENT ? 'active' : ''}" data-card-style="${CARD_STYLES.TRANSPARENT}">透明</div>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <div class="settings-section-title">字体大小</div>
                        <div class="font-size-options">
                            <div class="style-option ${theme.fontSize === FONT_SIZES.SMALL ? 'active' : ''}" data-font-size="${FONT_SIZES.SMALL}">小</div>
                            <div class="style-option ${theme.fontSize === FONT_SIZES.MEDIUM ? 'active' : ''}" data-font-size="${FONT_SIZES.MEDIUM}">中</div>
                            <div class="style-option ${theme.fontSize === FONT_SIZES.LARGE ? 'active' : ''}" data-font-size="${FONT_SIZES.LARGE}">大</div>
                        </div>
                    </div>
                </div>
                <div class="settings-footer">
                    <button class="btn btn-secondary" id="resetSettings">重置默认</button>
                    <button class="btn btn-primary" id="saveSettings">保存</button>
                </div>
            </div>
        </div>
    `;
}

/**
 * 渲染可见性单选按钮
 * @param {string} selected - 当前选中的可见性
 * @returns {string} HTML字符串
 */
function renderVisibilityRadio(selected) {
    const state = getState();
    const availableVisibilities = getAvailableVisibilities(state.currentUser);
    
    return `
        <div class="visibility-options">
            ${Object.values(VISIBILITY).map(v => {
                if (!availableVisibilities.includes(v)) return '';
                const config = visibilityConfig[v];
                const isActive = selected === v;
                return `
                    <div class="visibility-option ${isActive ? 'active' : ''}" data-visibility="${v}">
                        <span class="visibility-option-icon">${config.icon}</span>
                        <span class="visibility-option-label">${config.name}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * 渲染可见性标签
 * @param {string} visibility - 可见性类型
 * @returns {string} HTML字符串
 */
function renderVisibilityTag(visibility) {
    const config = visibilityConfig[visibility];
    return `
        <span class="visibility-tag ${config?.className || ''}">${config?.icon || '❓'} ${config?.name || '未知'}</span>
    `;
}

/**
 * 渲染用户头像
 * @param {Object} user - 用户对象
 * @returns {string} HTML字符串
 */
function renderUserAvatar(user) {
    if (!user) return '';
    return `
        <div class="user-avatar">${user.avatar || user.name.charAt(0)}</div>
    `;
}

/**
 * 渲染等级标签
 * @param {number} level - 等级值
 * @returns {string} HTML字符串
 */
function renderLevelTag(level) {
    return `
        <div class="user-level level-${level}" style="background-color: ${getLevelColor(level)}">
            ${getLevelName(level)}
        </div>
    `;
}
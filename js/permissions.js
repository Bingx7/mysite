/* ===== js/permissions.js ===== */

/**
 * 判断内容对当前用户是否可见（核心权限判断函数）
 * @param {Object} content - 内容对象
 * @param {Object} currentUser - 当前用户对象
 * @returns {boolean} 是否可见
 * 
 * 权限规则：
 * - public → 所有人可见（包括访客，level >= 0）
 * - private → 仅作者本人可见（绝对私密）
 * - partner → 作者本人 或 currentUser.level === 3（高级管理员）
 * - internal → currentUser.level >= 2（管理员及以上）
 * - 游客（currentUser === null）level 视为 0
 */
function isContentVisible(content, currentUser) {
    if (!content) return false;
    
    const userId = currentUser?.id;
    const userLevel = currentUser?.level ?? LEVEL.GUEST;
    const isAuthor = content.authorId === userId;

    switch (content.visibility) {
        case VISIBILITY.PUBLIC:
            return userLevel >= LEVEL.GUEST;
            
        case VISIBILITY.PRIVATE:
            return isAuthor;
            
        case VISIBILITY.PARTNER:
            return isAuthor || userLevel === LEVEL.SUPER_ADMIN;
            
        case VISIBILITY.INTERNAL:
            return userLevel >= LEVEL.ADMIN;
            
        default:
            return false;
    }
}

/**
 * 过滤可见内容列表
 * @param {Array} contents - 内容数组
 * @param {Object} currentUser - 当前用户对象
 * @returns {Array} 可见内容数组
 */
function getVisibleContents(contents, currentUser) {
    if (!Array.isArray(contents)) return [];
    return contents.filter(content => isContentVisible(content, currentUser));
}

/**
 * 判断能否编辑内容
 * @param {Object} content - 内容对象
 * @param {Object} currentUser - 当前用户对象
 * @returns {boolean} 是否能编辑
 * 
 * 编辑权限：作者本人 或 高级管理员（level >= 2）
 */
function canEditContent(content, currentUser) {
    if (!content || !currentUser) return false;
    
    const isAuthor = content.authorId === currentUser.id;
    const hasAdminLevel = currentUser.level >= LEVEL.ADMIN;
    
    return isAuthor || hasAdminLevel;
}

/**
 * 判断能否删除内容
 * @param {Object} content - 内容对象
 * @param {Object} currentUser - 当前用户对象
 * @returns {boolean} 是否能删除
 * 
 * 删除权限：与编辑权限相同
 */
function canDeleteContent(content, currentUser) {
    return canEditContent(content, currentUser);
}

/**
 * 判断用户是否为管理员及以上
 * @param {Object} user - 用户对象
 * @returns {boolean} 是否为管理员
 */
function isAdmin(user) {
    return user && user.level >= LEVEL.ADMIN;
}

/**
 * 判断用户是否为高级管理员
 * @param {Object} user - 用户对象
 * @returns {boolean} 是否为高级管理员
 */
function isSuperAdmin(user) {
    return user && user.level === LEVEL.SUPER_ADMIN;
}

/**
 * 获取用户的可见内容类型列表
 * @param {Object} user - 用户对象
 * @returns {Array} 可见的可见性类型数组
 */
function getAvailableVisibilities(user) {
    if (!user) return [VISIBILITY.PUBLIC];
    
    const visibilities = [VISIBILITY.PUBLIC, VISIBILITY.PRIVATE];
    
    if (isSuperAdmin(user)) {
        visibilities.push(VISIBILITY.PARTNER);
    }
    
    if (isAdmin(user)) {
        visibilities.push(VISIBILITY.INTERNAL);
    }
    
    return visibilities;
}
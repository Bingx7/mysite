/* ===== js/utils.js ===== */

/**
 * 格式化日期
 * @param {string} dateStr - 日期字符串
 * @param {boolean} includeTime - 是否包含时间
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(dateStr, includeTime = false) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    if (includeTime) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    return `${year}-${month}-${day}`;
}

/**
 * 格式化日期范围
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 * @returns {string} 格式化后的日期范围
 */
function formatDateRange(startDate, endDate) {
    if (!startDate) return '';
    if (!endDate || startDate === endDate) {
        return formatDate(startDate);
    }
    return `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
}

/**
 * 截断文本
 * @param {string} text - 原始文本
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的文本
 */
function truncateText(text, maxLength = 100) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * 获取等级名称
 * @param {number} level - 等级值
 * @returns {string} 等级名称
 */
function getLevelName(level) {
    return levelNameMap[level] || '未知';
}

/**
 * 获取等级颜色
 * @param {number} level - 等级值
 * @returns {string} 等级颜色
 */
function getLevelColor(level) {
    return levelColorMap[level] || '#94A3B8';
}

/**
 * 获取可见性标签名称
 * @param {string} visibility - 可见性类型
 * @returns {string} 可见性标签名称
 */
function getVisibilityLabel(visibility) {
    return visibilityConfig[visibility]?.name || '未知';
}

/**
 * 获取可见性图标
 * @param {string} visibility - 可见性类型
 * @returns {string} 可见性图标
 */
function getVisibilityIcon(visibility) {
    return visibilityConfig[visibility]?.icon || '❓';
}

/**
 * 获取可见性CSS类名
 * @param {string} visibility - 可见性类型
 * @returns {string} CSS类名
 */
function getVisibilityClass(visibility) {
    return visibilityConfig[visibility]?.className || '';
}

/**
 * 获取内容类型标签
 * @param {string} type - 内容类型
 * @returns {string} 内容类型标签名称
 */
function getContentTypeLabel(type) {
    return typeLabelMap[type]?.name || '未知';
}

/**
 * 获取内容类型图标
 * @param {string} type - 内容类型
 * @returns {string} 内容类型图标
 */
function getContentTypeIcon(type) {
    return typeLabelMap[type]?.icon || '📄';
}

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
function generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取当前时间戳字符串
 * @returns {string} 时间戳字符串（YYYY-MM-DD HH:mm）
 */
function getCurrentTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/**
 * 获取当前时间（仅时间部分）
 * @returns {string} 当前时间（HH:mm）
 */
function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * 防抖函数
 * @param {Function} fn - 要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(fn, delay = 300) {
    let timer = null;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * 检查是否为空对象
 * @param {Object} obj - 要检查的对象
 * @returns {boolean} 是否为空
 */
function isEmpty(obj) {
    return obj === null || obj === undefined || (Object.keys(obj).length === 0 && obj.constructor === Object);
}

/**
 * 安全获取对象属性
 * @param {Object} obj - 对象
 * @param {string} path - 属性路径，如 'a.b.c'
 * @param {*} defaultValue - 默认值
 * @returns {*} 属性值或默认值
 */
function getSafe(obj, path, defaultValue = undefined) {
    if (!obj) return defaultValue;
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : defaultValue;
    }, obj);
}
/* ===== js/theme.js ===== */

/**
 * 品牌色预设列表
 * @constant
 */
const BRAND_COLORS = [
    '#2C3E50',
    '#5C6B73',
    '#3D4F4A',
    '#8B7E74',
    '#6B4C4C',
    '#4A5D6B',
    '#000000'
];

/**
 * 背景亮度模式
 * @constant
 */
const BRIGHTNESS_MODES = {
    LIGHT: 'light',
    NEUTRAL: 'neutral',
    DARK: 'dark'
};

/**
 * 卡片样式模式
 * @constant
 */
const CARD_STYLES = {
    SHADOW: 'shadow',
    BORDER: 'border',
    TRANSPARENT: 'transparent',
    GLASS: 'glass'
};

/**
 * 字体大小模式
 * @constant
 */
const FONT_SIZES = {
    SMALL: 'small',
    MEDIUM: 'medium',
    LARGE: 'large'
};

/**
 * 默认主题配置
 * @constant
 */
const DEFAULT_THEME = {
    brandColor: '#4A5C6B',
    brightness: BRIGHTNESS_MODES.LIGHT,
    glassStrength: 85,
    cardStyle: CARD_STYLES.GLASS,
    fontSize: FONT_SIZES.MEDIUM
};

/**
 * localStorage 存储键
 * @constant
 */
const THEME_STORAGE_KEY = 'private_content_site_theme';

/**
 * 当前主题配置
 * @type {Object}
 */
let currentTheme = { ...DEFAULT_THEME };

/**
 * 获取背景亮度对应的背景色
 * @param {string} brightness - 亮度模式
 * @returns {string} 背景色
 */
function getBackgroundColor(brightness) {
    switch (brightness) {
        case BRIGHTNESS_MODES.DARK:
            return '#1C1B1A';
        case BRIGHTNESS_MODES.NEUTRAL:
            return '#F0EFEB';
        default:
            return '#F8F7F4';
    }
}

/**
 * 获取背景亮度对应的卡片背景色
 * @param {string} brightness - 亮度模式
 * @returns {string} 卡片背景色
 */
function getCardBackgroundColor(brightness) {
    switch (brightness) {
        case BRIGHTNESS_MODES.DARK:
            return '#2A2928';
        case BRIGHTNESS_MODES.NEUTRAL:
            return '#FFFFFF';
        default:
            return '#FFFFFF';
    }
}

/**
 * 获取背景亮度对应的文字颜色
 * @param {string} brightness - 亮度模式
 * @returns {string} 文字颜色
 */
function getTextColor(brightness) {
    switch (brightness) {
        case BRIGHTNESS_MODES.DARK:
            return '#E8E7E4';
        case BRIGHTNESS_MODES.NEUTRAL:
            return '#1C1B1A';
        default:
            return '#1C1B1A';
    }
}

/**
 * 获取背景亮度对应的辅助文字颜色
 * @param {string} brightness - 亮度模式
 * @returns {string} 辅助文字颜色
 */
function getSecondaryTextColor(brightness) {
    switch (brightness) {
        case BRIGHTNESS_MODES.DARK:
            return '#8A8986';
        case BRIGHTNESS_MODES.NEUTRAL:
            return '#6B6A67';
        default:
            return '#6B6A67';
    }
}

/**
 * 获取背景亮度对应的边框颜色
 * @param {string} brightness - 亮度模式
 * @returns {string} 边框颜色
 */
function getBorderColor(brightness) {
    switch (brightness) {
        case BRIGHTNESS_MODES.DARK:
            return '#3A3938';
        case BRIGHTNESS_MODES.NEUTRAL:
            return '#E8E7E4';
        default:
            return '#E8E7E4';
    }
}

/**
 * 获取字体大小对应的基础字号
 * @param {string} fontSize - 字体大小模式
 * @returns {string} 基础字号
 */
function getFontSize(fontSize) {
    switch (fontSize) {
        case FONT_SIZES.SMALL:
            return '14px';
        case FONT_SIZES.LARGE:
            return '16px';
        default:
            return '15px';
    }
}

/**
 * 获取字体大小对应的标题字号
 * @param {string} fontSize - 字体大小模式
 * @returns {string} 标题字号
 */
function getTitleFontSize(fontSize) {
    switch (fontSize) {
        case FONT_SIZES.SMALL:
            return '16px';
        case FONT_SIZES.LARGE:
            return '20px';
        default:
            return '18px';
    }
}

/**
 * 获取字体大小对应的大号标题字号
 * @param {string} fontSize - 字体大小模式
 * @returns {string} 大号标题字号
 */
function getLargeTitleFontSize(fontSize) {
    switch (fontSize) {
        case FONT_SIZES.SMALL:
            return '20px';
        case FONT_SIZES.LARGE:
            return '26px';
        default:
            return '22px';
    }
}

/**
 * 获取卡片样式对应的CSS类名
 * @param {string} cardStyle - 卡片样式模式
 * @returns {string} CSS类名
 */
function getCardStyleClass(cardStyle) {
    return `card-${cardStyle}`;
}

/**
 * 生成毛玻璃CSS样式
 * @param {number} strength - 毛玻璃强度 0-100
 * @returns {string} CSS样式字符串
 */
function getGlassStyle(strength) {
    const opacity = (strength / 100) * 0.6;
    const blur = Math.round((strength / 100) * 12);
    return `background-color: rgba(255, 255, 255, ${opacity}); backdrop-filter: blur(${blur}px); -webkit-backdrop-filter: blur(${blur}px);`;
}

/**
 * 将主题配置应用到CSS变量
 * @param {Object} theme - 主题配置对象
 */
function applyTheme(theme) {
    const root = document.documentElement;
    
    root.style.setProperty('--brand-color', theme.brandColor);
    root.style.setProperty('--bg-color', getBackgroundColor(theme.brightness));
    root.style.setProperty('--card-bg-color', getCardBackgroundColor(theme.brightness));
    root.style.setProperty('--text-color', getTextColor(theme.brightness));
    root.style.setProperty('--text-secondary-color', getSecondaryTextColor(theme.brightness));
    root.style.setProperty('--border-color', getBorderColor(theme.brightness));
    root.style.setProperty('--font-size', getFontSize(theme.fontSize));
    root.style.setProperty('--title-font-size', getTitleFontSize(theme.fontSize));
    root.style.setProperty('--large-title-font-size', getLargeTitleFontSize(theme.fontSize));
    root.style.setProperty('--card-style', theme.cardStyle);
    root.style.setProperty('--glass-opacity', (theme.glassStrength / 100) * 0.6);
    root.style.setProperty('--glass-blur', Math.round((theme.glassStrength / 100) * 12) + 'px');
    
    currentTheme = { ...theme };
}

/**
 * 从localStorage加载主题配置
 * @returns {Object} 主题配置对象
 */
function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) {
        try {
            const theme = JSON.parse(savedTheme);
            return { ...DEFAULT_THEME, ...theme };
        } catch (e) {
            console.error('Failed to load theme from localStorage:', e);
            return { ...DEFAULT_THEME };
        }
    }
    return { ...DEFAULT_THEME };
}

/**
 * 保存主题配置到localStorage
 * @param {Object} theme - 主题配置对象
 */
function saveTheme(theme) {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    applyTheme(theme);
}

/**
 * 获取当前主题配置
 * @returns {Object} 当前主题配置
 */
function getTheme() {
    return { ...currentTheme };
}

/**
 * 重置主题为默认值
 */
function resetTheme() {
    saveTheme({ ...DEFAULT_THEME });
}
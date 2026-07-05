/* ===== js/config.js ===== */

/**
 * 站点配置对象
 * @constant
 */
const CONFIG = {
    siteName: '我的小站',
    maxImagesPerContent: 9,
    dateFormat: 'YYYY-MM-DD',
    dateTimeFormat: 'YYYY-MM-DD HH:mm',
    storageKey: 'private_content_site_data',
    storageUserKey: 'private_content_site_current_user'
};

/**
 * 用户等级常量
 * @constant
 */
const LEVEL = {
    GUEST: 0,
    MEMBER: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
    SECONDARY_ADMIN: 4
};

/**
 * 可见性常量
 * @constant
 */
const VISIBILITY = {
    PUBLIC: 'public',
    PRIVATE: 'private',
    PARTNER: 'partner',
    INTERNAL: 'internal'
};

/**
 * 内容类型常量
 * @constant
 */
const CONTENT_TYPE = {
    DIARY: 'diary',
    ARTICLE: 'article',
    ALBUM: 'album'
};

/**
 * 等级名称映射
 * @constant
 */
const levelNameMap = {
    [LEVEL.GUEST]: '访客',
    [LEVEL.MEMBER]: '普通会员',
    [LEVEL.ADMIN]: '管理员',
    [LEVEL.SUPER_ADMIN]: '高级管理员',
    [LEVEL.SECONDARY_ADMIN]: '副管理员'
};

/**
 * 等级颜色映射
 * @constant
 */
const levelColorMap = {
    [LEVEL.GUEST]: '#94A3B8',
    [LEVEL.MEMBER]: '#3B82F6',
    [LEVEL.ADMIN]: '#F59E0B',
    [LEVEL.SUPER_ADMIN]: '#10B981',
    [LEVEL.SECONDARY_ADMIN]: '#EC4899'
};

/**
 * 可见性配置
 * @constant
 */
const visibilityConfig = {
    [VISIBILITY.PUBLIC]: { 
        name: '开放', 
        icon: '🌍', 
        color: '#10B981', 
        className: 'visibility-public' 
    },
    [VISIBILITY.PRIVATE]: { 
        name: '私密', 
        icon: '🔒', 
        color: '#64748B', 
        className: 'visibility-private' 
    },
    [VISIBILITY.PARTNER]: { 
        name: '伴侣', 
        icon: '💑', 
        color: '#EC4899', 
        className: 'visibility-partner' 
    },
    [VISIBILITY.INTERNAL]: { 
        name: '内部', 
        icon: '🏢', 
        color: '#F59E0B', 
        className: 'visibility-internal' 
    }
};

/**
 * 内容类型标签映射
 * @constant
 */
const typeLabelMap = {
    [CONTENT_TYPE.DIARY]: { name: '日记', icon: '📔' },
    [CONTENT_TYPE.ARTICLE]: { name: '文章', icon: '📝' },
    [CONTENT_TYPE.ALBUM]: { name: '照片集', icon: '🖼️' }
};
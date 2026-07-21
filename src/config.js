export const CONFIG = {
    siteName: '我的小站',
    maxImagesPerContent: 9,
    dateFormat: 'YYYY-MM-DD'
};

export const LEVEL = {
    GUEST: 0,
    MEMBER: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
    SECONDARY_ADMIN: 4
};

export const VISIBILITY = {
    PUBLIC: 'public',
    PRIVATE: 'private',
    PARTNER: 'partner',
    INTERNAL: 'internal'
};

export const CONTENT_TYPE = {
    DIARY: 'diary',
    ARTICLE: 'article',
    ALBUM: 'album'
};

export const levelNameMap = {
    [LEVEL.GUEST]: '访客',
    [LEVEL.MEMBER]: '普通用户',
    [LEVEL.ADMIN]: '管理员',
    [LEVEL.SUPER_ADMIN]: '高级管理员',
    [LEVEL.SECONDARY_ADMIN]: '次级管理员'
};

export const levelColorMap = {
    [LEVEL.GUEST]: '#9CA3AF',
    [LEVEL.MEMBER]: '#10B981',
    [LEVEL.ADMIN]: '#3B82F6',
    [LEVEL.SUPER_ADMIN]: '#EC4899',
    [LEVEL.SECONDARY_ADMIN]: '#8B5CF6'
};

export const visibilityConfig = {
    [VISIBILITY.PUBLIC]: { label: '开放', icon: '🌍', color: '#10B981' },
    [VISIBILITY.PRIVATE]: { label: '私密', icon: '🔒', color: '#EF4444' },
    [VISIBILITY.PARTNER]: { label: '伴侣可见', icon: '💑', color: '#EC4899' },
    [VISIBILITY.INTERNAL]: { label: '内部', icon: '🏢', color: '#3B82F6' }
};

export const typeLabelMap = {
    all: '全部',
    [CONTENT_TYPE.DIARY]: '日记',
    [CONTENT_TYPE.ARTICLE]: '文章',
    [CONTENT_TYPE.ALBUM]: '照片集'
};
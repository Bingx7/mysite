import { CONFIG, LEVEL, VISIBILITY, CONTENT_TYPE } from './config';

let users = [];
let contents = [];
let contentImages = [];

export function getDefaultUsers() {
    return [
        { id: 'user_1', name: '小明', username: 'xiaoming', password: '123456', level: LEVEL.SUPER_ADMIN, avatar: '👨' },
        { id: 'user_2', name: '小红', username: 'xiaohong', password: '123456', level: LEVEL.SUPER_ADMIN, avatar: '👩' },
        { id: 'user_3', name: '小刚', username: 'xiaogang', password: '123456', level: LEVEL.MEMBER, avatar: '👨‍💼' },
        { id: 'user_4', name: '管理员', username: 'admin', password: '123456', level: LEVEL.ADMIN, avatar: '🧑‍💼' },
        { id: 'user_5', name: '次级管理员', username: 'subadmin', password: '123456', level: LEVEL.SECONDARY_ADMIN, avatar: '👩‍💼' }
    ];
}

export function getDefaultContents() {
    return [
        { id: 'content_1', authorId: 'user_1', type: CONTENT_TYPE.DIARY, title: '今天的心情', body: '今天阳光明媚，心情很好。去公园散步了，看到了很多漂亮的花。', visibility: VISIBILITY.PUBLIC, createdAt: Date.now() - 86400000 },
        { id: 'content_2', authorId: 'user_1', type: CONTENT_TYPE.DIARY, title: '工作日记', body: '今天完成了一个重要的项目，团队协作很顺利。晚上和同事一起聚餐庆祝。', visibility: VISIBILITY.PRIVATE, createdAt: Date.now() - 172800000 },
        { id: 'content_3', authorId: 'user_2', type: CONTENT_TYPE.DIARY, title: '旅行日记', body: '这次旅行非常愉快，看到了很多美丽的风景。期待下次旅行！', visibility: VISIBILITY.PARTNER, createdAt: Date.now() - 259200000 },
        { id: 'content_4', authorId: 'user_2', type: CONTENT_TYPE.DIARY, title: '学习笔记', body: '今天学习了Vue 3的组合式API，感觉很强大。继续加油！', visibility: VISIBILITY.INTERNAL, createdAt: Date.now() - 345600000 },
        { id: 'content_5', authorId: 'user_3', type: CONTENT_TYPE.ARTICLE, title: '前端开发入门指南', body: '这是一篇关于前端开发入门的文章，适合新手阅读。涵盖HTML、CSS、JavaScript基础知识。', visibility: VISIBILITY.PUBLIC, createdAt: Date.now() - 432000000 },
        { id: 'content_6', authorId: 'user_3', type: CONTENT_TYPE.ARTICLE, title: 'JavaScript高级技巧', body: '本文介绍一些JavaScript的高级技巧，帮助你写出更优雅的代码。', visibility: VISIBILITY.PRIVATE, createdAt: Date.now() - 518400000 },
        { id: 'content_7', authorId: 'user_4', type: CONTENT_TYPE.ARTICLE, title: '团队管理心得', body: '作为团队管理者，分享一些管理心得和经验。', visibility: VISIBILITY.PARTNER, createdAt: Date.now() - 604800000 },
        { id: 'content_8', authorId: 'user_4', type: CONTENT_TYPE.ARTICLE, title: '项目复盘总结', body: '对最近完成的项目进行复盘，总结经验教训。', visibility: VISIBILITY.INTERNAL, createdAt: Date.now() - 691200000 },
        { id: 'content_9', authorId: 'user_5', type: CONTENT_TYPE.ALBUM, title: '周末出游', description: '周末和朋友一起去郊外游玩，拍了很多美丽的照片。', startDate: Date.now() - 777600000, endDate: Date.now() - 777600000 + 86400000, visibility: VISIBILITY.PUBLIC, createdAt: Date.now() - 777600000 },
        { id: 'content_10', authorId: 'user_5', type: CONTENT_TYPE.ALBUM, title: '家庭聚会', description: '和家人一起度过了一个温馨的周末。', startDate: Date.now() - 864000000, endDate: Date.now() - 864000000 + 86400000, visibility: VISIBILITY.PRIVATE, createdAt: Date.now() - 864000000 },
        { id: 'content_11', authorId: 'user_1', type: CONTENT_TYPE.ALBUM, title: '海边度假', description: '在海边度过了一个难忘的假期，阳光、沙滩、海浪...', startDate: Date.now() - 950400000, endDate: Date.now() - 950400000 + 604800000, visibility: VISIBILITY.PARTNER, createdAt: Date.now() - 950400000 },
        { id: 'content_12', authorId: 'user_2', type: CONTENT_TYPE.ALBUM, title: '公司年会', description: '一年一度的公司年会，大家玩得很开心！', startDate: Date.now() - 1036800000, endDate: Date.now() - 1036800000 + 86400000, visibility: VISIBILITY.INTERNAL, createdAt: Date.now() - 1036800000 }
    ];
}

export function getDefaultImages() {
    return [
        { id: 'img_1', contentId: 'content_9', url: 'https://picsum.photos/400/300?random=1', caption: '风景照' },
        { id: 'img_2', contentId: 'content_9', url: 'https://picsum.photos/400/300?random=2', caption: '风景照' },
        { id: 'img_3', contentId: 'content_9', url: 'https://picsum.photos/400/300?random=3', caption: '风景照' },
        { id: 'img_4', contentId: 'content_10', url: 'https://picsum.photos/400/300?random=4', caption: '家庭照' },
        { id: 'img_5', contentId: 'content_10', url: 'https://picsum.photos/400/300?random=5', caption: '家庭照' },
        { id: 'img_6', contentId: 'content_11', url: 'https://picsum.photos/400/300?random=6', caption: '海边照' },
        { id: 'img_7', contentId: 'content_11', url: 'https://picsum.photos/400/300?random=7', caption: '海边照' },
        { id: 'img_8', contentId: 'content_11', url: 'https://picsum.photos/400/300?random=8', caption: '海边照' },
        { id: 'img_9', contentId: 'content_12', url: 'https://picsum.photos/400/300?random=9', caption: '年会照' },
        { id: 'img_10', contentId: 'content_12', url: 'https://picsum.photos/400/300?random=10', caption: '年会照' },
        { id: 'img_11', contentId: 'content_1', url: 'https://picsum.photos/400/300?random=11', caption: '心情照' },
        { id: 'img_12', contentId: 'content_5', url: 'https://picsum.photos/400/300?random=12', caption: '封面图' }
    ];
}

export function loadData() {
    const stored = localStorage.getItem(CONFIG.storageKey);
    if (stored) {
        try {
            const data = JSON.parse(stored);
            users = data.users || getDefaultUsers();
            contents = data.contents || getDefaultContents();
            contentImages = data.contentImages || getDefaultImages();
        } catch {
            users = getDefaultUsers();
            contents = getDefaultContents();
            contentImages = getDefaultImages();
        }
    } else {
        users = getDefaultUsers();
        contents = getDefaultContents();
        contentImages = getDefaultImages();
        saveData();
    }
}

export function saveData() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify({
        users,
        contents,
        contentImages
    }));
}

export function getUsers() { return users; }
export function getContents() { return contents; }
export function getImages() { return contentImages; }

export function getContentById(id) {
    return contents.find(c => c.id === id);
}

export function getUserById(id) {
    return users.find(u => u.id === id);
}

export function getUserByUsername(username) {
    return users.find(u => u.username === username);
}

export function addUser(user) {
    users.push(user);
    saveData();
}

export function addContent(content) {
    contents.push(content);
    saveData();
}

export function updateContent(id, data) {
    const index = contents.findIndex(c => c.id === id);
    if (index !== -1) {
        contents[index] = { ...contents[index], ...data };
        saveData();
    }
}

export function deleteContent(id) {
    contents = contents.filter(c => c.id !== id);
    contentImages = contentImages.filter(img => img.contentId !== id);
    saveData();
}

export function addImages(newImages) {
    contentImages.push(...newImages);
    saveData();
}

export function deleteImagesByContentId(contentId) {
    contentImages = contentImages.filter(img => img.contentId !== contentId);
    saveData();
}
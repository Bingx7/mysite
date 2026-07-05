/* ===== js/data.js ===== */

let users = [];
let contents = [];
let content_images = [];

/**
 * 获取默认用户数据
 * @returns {Array} 用户数组
 */
function getDefaultUsers() {
    return [
        { id: 'user_1', name: '小明', level: LEVEL.SUPER_ADMIN, avatar: '明', username: 'xiaoming', password: '123456' },
        { id: 'user_2', name: '小红', level: LEVEL.SUPER_ADMIN, avatar: '红', username: 'xiaohong', password: '123456' },
        { id: 'user_3', name: '小刚', level: LEVEL.MEMBER, avatar: '刚', username: 'xiaogang', password: '123456' },
        { id: 'user_4', name: '小华', level: LEVEL.ADMIN, avatar: '华', username: 'xiaohua', password: '123456' },
        { id: 'user_5', name: '小李', level: LEVEL.MEMBER, avatar: '李', username: 'xiaoli', password: '123456' }
    ];
}

/**
 * 获取默认内容数据
 * @returns {Array} 内容数组
 */
function getDefaultContents() {
    return [
        { id: 'content_1', type: CONTENT_TYPE.DIARY, title: '今天天气真好', body: '阳光明媚，心情舒畅。下午去公园散步，看到了很多漂亮的花。春天真的来了！', visibility: VISIBILITY.PUBLIC, authorId: 'user_1', createdAt: '2026-07-01 14:30' },
        { id: 'content_2', type: CONTENT_TYPE.DIARY, title: '私密日记：我的小秘密', body: '这是我最私密的想法，只有我自己能看到...', visibility: VISIBILITY.PRIVATE, authorId: 'user_1', createdAt: '2026-07-02 22:15' },
        { id: 'content_3', type: CONTENT_TYPE.DIARY, title: '给小红的悄悄话', body: '亲爱的，今天特别想你。我们在一起的日子总是那么美好。', visibility: VISIBILITY.PARTNER, authorId: 'user_1', createdAt: '2026-07-03 20:00' },
        { id: 'content_4', type: CONTENT_TYPE.DIARY, title: '管理员会议记录', body: '今天召开了月度管理员会议，讨论了网站安全和用户管理事宜。', visibility: VISIBILITY.INTERNAL, authorId: 'user_4', createdAt: '2026-07-04 10:00' },
        { id: 'content_5', type: CONTENT_TYPE.ARTICLE, title: '前端开发最佳实践', body: '本文介绍了现代前端开发的一些最佳实践，包括代码组织、性能优化、安全防护等方面的内容。希望能对大家有所帮助。', visibility: VISIBILITY.PUBLIC, authorId: 'user_3', createdAt: '2026-06-28 09:00', coverImage: 'img_4' },
        { id: 'content_6', type: CONTENT_TYPE.ARTICLE, title: '我的技术成长之路', body: '从大学毕业到现在，我在技术道路上走了很多年。这篇文章记录了我的成长历程和心得体会。', visibility: VISIBILITY.PRIVATE, authorId: 'user_3', createdAt: '2026-06-29 15:30', coverImage: '' },
        { id: 'content_7', type: CONTENT_TYPE.ARTICLE, title: '给小红的技术分享', body: '亲爱的，这是我整理的一些技术笔记，希望对你有帮助。', visibility: VISIBILITY.PARTNER, authorId: 'user_1', createdAt: '2026-07-01 11:00', coverImage: 'img_5' },
        { id: 'content_8', type: CONTENT_TYPE.ARTICLE, title: '内部技术文档：系统架构设计', body: '本文档详细描述了系统的整体架构设计，包括微服务拆分、数据库设计、缓存策略等。', visibility: VISIBILITY.INTERNAL, authorId: 'user_4', createdAt: '2026-07-02 14:00', coverImage: '' },
        { id: 'content_9', type: CONTENT_TYPE.ALBUM, title: '周末出游照片', description: '和家人一起去郊外游玩，拍了很多美好的瞬间。', visibility: VISIBILITY.PUBLIC, authorId: 'user_5', createdAt: '2026-07-03 18:00', startDate: '2026-07-02', endDate: '2026-07-03' },
        { id: 'content_10', type: CONTENT_TYPE.ALBUM, title: '我的私人相册', description: '这是我的私人照片集，记录了一些珍贵的回忆。', visibility: VISIBILITY.PRIVATE, authorId: 'user_2', createdAt: '2026-07-01 16:00', startDate: '2026-01-01', endDate: '2026-07-01' },
        { id: 'content_11', type: CONTENT_TYPE.ALBUM, title: '我们的旅行纪念', description: '和小明一起去旅行的美好回忆，只属于我们两个人。', visibility: VISIBILITY.PARTNER, authorId: 'user_2', createdAt: '2026-06-25 20:00', startDate: '2026-06-20', endDate: '2026-06-25' },
        { id: 'content_12', type: CONTENT_TYPE.ALBUM, title: '团建活动照片', description: '公司团建活动记录，仅供内部参考。', visibility: VISIBILITY.INTERNAL, authorId: 'user_4', createdAt: '2026-06-20 10:00', startDate: '2026-06-18', endDate: '2026-06-20' },
        { id: 'content_13', type: CONTENT_TYPE.DIARY, title: '小刚的公开日记', body: '今天工作顺利完成，感觉很充实。', visibility: VISIBILITY.PUBLIC, authorId: 'user_3', createdAt: '2026-07-04 18:00' },
        { id: 'content_14', type: CONTENT_TYPE.DIARY, title: '小红的私密日记', body: '今天心情不太好，需要好好休息一下。', visibility: VISIBILITY.PRIVATE, authorId: 'user_2', createdAt: '2026-07-04 23:00' },
        { id: 'content_15', type: CONTENT_TYPE.ARTICLE, title: '小红的公开文章', body: '分享一下我的生活感悟...', visibility: VISIBILITY.PUBLIC, authorId: 'user_2', createdAt: '2026-07-03 10:00', coverImage: 'img_21' }
    ];
}

/**
 * 获取默认图片数据
 * @returns {Array} 图片数组
 */
function getDefaultImages() {
    return [
        { id: 'img_1', contentId: 'content_1', url: 'https://picsum.photos/seed/img1/400/400' },
        { id: 'img_2', contentId: 'content_3', url: 'https://picsum.photos/seed/img2/400/400' },
        { id: 'img_3', contentId: 'content_3', url: 'https://picsum.photos/seed/img3/400/400' },
        { id: 'img_4', contentId: 'content_5', url: 'https://picsum.photos/seed/img4/800/400' },
        { id: 'img_5', contentId: 'content_7', url: 'https://picsum.photos/seed/img5/800/400' },
        { id: 'img_6', contentId: 'content_9', url: 'https://picsum.photos/seed/img6/400/400' },
        { id: 'img_7', contentId: 'content_9', url: 'https://picsum.photos/seed/img7/400/400' },
        { id: 'img_8', contentId: 'content_9', url: 'https://picsum.photos/seed/img8/400/400' },
        { id: 'img_9', contentId: 'content_9', url: 'https://picsum.photos/seed/img9/400/400' },
        { id: 'img_10', contentId: 'content_10', url: 'https://picsum.photos/seed/img10/400/400' },
        { id: 'img_11', contentId: 'content_10', url: 'https://picsum.photos/seed/img11/400/400' },
        { id: 'img_12', contentId: 'content_11', url: 'https://picsum.photos/seed/img12/400/400' },
        { id: 'img_13', contentId: 'content_11', url: 'https://picsum.photos/seed/img13/400/400' },
        { id: 'img_14', contentId: 'content_11', url: 'https://picsum.photos/seed/img14/400/400' },
        { id: 'img_15', contentId: 'content_11', url: 'https://picsum.photos/seed/img15/400/400' },
        { id: 'img_16', contentId: 'content_11', url: 'https://picsum.photos/seed/img16/400/400' },
        { id: 'img_17', contentId: 'content_12', url: 'https://picsum.photos/seed/img17/400/400' },
        { id: 'img_18', contentId: 'content_12', url: 'https://picsum.photos/seed/img18/400/400' },
        { id: 'img_19', contentId: 'content_12', url: 'https://picsum.photos/seed/img19/400/400' },
        { id: 'img_20', contentId: 'content_14', url: 'https://picsum.photos/seed/img20/400/400' },
        { id: 'img_21', contentId: 'content_15', url: 'https://picsum.photos/seed/img21/800/400' }
    ];
}

/**
 * 从 localStorage 加载数据，若无则用默认数据并保存
 */
function loadData() {
    const savedData = localStorage.getItem(CONFIG.storageKey);
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            users = data.users || getDefaultUsers();
            contents = data.contents || getDefaultContents();
            content_images = data.content_images || getDefaultImages();
        } catch (e) {
            console.error('Failed to load data from localStorage:', e);
            resetToDefaults();
        }
    } else {
        resetToDefaults();
    }
}

/**
 * 将数据重置为默认值并保存
 */
function resetToDefaults() {
    users = getDefaultUsers();
    contents = getDefaultContents();
    content_images = getDefaultImages();
    saveData();
}

/**
 * 将数据存入 localStorage
 */
function saveData() {
    const data = {
        users,
        contents,
        content_images
    };
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
}

/**
 * 获取所有用户列表
 * @returns {Array} 用户数组
 */
function getUsers() {
    return users;
}

/**
 * 获取所有内容列表
 * @returns {Array} 内容数组
 */
function getContents() {
    return contents;
}

/**
 * 获取所有图片列表
 * @returns {Array} 图片数组
 */
function getImages() {
    return content_images;
}

/**
 * 根据ID获取内容
 * @param {string} id - 内容ID
 * @returns {Object|null} 内容对象或null
 */
function getContentById(id) {
    return contents.find(c => c.id === id) || null;
}

/**
 * 根据ID获取用户
 * @param {string} id - 用户ID
 * @returns {Object|null} 用户对象或null
 */
function getUserById(id) {
    return users.find(u => u.id === id) || null;
}

/**
 * 根据用户名查找用户
 * @param {string} username - 用户名
 * @returns {Object|null} 用户对象或null
 */
function getUserByUsername(username) {
    return users.find(u => u.username === username) || null;
}

/**
 * 添加新用户（注册）
 * @param {Object} userData - 用户数据
 * @returns {Object} 新用户对象
 */
function addUser(userData) {
    const newUser = {
        id: `user_${Date.now()}`,
        name: userData.name,
        username: userData.username,
        password: userData.password,
        level: LEVEL.MEMBER,
        avatar: userData.name.charAt(0)
    };
    users.push(newUser);
    saveData();
    return newUser;
}
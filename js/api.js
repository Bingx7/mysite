/* ===== js/api.js ===== */

/**
 * 根据类型获取内容列表
 * @param {string} type - 内容类型
 * @returns {Array} 内容数组
 * TODO: 接 Supabase API
 */
function getContentsByType(type) {
    return getContents().filter(c => c.type === type);
}

/**
 * 根据可见性筛选内容
 * @param {string} visibility - 可见性类型
 * @returns {Array} 内容数组
 * TODO: 接 Supabase API
 */
function getContentsByVisibility(visibility) {
    return getContents().filter(c => c.visibility === visibility);
}

/**
 * 获取内容关联的图片
 * @param {string} contentId - 内容ID
 * @returns {Array} 图片数组
 * TODO: 接 Supabase API
 */
function getImagesByContentId(contentId) {
    return getImages().filter(img => img.contentId === contentId);
}

/**
 * 新建内容（含图片）
 * @param {Object} data - 内容数据
 * @returns {Object} 创建的内容对象
 * TODO: 接 Supabase API
 */
function createContent(data) {
    const now = new Date();
    const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const content = {
        id: generateId(),
        type: data.type,
        title: data.title,
        body: data.body || '',
        description: data.description || '',
        visibility: data.visibility,
        authorId: data.authorId,
        createdAt: createdAt,
        coverImage: data.coverImage || '',
        startDate: data.startDate || '',
        endDate: data.endDate || ''
    };
    
    const contents = getContents();
    contents.unshift(content);
    
    if (data.uploadedImages && data.uploadedImages.length > 0) {
        const images = getImages();
        data.uploadedImages.forEach((url, index) => {
            images.push({
                id: generateId(),
                contentId: content.id,
                url: url
            });
        });
    }
    
    saveData();
    return content;
}

/**
 * 更新内容
 * @param {string} id - 内容ID
 * @param {Object} data - 更新数据
 * @returns {Object|null} 更新后的内容对象或null
 * TODO: 接 Supabase API
 */
function updateContent(id, data) {
    const contents = getContents();
    const index = contents.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    contents[index] = { ...contents[index], ...data };
    
    if (data.uploadedImages) {
        const images = getImages();
        images = images.filter(img => img.contentId !== id);
        data.uploadedImages.forEach(url => {
            images.push({
                id: generateId(),
                contentId: id,
                url: url
            });
        });
    }
    
    saveData();
    return contents[index];
}

/**
 * 删除内容及关联图片
 * @param {string} id - 内容ID
 * @returns {boolean} 是否删除成功
 * TODO: 接 Supabase API
 */
function deleteContent(id) {
    const contents = getContents();
    const index = contents.findIndex(c => c.id === id);
    if (index === -1) return false;
    
    contents.splice(index, 1);
    
    const images = getImages();
    const filteredImages = images.filter(img => img.contentId !== id);
    while (images.length > 0) {
        images.pop();
    }
    filteredImages.forEach(img => images.push(img));
    
    saveData();
    return true;
}

/**
 * 模拟上传图片
 * @param {FileList} files - 文件列表
 * @returns {Promise<Array>} 图片URL数组
 * TODO: 接 Supabase Storage
 */
function uploadImages(files) {
    return new Promise((resolve) => {
        const urls = [];
        const seed = Date.now();
        for (let i = 0; i < files.length && i < CONFIG.maxImagesPerContent; i++) {
            urls.push(`https://picsum.photos/seed/${seed}_${i}/400/400`);
        }
        setTimeout(() => resolve(urls), 500);
    });
}

/**
 * 获取封面图URL
 * @param {string} coverImageId - 封面图ID
 * @returns {string|null} 封面图URL或null
 * TODO: 接 Supabase API
 */
function getCoverImageUrl(coverImageId) {
    if (!coverImageId) return null;
    const images = getImages();
    const image = images.find(img => img.id === coverImageId);
    return image?.url || null;
}

/**
 * 搜索内容
 * @param {string} keyword - 搜索关键词
 * @param {string} type - 内容类型（可选）
 * @returns {Array} 搜索结果数组
 * TODO: 接 Supabase API
 */
function searchContents(keyword, type = null) {
    let results = getContents();
    
    if (type) {
        results = results.filter(c => c.type === type);
    }
    
    if (keyword) {
        const lowerKeyword = keyword.toLowerCase();
        results = results.filter(c => 
            c.title.toLowerCase().includes(lowerKeyword) ||
            c.body.toLowerCase().includes(lowerKeyword) ||
            c.description.toLowerCase().includes(lowerKeyword)
        );
    }
    
    return results;
}

/**
 * 获取用户发布的内容
 * @param {string} userId - 用户ID
 * @param {string} type - 内容类型（可选）
 * @returns {Array} 用户内容数组
 * TODO: 接 Supabase API
 */
function getContentsByAuthor(userId, type = null) {
    let results = getContents().filter(c => c.authorId === userId);
    
    if (type) {
        results = results.filter(c => c.type === type);
    }
    
    return results;
}
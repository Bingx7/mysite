import { getContents, getImages, addContent, updateContent, deleteContent, addImages, deleteImagesByContentId } from './data';
import { CONTENT_TYPE, VISIBILITY } from './config';
import { generateId } from './utils';

export function getContentsByType(type) {
    return getContents().filter(c => c.type === type);
}

export function getContentsByVisibility(visibility) {
    return getContents().filter(c => c.visibility === visibility);
}

export function getImagesByContentId(contentId) {
    return getImages().filter(img => img.contentId === contentId);
}

export function createContent(data) {
    /* TODO: 接 Supabase API */
    const content = {
        id: generateId(),
        authorId: data.authorId,
        type: data.type,
        title: data.title,
        body: data.body || '',
        description: data.description || '',
        visibility: data.visibility || VISIBILITY.PRIVATE,
        createdAt: Date.now(),
        startDate: data.startDate || null,
        endDate: data.endDate || null
    };
    addContent(content);
    
    if (data.images && data.images.length > 0) {
        const newImages = data.images.map((url, idx) => ({
            id: generateId(),
            contentId: content.id,
            url: url,
            caption: data.captions?.[idx] || ''
        }));
        addImages(newImages);
    }
    
    return content;
}

export function updateContentApi(id, data) {
    /* TODO: 接 Supabase API */
    updateContent(id, data);
    
    if (data.images) {
        deleteImagesByContentId(id);
        const newImages = data.images.map((url, idx) => ({
            id: generateId(),
            contentId: id,
            url: url,
            caption: data.captions?.[idx] || ''
        }));
        addImages(newImages);
    }
    
    return getContents().find(c => c.id === id);
}

export function deleteContentApi(id) {
    /* TODO: 接 Supabase API */
    deleteContent(id);
}

export function uploadImages(files) {
    /* TODO: 接 Supabase Storage */
    return Promise.resolve(
        Array.from(files).map(() => 
            `https://picsum.photos/400/300?random=${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        )
    );
}
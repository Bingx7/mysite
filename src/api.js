import { supabase } from './supabase'
import { addContent, updateContent, deleteContent, addImages, deleteImagesByContentId, getContentsByType, getImagesByContentId } from './data'
import { VISIBILITY } from './config'

export { getContentsByType, getImagesByContentId }

/**
 * 上传图片到 Supabase Storage
 * @param {FileList|File[]} files
 * @returns {Promise<string[]>} 上传后的公开 URL 数组
 */
export async function uploadImages(files) {
    const urls = []

    for (const file of files) {
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${file.name}`
        const { data, error } = await supabase.storage
            .from('images')
            .upload(fileName, file)

        if (error) {
            console.error('图片上传失败:', error.message)
            continue
        }

        const { data: urlData } = supabase.storage
            .from('images')
            .getPublicUrl(data.path)

        urls.push(urlData.publicUrl)
    }

    return urls
}

/**
 * 创建内容 + 关联图片
 */
export async function createContent(data) {
    const content = await addContent({
        authorId: data.authorId,
        type: data.type,
        title: data.title,
        body: data.body || '',
        description: data.description || '',
        visibility: data.visibility || VISIBILITY.PRIVATE,
        startDate: data.startDate || null,
        endDate: data.endDate || null
    })

    if (data.images && data.images.length > 0) {
        await addImages(data.images.map((url, idx) => ({
            contentId: content.id,
            url,
            caption: data.captions?.[idx] || ''
        })))
    }

    return content
}

/**
 * 更新内容 + 替换图片
 */
export async function updateContentApi(id, data) {
    await updateContent(id, data)

    if (data.images) {
        await deleteImagesByContentId(id)
        await addImages(data.images.map((url, idx) => ({
            contentId: id,
            url,
            caption: data.captions?.[idx] || ''
        })))
    }
}

/**
 * 删除内容
 */
export async function deleteContentApi(id) {
    await deleteContent(id)
}

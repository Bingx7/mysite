import { supabase } from './supabase'
import {
    addContent,
    updateContent,
    deleteContent,
    addImages,
    deleteImagesByContentId,
    getContentsByType,
    getImagesByContentId as getImageRowsByContentId
} from './data'
import { VISIBILITY } from './config'

export { getContentsByType }

const IMAGE_BUCKET = 'images'
const SIGNED_URL_TTL_SECONDS = 60 * 60

function getStoragePath(value) {
    if (!value) return null
    if (!/^https?:\/\//i.test(value)) return value

    for (const marker of [
        `/storage/v1/object/public/${IMAGE_BUCKET}/`,
        `/storage/v1/object/sign/${IMAGE_BUCKET}/`
    ]) {
        const markerIndex = value.indexOf(marker)
        if (markerIndex !== -1) {
            const encodedPath = value.slice(markerIndex + marker.length).split('?')[0]
            try { return decodeURIComponent(encodedPath) } catch { return encodedPath }
        }
    }

    // 外部图片链接不属于 Supabase Storage，保持原样。
    return null
}

async function signImageRows(rows) {
    const storagePaths = [...new Set(rows.map(row => getStoragePath(row.url)).filter(Boolean))]
    if (storagePaths.length === 0) {
        return rows.map(row => ({ ...row, storage_path: null }))
    }

    const { data, error } = await supabase.storage
        .from(IMAGE_BUCKET)
        .createSignedUrls(storagePaths, SIGNED_URL_TTL_SECONDS)

    if (error) throw error

    const signedUrlMap = new Map((data || []).map(item => [item.path, item.signedUrl]))
    return rows.map(row => {
        const storagePath = getStoragePath(row.url)
        if (!storagePath) return { ...row, storage_path: null }
        const signedUrl = signedUrlMap.get(storagePath)
        if (!signedUrl) throw new Error('无法生成图片访问链接')
        return { ...row, storage_path: storagePath, url: signedUrl }
    })
}

export async function getImagesByContentId(contentId) {
    const rows = await getImageRowsByContentId(contentId)
    return signImageRows(rows)
}

export async function deleteImageObjects(images) {
    const paths = [...new Set(images.map(image =>
        getStoragePath(typeof image === 'string' ? image : image?.path || image?.storage_path || image?.url)
    ).filter(Boolean))]
    if (paths.length === 0) return

    const { error } = await supabase.storage.from(IMAGE_BUCKET).remove(paths)
    if (error) throw error
}

/**
 * 上传图片到 Supabase Storage
 * @param {FileList|File[]} files
 * @returns {Promise<Array<{path: string, url: string, isNew: boolean}>>}
 */
export async function uploadImages(files) {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) throw userError
    if (!user) throw new Error('请先登录后再上传图片')

    const uploadedPaths = []
    try {
        for (const file of files) {
            const originalExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
            const extension = /^[a-z0-9]{1,8}$/.test(originalExtension) ? originalExtension : 'jpg'
            const randomId = globalThis.crypto?.randomUUID?.()
                || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
            const storagePath = `${user.id}/${randomId}.${extension}`
            const { data, error } = await supabase.storage
                .from(IMAGE_BUCKET)
                .upload(storagePath, file, { upsert: false, contentType: file.type })

            if (error) throw error
            uploadedPaths.push(data.path)
        }

        const signedRows = await signImageRows(uploadedPaths.map((path, index) => ({ id: index, url: path })))
        return signedRows.map(row => ({ path: row.storage_path, url: row.url, isNew: true }))
    } catch (error) {
        if (uploadedPaths.length > 0) {
            await supabase.storage.from(IMAGE_BUCKET).remove(uploadedPaths)
        }
        throw error
    }
}

function getStoredImageValue(image) {
    if (typeof image === 'string') return getStoragePath(image) || image
    return image?.path || image?.storage_path || getStoragePath(image?.url) || image?.url
}

function toImageRows(contentId, images, captions) {
    return images.map((image, idx) => ({
        contentId,
        url: getStoredImageValue(image),
        caption: captions?.[idx] || ''
    }))
}

/**
 * 创建内容 + 关联图片
 */
export async function createContent(data) {
    let content = null
    try {
        content = await addContent({
            authorId: data.authorId,
            type: data.type,
            title: data.title,
            body: data.body || '',
            description: data.description || '',
            visibility: data.visibility || VISIBILITY.PRIVATE,
            startDate: data.startDate || null,
            endDate: data.endDate || null
        })

        if (data.images?.length > 0) {
            await addImages(toImageRows(content.id, data.images, data.captions))
        }

        return content
    } catch (error) {
        if (content) await deleteContent(content.id).catch(() => {})
        await deleteImageObjects(data.images || []).catch(() => {})
        throw error
    }
}

/**
 * 更新内容 + 替换图片
 */
export async function updateContentApi(id, data) {
    const { images, captions, authorId, ...contentFields } = data
    void authorId
    await updateContent(id, contentFields)

    if (images) {
        const previousImages = await getImageRowsByContentId(id)
        await deleteImagesByContentId(id)
        try {
            if (images.length > 0) await addImages(toImageRows(id, images, captions))
        } catch (error) {
            if (previousImages.length > 0) {
                await addImages(previousImages.map(image => ({
                    contentId: id,
                    url: image.url,
                    caption: image.caption
                }))).catch(() => {})
            }
            throw error
        }

        const retainedPaths = new Set(images.map(getStoredImageValue))
        const removedImages = previousImages.filter(image => !retainedPaths.has(getStoredImageValue(image.url)))
        await deleteImageObjects(removedImages).catch(error => {
            console.warn('旧图片文件清理失败:', error.message)
        })
    }
}

/**
 * 删除内容
 */
export async function deleteContentApi(id) {
    const images = await getImageRowsByContentId(id)
    await deleteContent(id)
    await deleteImageObjects(images).catch(error => {
        console.warn('图片文件清理失败:', error.message)
    })
}

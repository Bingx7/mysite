import { supabase } from './supabase'
import { deleteContent, getContentsByType, getImagesByContentId as getImageRows } from './data'
import { prepareImage, extensionFor } from './media'

export { getContentsByType }
const BUCKET = 'images'

export function getStoragePath(value) {
    if (!value) return null
    if (!/^https?:\/\//i.test(value)) return value
    for (const marker of ['/storage/v1/object/public/images/', '/storage/v1/object/sign/images/']) {
        const index = value.indexOf(marker)
        if (index !== -1) {
            const path = value.slice(index + marker.length).split('?')[0]
            try { return decodeURIComponent(path) } catch { return path }
        }
    }
    return null
}

async function signRows(rows) {
    const paths = [...new Set(rows.flatMap(row => [row.url, row.thumbnail_url]).map(getStoragePath).filter(Boolean))]
    let signed = new Map()
    if (paths.length) {
        const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
        if (error) throw error
        signed = new Map((data || []).map(item => [item.path, item.signedUrl]))
    }
    return rows.map(row => {
        const path = getStoragePath(row.url)
        const thumbPath = getStoragePath(row.thumbnail_url)
        const url = path ? signed.get(path) : row.url
        return {
            ...row, storage_path: path, thumbnail_path: thumbPath,
            // 单张损坏的图片不影响整篇内容读取。
            url: url || '', thumbnail_url: (thumbPath ? signed.get(thumbPath) : row.thumbnail_url) || url || ''
        }
    })
}

export async function getImagesByContentId(id) { return signRows(await getImageRows(id)) }

/** 一页最多 12 条内容：图片元数据一次查询，访问链接一次批量生成。 */
export async function getImagesByContentIds(ids) {
    const uniqueIds = [...new Set(ids)]
    const map = Object.fromEntries(uniqueIds.map(id => [id, []]))
    if (!uniqueIds.length) return map
    const { data, error } = await supabase.from('content_images').select('*')
        .in('content_id', uniqueIds).order('sort_order', { ascending: true }).order('id', { ascending: true })
    if (error) throw error
    for (const image of await signRows(data || [])) {
        if (map[image.content_id]) map[image.content_id].push(image)
    }
    return map
}

export async function deleteImageObjects(images) {
    const paths = [...new Set(images.flatMap(image => typeof image === 'string' ? [image] : [
        image?.path || image?.storage_path || image?.url,
        image?.thumbnail_path || image?.thumbnail_url
    ]).map(getStoragePath).filter(Boolean))]
    if (!paths.length) return
    const { error } = await supabase.storage.from(BUCKET).remove(paths)
    if (error) throw error
}

export async function uploadImages(files, onProgress = () => {}, options = {}) {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    if (!user) throw new Error('请先登录后再上传图片')
    const uploaded = []
    const rows = []
    try {
        for (let index = 0; index < files.length; index++) {
            onProgress({ completed: index, total: files.length, stage: '正在处理图片' })
            const { main, thumbnail } = await prepareImage(files[index], options)
            const id = crypto.randomUUID()
            const path = `${user.id}/${id}.${extensionFor(main.type)}`
            const thumbnailPath = `${user.id}/${id}_thumb.${extensionFor(thumbnail.type)}`
            onProgress({ completed: index, total: files.length, stage: '正在上传图片和缩略图' })
            for (const [name, blob] of [[path, main], [thumbnailPath, thumbnail]]) {
                const { error: uploadError } = await supabase.storage.from(BUCKET).upload(name, blob, { upsert: false, contentType: blob.type })
                if (uploadError) throw uploadError
                uploaded.push(name)
            }
            rows.push({ url: path, thumbnail_url: thumbnailPath })
            onProgress({ completed: index + 1, total: files.length, stage: '已上传' })
        }
        return (await signRows(rows)).map(row => ({
            path: row.storage_path, url: row.url, thumbnail_path: row.thumbnail_path,
            thumbnail_url: row.thumbnail_url, isNew: true, is_cover: false
        }))
    } catch (error) {
        await deleteImageObjects(uploaded).catch(() => {})
        throw error
    }
}

export function toImageRows(images, captions = []) {
    return images.map((image, index) => ({
        url: typeof image === 'string' ? getStoragePath(image) || image : image.path || image.storage_path || getStoragePath(image.url) || image.url,
        thumbnail_url: image.thumbnail_path || getStoragePath(image.thumbnail_url) || image.thumbnail_url || null,
        caption: captions[index] ?? image.caption ?? '',
        is_cover: Boolean(image.is_cover)
    }))
}

// 正文和图片顺序在同一个数据库事务内保存，失败时保留原内容与表单。
export async function saveContentBundle(id, data, restore = false) {
    const { images = [], captions = [], ...fields } = data
    const { data: result, error } = await supabase.rpc('save_content_bundle', {
        p_id: id, p_content: fields, p_images: toImageRows(images, captions), p_restore: restore
    })
    if (error) throw error
    return result
}

export async function createContent(data) {
    return saveContentBundle(data.id || crypto.randomUUID(), data)
}

export async function updateContentApi(id, data) {
    const previous = await getImageRows(id)
    const result = await saveContentBundle(id, data)
    const retained = new Set(toImageRows(data.images || []).flatMap(image => [image.url, image.thumbnail_url]).filter(Boolean))
    const removed = previous.flatMap(image => [image.url, image.thumbnail_url]).filter(path => path && !retained.has(getStoragePath(path) || path))
    await deleteImageObjects(removed).catch(error => console.warn('旧图片清理失败:', error.message))
    return result
}

export async function deleteContentApi(id) {
    const images = await getImageRows(id)
    await deleteContent(id)
    await deleteImageObjects(images).catch(error => console.warn('图片清理失败:', error.message))
}

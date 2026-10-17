import { supabase } from './supabase'
import { getImagesByContentId } from './data'
import { getStoragePath, uploadImages, saveContentBundle, deleteImageObjects } from './api'
import { MAX_BACKUP_BYTES, bytesToBase64, assetBytes, sha256, validateBackup } from './backupFormat'

export function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
}

export async function exportBackup(selected, onProgress) {
    if (!selected.length) throw new Error('请先选择内容')
    const backup = { format: 'bingx-content-backup', version: 1, exported_at: new Date().toISOString(), contents: [], assets: [] }
    const known = new Map()
    let size = 0
    for (let i = 0; i < selected.length; i++) {
        const content = selected[i]
        onProgress(`正在备份 ${i + 1} / ${selected.length}：${content.title}`)
        const rows = await getImagesByContentId(content.id)
        const images = []
        for (const image of rows) {
            if (!known.has(image.url)) {
                const path = getStoragePath(image.url)
                let blob
                if (path) {
                    const { data, error } = await supabase.storage.from('images').download(path)
                    if (error) throw new Error(`「${content.title}」图片下载失败：${error.message}`)
                    blob = data
                } else {
                    if (!/^https:\/\//i.test(image.url)) throw new Error('无法备份这个外部图片地址')
                    const response = await fetch(image.url, { credentials: 'omit', signal: AbortSignal.timeout(30000) })
                    if (!response.ok) throw new Error(`「${content.title}」外部图片下载失败`)
                    blob = await response.blob()
                }
                size += Math.ceil(blob.size / 3) * 4
                if (size > MAX_BACKUP_BYTES - 1024 * 1024) throw new Error('备份超过 100 MB，请按日期分批导出')
                const bytes = new Uint8Array(await blob.arrayBuffer())
                const asset = { id: `image-${backup.assets.length}`, mime: blob.type.split(';')[0], base64: bytesToBase64(bytes), sha256: await sha256(bytes) }
                backup.assets.push(asset)
                known.set(image.url, asset.id)
            }
            images.push({ asset: known.get(image.url), caption: image.caption || '', is_cover: Boolean(image.is_cover) })
        }
        backup.contents.push({
            id: content.id, author_id: content.author_id, type: content.type, title: content.title,
            body: content.body || '', description: content.description || '', visibility: content.visibility,
            pinned: Boolean(content.pinned), created_at: content.created_at,
            start_date: content.start_date, end_date: content.end_date, images
        })
    }
    // 下载前检查可恢复性，任何图片失败都不会产出一个看似完整的备份。
    await validateBackup(backup)
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
    if (blob.size > MAX_BACKUP_BYTES) throw new Error('备份超过 100 MB，请分批导出')
    return blob
}

export async function readBackup(file) {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('单个备份最多 100 MB，请使用分批备份')
    let input
    try { input = JSON.parse(await file.text()) } catch { throw new Error('无法读取备份，请选择本站导出的完整备份 JSON 文件') }
    return validateBackup(input)
}

export async function restoreBackup(backup, existingIds, onProgress) {
    const assets = new Map(backup.assets.map(asset => [asset.id, asset]))
    const result = { restored: 0, skipped: 0, failed: [] }
    for (let index = 0; index < backup.contents.length; index++) {
        const content = backup.contents[index]
        onProgress(`正在恢复 ${index + 1} / ${backup.contents.length}：${content.title}`)
        if (existingIds.has(content.id)) { result.skipped++; continue }
        let uploaded = []
        let submitted = false
        try {
            const files = content.images.map(image => {
                const asset = assets.get(image.asset)
                return new File([assetBytes(asset)], asset.id, { type: asset.mime })
            })
            uploaded = await uploadImages(files, () => {}, { preserveOriginal: true })
            uploaded = uploaded.map((image, i) => ({ ...image, is_cover: content.images[i].is_cover }))
            submitted = true
            const response = await saveContentBundle(content.id, {
                authorId: content.author_id, type: content.type, title: content.title,
                body: content.body, description: content.description, visibility: content.visibility,
                pinned: content.pinned, created_at: content.created_at,
                startDate: content.start_date, endDate: content.end_date,
                images: uploaded, captions: content.images.map(image => image.caption)
            }, true)
            if (response.skipped) {
                result.skipped++
                await deleteImageObjects(uploaded).catch(() => {})
            } else result.restored++
            existingIds.add(content.id)
        } catch (error) {
            // RPC 断网时不能确定事务是否已提交，保留已上传文件，避免删除已恢复内容的图片。
            if (!submitted || error.code) await deleteImageObjects(uploaded).catch(() => {})
            result.failed.push({ title: content.title, message: error.message })
        }
    }
    return result
}

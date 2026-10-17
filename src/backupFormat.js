import { IMAGE_TYPES } from './media.js'

export const MAX_BACKUP_BYTES = 100 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const fail = message => { throw new Error('备份无效：' + message) }

export async function sha256(bytes) {
    const hash = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export function bytesToBase64(bytes) {
    const parts = []
    for (let i = 0; i < bytes.length; i += 16384) parts.push(String.fromCharCode(...bytes.subarray(i, i + 16384)))
    return btoa(parts.join(''))
}

export function assetBytes(asset) {
    if (typeof asset.base64 !== 'string' || asset.base64.length > MAX_BACKUP_BYTES ||
        asset.base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.base64)) fail('图片数据格式错误')
    return Uint8Array.from(atob(asset.base64), char => char.charCodeAt(0))
}

function textField(value, label, limit = 1000000) {
    if (typeof value !== 'string' || value.length > limit) fail(label + '格式错误')
    return value
}

function dateField(value, label, nullable = true) {
    if (nullable && value == null) return null
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) fail(label + '格式错误')
    return new Date(value).toISOString()
}

export async function validateBackup(input) {
    if (!input || input.format !== 'bingx-content-backup' || input.version !== 1) fail('不支持的文件版本，请选择本站导出的完整备份 JSON')
    if (!Array.isArray(input.contents) || !input.contents.length || input.contents.length > 2000) fail('内容数量必须在 1–2000 条之间')
    if (!Array.isArray(input.assets) || input.assets.length > 18000) fail('图片清单错误')
    const assets = new Map()
    let totalBytes = 0
    for (const asset of input.assets) {
        if (!asset || typeof asset.id !== 'string' || assets.has(asset.id) || !IMAGE_TYPES.includes(asset.mime)) fail('图片编号或格式错误')
        const bytes = assetBytes(asset)
        totalBytes += bytes.length
        if (!bytes.length || totalBytes > MAX_BACKUP_BYTES) fail('图片为空或文件过大')
        if (asset.sha256 !== await sha256(bytes)) fail('图片校验失败，文件可能已损坏')
        assets.set(asset.id, { id: asset.id, mime: asset.mime, base64: asset.base64, sha256: asset.sha256 })
    }
    const seen = new Set()
    const contents = input.contents.map(content => {
        if (!content || !UUID.test(content.id) || seen.has(content.id) || !UUID.test(content.author_id)) fail('内容或作者编号错误')
        seen.add(content.id)
        if (!['diary', 'article', 'album'].includes(content.type) || !['public', 'private', 'partner', 'internal'].includes(content.visibility)) fail('类型或可见性错误')
        if (!Array.isArray(content.images) || content.images.length > 9) fail('每条内容最多 9 张图片')
        const title = textField(content.title, '标题', 10000)
        if (!title.trim()) fail('标题为空')
        const images = content.images.map(image => {
            if (!image || !assets.has(image.asset) || typeof image.is_cover !== 'boolean') fail('图片引用或封面标记错误')
            return { asset: image.asset, caption: textField(image.caption, '图片说明', 10000), is_cover: image.is_cover }
        })
        if (images.filter(image => image.is_cover).length > 1) fail('一条内容存在多个封面')
        const start = dateField(content.start_date, '开始日期')
        const end = dateField(content.end_date, '结束日期')
        if (start && end && start > end) fail('日期范围错误')
        return {
            id: content.id, author_id: content.author_id, type: content.type, title,
            body: textField(content.body, '正文'), description: textField(content.description, '描述'),
            visibility: content.visibility, pinned: content.pinned === true,
            created_at: dateField(content.created_at, '创建日期', false), start_date: start, end_date: end, images
        }
    })
    return { format: input.format, version: 1, contents, assets: [...assets.values()] }
}

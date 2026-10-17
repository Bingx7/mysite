export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

export function fitDimensions(width, height, maxEdge) {
    const scale = Math.min(1, maxEdge / Math.max(width, height))
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function coverFirst(images) {
    const cover = images.find(image => image.is_cover)
    return cover ? [cover, ...images.filter(image => image !== cover)] : images
}

async function decodeImage(file) {
    const url = URL.createObjectURL(file)
    const image = new Image()
    try {
        image.src = url
        await image.decode()
        if (!image.naturalWidth || !image.naturalHeight) throw new Error('图片尺寸无效')
        return image
    } finally { URL.revokeObjectURL(url) }
}

function resize(image, edge, quality) {
    const canvas = document.createElement('canvas')
    const size = fitDimensions(image.naturalWidth, image.naturalHeight, edge)
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法处理图片，请更换浏览器重试')
    context.drawImage(image, 0, 0, size.width, size.height)
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
        canvas.width = canvas.height = 1
        blob ? resolve(blob) : reject(new Error('图片转换失败'))
    }, 'image/webp', quality))
}

export async function prepareImage(file, { preserveOriginal = false } = {}) {
    if (!IMAGE_TYPES.includes(file.type)) throw new Error('支持 JPG、PNG、WebP、GIF 和 AVIF 图片')
    const image = await decodeImage(file)
    // GIF / WebP / AVIF 可能包含动画；原文件保留动画，缩略图使用第一帧。
    let main = file
    if (!preserveOriginal && ['image/jpeg', 'image/png'].includes(file.type)) {
        const compressed = await resize(image, 2560, 0.85)
        if (compressed.size < file.size) main = compressed
    }
    const thumbnail = await resize(image, 480, 0.75)
    return { main, thumbnail }
}

export function extensionFor(type) {
    return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' })[type] || 'png'
}

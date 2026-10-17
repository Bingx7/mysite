import test from 'node:test'
import assert from 'node:assert/strict'
import { fitDimensions, coverFirst } from '../src/media.js'
import { validateBackup, bytesToBase64, assetBytes, sha256 } from '../src/backupFormat.js'

async function fixture() {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
    return {
        format: 'bingx-content-backup', version: 1,
        assets: [{ id: 'image-0', mime: 'image/png', base64: bytesToBase64(bytes), sha256: await sha256(bytes) }],
        contents: [{ id: '11111111-1111-4111-8111-111111111111', author_id: '22222222-2222-4222-8222-222222222222',
            type: 'album', title: '旅行', body: '', description: '中文与 emoji 🌅', visibility: 'private', pinned: true,
            created_at: '2026-09-07T00:00:00Z', start_date: null, end_date: null,
            images: [{ asset: 'image-0', caption: '日落', is_cover: true }] }]
    }
}

test('压缩保持比例，竖图与小图不被放大', () => {
    assert.deepEqual(fitDimensions(4000, 3000, 2560), { width: 2560, height: 1920 })
    assert.deepEqual(fitDimensions(1000, 4000, 480), { width: 120, height: 480 })
    assert.deepEqual(fitDimensions(100, 80, 480), { width: 100, height: 80 })
})

test('封面只影响列表预览，不改变实际顺序', () => {
    const images = [{ id: 1 }, { id: 2, is_cover: true }, { id: 3 }]
    assert.deepEqual(coverFirst(images).map(i => i.id), [2, 1, 3])
    assert.deepEqual(images.map(i => i.id), [1, 2, 3])
    assert.deepEqual(coverFirst([]), [])
})

test('完整备份保留中文、可见性、顺序、封面和实际字节', async () => {
    const input = await fixture()
    const result = await validateBackup(JSON.parse(JSON.stringify(input)))
    assert.equal(result.contents[0].description, '中文与 emoji 🌅')
    assert.equal(result.contents[0].visibility, 'private')
    assert.equal(result.contents[0].images[0].is_cover, true)
    assert.deepEqual(assetBytes(result.assets[0]), assetBytes(input.assets[0]))
})

test('损坏图片和缺失图片都阻止恢复', async () => {
    const corrupt = await fixture()
    corrupt.assets[0].base64 = 'AAAA'
    await assert.rejects(validateBackup(corrupt), /校验失败/)
    const missing = await fixture()
    missing.contents[0].images[0].asset = 'missing'
    await assert.rejects(validateBackup(missing), /图片引用/)
})

test('拒绝重复 ID、多封面、不支持版本与错误日期', async () => {
    const duplicate = await fixture()
    duplicate.contents.push(structuredClone(duplicate.contents[0]))
    await assert.rejects(validateBackup(duplicate), /编号错误/)
    const covers = await fixture()
    covers.contents[0].images.push({ ...covers.contents[0].images[0] })
    await assert.rejects(validateBackup(covers), /多个封面/)
    await assert.rejects(validateBackup({ format: 'bingx-content-backup', version: 2 }), /文件版本/)
    const dates = await fixture()
    dates.contents[0].start_date = '2026-09-08T00:00:00Z'
    dates.contents[0].end_date = '2026-09-07T00:00:00Z'
    await assert.rejects(validateBackup(dates), /日期范围/)
})

test('图片上限和非法格式不会绕过校验', async () => {
    const input = await fixture()
    input.contents[0].images = Array.from({ length: 10 }, () => ({ asset: 'image-0', caption: '', is_cover: false }))
    await assert.rejects(validateBackup(input), /最多 9 张/)
    const invalid = await fixture()
    invalid.assets[0].mime = 'text/html'
    await assert.rejects(validateBackup(invalid), /图片编号或格式/)
})

test('大型图片的 Base64 编解码不会截断', () => {
    const bytes = new Uint8Array(1024 * 1024).fill(255)
    assert.deepEqual(assetBytes({ base64: bytesToBase64(bytes) }), bytes)
})

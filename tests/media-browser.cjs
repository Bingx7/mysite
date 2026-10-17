// 运行：node tests/media-browser.cjs <playwright 模块目录>
// 先用测试 Supabase URL 启动 Vite 8081；本测试屏蔽所有外部请求，使用内存服务。
const { chromium } = require(process.argv[2] || 'playwright')
const assert = require('node:assert/strict')

;(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true })
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.route('**/*', route => {
            if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue()
            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        })
        await page.goto('http://127.0.0.1:8081')
        await page.waitForSelector('#app')
        const imageBase64 = await page.evaluate(async () => {
            const canvas = document.createElement('canvas')
            canvas.width = 3600; canvas.height = 2400
            const context = canvas.getContext('2d')
            context.fillStyle = '#4ECDC4'; context.fillRect(0, 0, 3600, 2400)
            return canvas.toDataURL('image/png').split(',')[1]
        })
        await page.evaluate(async () => {
            const { createApp, h } = await import('/tests/browserHarness.js')
            const { supabase } = await import('/src/supabase.js')
            const { useContents } = await import('/src/composables/useContents.js')
            const { default: ContentModal } = await import('/src/components/ContentModal.vue')
            document.getElementById('app').style.display = 'none'
            const root = document.createElement('div'); root.id = 'test-root'; document.body.appendChild(root)
            const user = { id: '22222222-2222-4222-8222-222222222222', level: 3 }
            const objects = new Map(), records = new Map()
            window.testState = { objects, records, rpcCalls: 0, uploadCalls: 0, user, failNext: false }
            supabase.auth.getUser = async () => ({ data: { user }, error: null })
            supabase.storage.from = () => ({
                upload: async (path, blob) => {
                    window.testState.uploadCalls++
                    await new Promise(resolve => setTimeout(resolve, 150))
                    objects.set(path, blob)
                    return { data: { path }, error: null }
                },
                createSignedUrls: async paths => ({ data: paths.map(path => ({ path, signedUrl: objects.has(path) ? URL.createObjectURL(objects.get(path)) : '' })), error: null }),
                remove: async paths => { paths.forEach(path => objects.delete(path)); return { error: null } },
                download: async path => objects.has(path) ? { data: objects.get(path), error: null } : { error: { message: 'not found' } }
            })
            supabase.from = table => {
                let id
                const query = {
                    select() { return this }, eq(column, value) { id = value; return this }, order() { return this },
                    then(resolve) { return Promise.resolve({ data: records.get(id)?.images || [], error: null }).then(resolve) }
                }
                return query
            }
            supabase.rpc = async (name, args) => {
                window.testState.rpcCalls++
                await new Promise(resolve => setTimeout(resolve, 200))
                if (window.testState.failNext) { window.testState.failNext = false; return { error: { code: 'test', message: '测试保存失败' } } }
                if (args.p_restore && records.has(args.p_id)) return { data: { skipped: true }, error: null }
                records.set(args.p_id, { ...args.p_content, id: args.p_id, images: args.p_images.map((image, i) => ({ ...image, id: String(i), sort_order: i })) })
                return { data: { id: args.p_id, skipped: false }, error: null }
            }
            const state = useContents()
            window.workflow = state
            state.currentTab.value = 'album'; state.openCreateModal(); state.formTitle.value = '测试相册'
            window.testApp = createApp({
                setup() {
                    return () => h(ContentModal, {
                        isOpen: state.isModalOpen.value, mode: state.modalMode.value, currentTab: state.formType.value,
                        formTitle: state.formTitle.value, formBody: state.formBody.value, formDescription: state.formDescription.value,
                        formVisibility: state.formVisibility.value, formImages: state.formImages.value, formCaptions: state.formCaptions.value,
                        busy: state.modalBusy.value, saving: state.saving.value, uploading: state.uploading.value, uploadProgress: state.uploadProgress.value,
                        onFileUpload: event => state.handleFileUpload(event, () => {}), onMoveImage: state.moveImage,
                        onSetCover: state.setCover, onRemoveImage: state.removeImage,
                        onSave: () => state.handleSaveContent(user, () => {}), onClose: () => state.closeModal()
                    })
                }
            })
            window.testApp.mount(root)
        })
        const buffer = Buffer.from(imageBase64, 'base64')
        await page.locator('#test-root input[type=file]').setInputFiles([1, 2, 3].map(i => ({ name: `photo${i}.png`, mimeType: 'image/png', buffer })))
        await page.waitForFunction(() => window.workflow.uploading.value)
        assert.equal(await page.getByRole('button', { name: '上传中…' }).isDisabled(), true)
        assert.equal(await page.getByRole('button', { name: '取消', exact: true }).isDisabled(), true)
        await page.waitForFunction(() => !window.workflow.uploading.value)
        assert.equal(await page.locator('.uploaded-image').count(), 3)
        assert.equal(await page.evaluate(() => window.testState.uploadCalls), 6)
        const imageSizes = await page.evaluate(async () => {
            const first = window.workflow.formImages.value[0]
            const main = await createImageBitmap(window.testState.objects.get(first.path))
            const thumb = await createImageBitmap(window.testState.objects.get(first.thumbnail_path))
            return { main: main.width, thumb: thumb.width }
        })
        assert.deepEqual(imageSizes, { main: 2560, thumb: 480 })
        await page.locator('.uploaded-image').nth(2).getByRole('button', { name: '设为封面' }).click()
        const coverPath = await page.evaluate(() => window.workflow.formImages.value[2].path)
        await page.locator('.uploaded-image').nth(2).getByRole('button', { name: '前移' }).click()
        assert.equal(await page.evaluate(() => window.workflow.formImages.value[1].is_cover), true)
        await page.screenshot({ path: 'dist/media-desktop.png', fullPage: true })
        await page.setViewportSize({ width: 390, height: 844 })
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        await page.screenshot({ path: 'dist/media-mobile.png', fullPage: true })
        // 同时触发两次保存，只允许发出一次 RPC。
        await page.evaluate(async () => {
            await Promise.all([window.workflow.handleSaveContent(window.testState.user, () => {}), window.workflow.handleSaveContent(window.testState.user, () => {})])
        })
        assert.equal(await page.evaluate(() => window.testState.rpcCalls), 1)
        assert.equal(await page.evaluate(() => [...window.testState.records.values()][0].images[1].url), coverPath)
        const roundTrip = await page.evaluate(async () => {
            const { exportBackup, readBackup, restoreBackup } = await import('/src/backup.js')
            const record = [...window.testState.records.values()][0]
            const content = { ...record, author_id: window.testState.user.id, created_at: '2026-09-07T00:00:00Z', start_date: null, end_date: null }
            const blob = await exportBackup([content], () => {})
            const backup = await readBackup(new File([blob], 'backup.json'))
            const before = backup.assets.map(asset => asset.sha256)
            const skipped = await restoreBackup(backup, new Set([record.id]), () => {})
            window.testState.records.clear()
            const restored = await restoreBackup(backup, new Set(), () => {})
            const restoredRecord = window.testState.records.get(record.id)
            const second = await readBackup(new File([await exportBackup([{ ...content, ...restoredRecord }], () => {})], 'backup.json'))
            const duplicate = await restoreBackup(backup, new Set(), () => {})
            window.backupFixture = backup
            return { skipped, restored, duplicate, before, after: second.assets.map(asset => asset.sha256), cover: restoredRecord.images[1].is_cover, objectCount: window.testState.objects.size }
        })
        assert.equal(roundTrip.skipped.skipped, 1)
        assert.equal(roundTrip.restored.restored, 1)
        assert.equal(roundTrip.duplicate.skipped, 1)
        assert.deepEqual(roundTrip.before, roundTrip.after)
        assert.equal(roundTrip.cover, true)
        // 保存失败保留表单和已上传图片，取消才清理这次新图。
        const failedSave = await page.evaluate(async () => {
            const state = window.workflow
            state.openCreateModal(); state.formTitle.value = '失败测试'
            const { uploadImages } = await import('/src/api.js')
            const oldCount = window.testState.objects.size
            const asset = window.backupFixture.assets[0]
            const { assetBytes } = await import('/src/backupFormat.js')
            state.formImages.value = await uploadImages([new File([assetBytes(asset)], 'photo.webp', { type: asset.mime })])
            window.testState.failNext = true
            const result = await state.handleSaveContent(window.testState.user, () => {})
            const retained = state.isModalOpen.value && state.formImages.value.length === 1 && !state.saving.value
            await state.closeModal()
            return { result, retained, cleaned: window.testState.objects.size === oldCount }
        })
        assert.deepEqual(failedSave, { result: false, retained: true, cleaned: true })
        const lazy = await page.evaluate(async () => {
            window.testApp.unmount()
            const { createApp, h } = await import('/tests/browserHarness.js')
            const { default: ContentList } = await import('/src/components/ContentList.vue')
            const record = [...window.testState.records.values()][0]
            const { getImagesByContentId } = await import('/src/api.js')
            const images = await getImagesByContentId(record.id)
            window.testApp = createApp({ render: () => h(ContentList, { contents: [{ ...record, author_id: window.testState.user.id, created_at: '2026-09-07' }], imagesMap: { [record.id]: images }, authorsMap: {}, currentTab: 'album', folderColors: ['#4ECDC4'] }) })
            window.testApp.mount('#test-root')
            return images.find(image => image.is_cover).thumbnail_url
        })
        assert.equal(await page.locator('.folder-image').first().getAttribute('src'), lazy)
        assert.equal(await page.locator('.folder-image').first().getAttribute('loading'), 'lazy')
        assert.match(await page.locator('.album-stats').innerText(), /3 张/)
        // 恢复 UI：选择文件只校验和预览，必须点击确认才开始恢复。
        const backupText = await page.evaluate(async () => {
            window.testApp.unmount()
            const { createApp, h } = await import('/tests/browserHarness.js')
            const { default: BackupPanel } = await import('/src/admin/BackupPanel.vue')
            window.testApp = createApp({ render: () => h(BackupPanel, { selected: [], contents: [], users: [] }) })
            window.testApp.mount('#test-root')
            return JSON.stringify(window.backupFixture)
        })
        const beforePreview = await page.evaluate(() => window.testState.rpcCalls)
        await page.locator('#test-root input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backupText) })
        await page.getByText('校验通过，请确认恢复。').waitFor()
        assert.equal(await page.evaluate(() => window.testState.rpcCalls), beforePreview)
        await page.screenshot({ path: 'dist/backup-mobile.png', fullPage: true })
        await page.getByRole('button', { name: '确认导入缺少的内容' }).click()
        await page.getByText('已恢复 0 条，跳过 1 条，失败 0 条。').waitFor()
        assert.deepEqual(errors, [])
        console.log('PASS: 上传状态、防重复保存、实际压缩和缩略图、排序封面、桌面/手机布局、真实图片备份恢复、重复恢复、失败保留与取消清理、缩略图懒加载。')
    } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })

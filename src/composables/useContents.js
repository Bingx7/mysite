import { ref, computed } from 'vue'
import { IMAGE_TYPES } from '../media'
import { CONFIG, VISIBILITY, CONTENT_TYPE } from '../config'
import { getVisibleContents } from '../permissions'
import { getSystemSettings, getUsers, getContentsPage, getDiaryIndex, getDiaryPageRows } from '../data'
import { contentPageSize } from '../contentQuery'
import { localDateKey, isDiaryDate, diaryDateKey, diaryMonthKey, sortDiaryIndex, diaryDayCounts } from '../diary.js'
import { normalizeDiaryAuthorScope } from '../diaryAccess.js'
import {
    getImagesByContentIds,
    getImagesByContentId,
    createContent as createContentApi,
    updateContentApi,
    deleteContentApi,
    uploadImages,
    deleteImageObjects
} from '../api'
import { formatDate } from '../utils'

/* ===== 内容状态管理 ===== */
export function useContents() {
    const allContents = ref([])
    const contentImagesMap = ref({})
    const authorsMap = ref({})        // { [userId]: { name, avatar, level } }
    const selectedContent = ref(null)
    const selectedContentImages = ref([])
    const currentTab = ref(CONTENT_TYPE.DIARY)
    const sysSettings = ref({ registration_open: false, daily_post_limit: 10, max_image_size: 10 })
    const contentLoading = ref(false)
    const contentError = ref('')
    const imagesLoading = ref(false)
    const imagesError = ref('')
    const detailImagesLoading = ref(false)
    const detailImagesError = ref('')
    const currentPage = ref(1)
    const searchQuery = ref('')
    const totalContents = ref(0)
    const diaryMonth = ref(diaryMonthKey())
    const diaryDate = ref('')
    const diaryAuthor = ref('all')
    const diaryDays = ref({})
    const pageSize = computed(() => contentPageSize(currentTab.value))
    const saving = ref(false)
    const uploading = ref(false)
    const closing = ref(false)
    const uploadProgress = ref({ completed: 0, total: 0, stage: '' })
    const modalBusy = computed(() => saving.value || uploading.value || closing.value)
    const pendingContentId = ref(null)

    /* ---- 弹窗表单 ---- */
    const isModalOpen = ref(false)
    const modalMode = ref('create')
    const formImages = ref([])
    const formCaptions = ref([])
    const formTitle = ref('')
    const formBody = ref('')
    const formDescription = ref('')
    const formVisibility = ref(VISIBILITY.PUBLIC)
    const formStartDate = ref('')
    const formEndDate = ref('')
    const formType = ref(CONTENT_TYPE.DIARY)
    let initialForm = ''

    // 仅缓存当前会话的少量分页；不持久化正文或图片访问链接。
    const CACHE_TTL = 60_000
    const pageCache = new Map()
    const diaryIndexCache = new Map()
    let scope = null
    let generation = 0
    let listRequest = 0
    let detailRequest = 0
    let controller = null
    let activeEntry = null
    let usersCache = null
    let usersPending = null
    let settingsAt = 0
    let settingsPending = null

    function cancelPendingLoad() {
        listRequest++
        controller?.abort()
        controller = null
        activeEntry = null
    }

    function invalidateContentCache() {
        cancelPendingLoad()
        generation++
        pageCache.clear()
        diaryIndexCache.clear()
        diaryDays.value = {}
        usersCache = null
        usersPending = null
    }

    function resetContentState() {
        invalidateContentCache()
        scope = null
        goBack()
        allContents.value = []
        contentImagesMap.value = {}
        authorsMap.value = {}
        totalContents.value = 0
        currentPage.value = 1
        searchQuery.value = ''
        currentTab.value = CONTENT_TYPE.DIARY
        diaryMonth.value = diaryMonthKey()
        diaryDate.value = ''
        diaryAuthor.value = 'all'
        contentLoading.value = false
        imagesLoading.value = false
        contentError.value = ''
        imagesError.value = ''
    }

    function prepareListChange() {
        cancelPendingLoad()
        allContents.value = []
        contentImagesMap.value = {}
        totalContents.value = 0
        contentError.value = ''
        imagesError.value = ''
        imagesLoading.value = false
        contentLoading.value = true
        diaryDays.value = {}
    }

    async function loadAuthors() {
        if (usersCache && Date.now() - usersCache.at < CACHE_TTL) {
            authorsMap.value = usersCache.value
            return
        }
        if (usersPending) return usersPending
        const version = generation
        const pending = getUsers().then(list => {
            if (version !== generation) return
            const value = Object.fromEntries(list.map(u => [u.id, { name: u.name || u.username || '未知', avatar: u.avatar || '👤', level: u.level }]))
            usersCache = { at: Date.now(), value }
            authorsMap.value = value
        }).catch(() => { /* 作者读取失败不阻塞正文；后续访问会重试。 */ })
            .finally(() => { if (usersPending === pending) usersPending = null })
        usersPending = pending
        return pending
    }

    function loadEntryImages(entry) {
        if (entry.images) return Promise.resolve(entry.images)
        if (entry.pending) return entry.pending
        const version = generation
        entry.imageError = ''
        if (activeEntry === entry) { imagesLoading.value = true; imagesError.value = '' }
        const pending = getImagesByContentIds(entry.rows.map(c => c.id)).then(map => {
            if (version === generation) {
                entry.images = map
                if (activeEntry === entry) contentImagesMap.value = map
            }
            return map
        }).catch(error => {
            if (version === generation) {
                entry.imageError = '图片加载失败，文字仍可正常阅读。'
                if (activeEntry === entry) imagesError.value = entry.imageError
            }
            throw error
        }).finally(() => {
            entry.pending = null
            if (version === generation && activeEntry === entry) imagesLoading.value = false
        })
        entry.pending = pending
        return pending
    }

    function showEntry(entry) {
        activeEntry = entry
        allContents.value = entry.rows
        totalContents.value = entry.total
        diaryDays.value = entry.diaryDays || {}
        contentImagesMap.value = entry.images || {}
        contentLoading.value = false
        contentError.value = ''
        imagesLoading.value = !entry.images
        imagesError.value = ''
        // 文字先呈现，不等待图片元数据和访问链接。
        void loadEntryImages(entry).catch(() => {})
    }

    async function loadContents(currentUser, { force = false } = {}) {
        const nextScope = currentUser ? `${currentUser.id}:${currentUser.level}:${currentUser.username || ''}` : 'guest'
        if (scope !== null && scope !== nextScope) resetContentState()
        scope = nextScope
        if (force) invalidateContentCache()
        cancelPendingLoad()
        const request = listRequest
        const version = generation
        const type = currentTab.value
        const page = currentPage.value
        const search = searchQuery.value.trim()
        const month = diaryMonth.value
        const date = diaryDate.value
        const author = normalizeDiaryAuthorScope(diaryAuthor.value, currentUser)
        diaryAuthor.value = author
        const key = JSON.stringify([type, page, search, ...(type === CONTENT_TYPE.DIARY ? [month, date, author] : [])])
        const cached = pageCache.get(key)
        void loadAuthors()
        if (cached && Date.now() - cached.at < CACHE_TTL) {
            showEntry(cached)
            return
        }
        contentLoading.value = true
        contentError.value = ''
        imagesError.value = ''
        imagesLoading.value = false
        allContents.value = []
        contentImagesMap.value = {}
        controller = new AbortController()
        try {
            let result
            let days = {}
            const signal = controller.signal
            if (type === CONTENT_TYPE.DIARY) {
                const indexKey = JSON.stringify([month, search, author])
                let index = diaryIndexCache.get(indexKey)
                if (!index || Date.now() - index.at >= CACHE_TTL) {
                    const rows = await getDiaryIndex({ month, search, authorScope: author, user: currentUser, signal })
                    if (request !== listRequest || version !== generation) return
                    index = { rows: sortDiaryIndex(getVisibleContents(rows, currentUser)), at: Date.now() }
                    diaryIndexCache.set(indexKey, index)
                    if (diaryIndexCache.size > 8) diaryIndexCache.delete(diaryIndexCache.keys().next().value)
                }
                days = diaryDayCounts(index.rows)
                diaryDays.value = days
                const matching = date ? index.rows.filter(row => diaryDateKey(row) === date) : index.rows
                const ids = matching.slice((page - 1) * pageSize.value, page * pageSize.value).map(row => row.id)
                const rows = await getDiaryPageRows(ids, { user: currentUser, signal })
                if (request !== listRequest || version !== generation) return
                // 索引缓存期间若记录被删除，重新读取索引，避免空页和过期总数。
                if (!force && rows.length < ids.length) return loadContents(currentUser, { force: true })
                result = { rows, total: matching.length }
            } else {
                result = await getContentsPage({ type, page, pageSize: pageSize.value, search, user: currentUser, signal })
            }
            if (request !== listRequest || version !== generation) return
            const maxPage = Math.max(1, Math.ceil(result.total / pageSize.value))
            if (page > maxPage) {
                currentPage.value = maxPage
                // 总数已变化，不能回退到仍带旧总数的缓存页。
                pageCache.clear()
                return loadContents(currentUser)
            }
            const entry = { rows: getVisibleContents(result.rows, currentUser), total: result.total, diaryDays: days, at: Date.now(), images: null, pending: null }
            pageCache.delete(key)
            pageCache.set(key, entry)
            if (pageCache.size > 12) pageCache.delete(pageCache.keys().next().value)
            showEntry(entry)
        } catch (error) {
            if (request !== listRequest || version !== generation) return
            contentError.value = '内容暂时加载失败，请检查网络后重试。'
        } finally {
            if (request === listRequest && version === generation) contentLoading.value = false
        }
    }

    async function loadSystemSettings({ force = false } = {}) {
        if (!force && settingsAt && Date.now() - settingsAt < CACHE_TTL) return
        if (settingsPending) return settingsPending
        settingsPending = getSystemSettings().then(settings => {
            sysSettings.value = settings
            settingsAt = Date.now()
        }).catch(() => { /* 保持注册关闭等安全默认值。 */ })
            .finally(() => { settingsPending = null })
        return settingsPending
    }

    function switchTab(tab) {
        currentTab.value = tab
        currentPage.value = 1
        goBack()
    }

    function openCreateModal() {
        if (modalBusy.value) return
        pendingContentId.value = crypto.randomUUID()
        modalMode.value = 'create'
        selectedContent.value = null
        formType.value = currentTab.value === 'all' ? CONTENT_TYPE.DIARY : currentTab.value
        formImages.value = []
        formCaptions.value = []
        formTitle.value = ''
        formBody.value = ''
        formDescription.value = ''
        formVisibility.value = VISIBILITY.PUBLIC
        formStartDate.value = formType.value === CONTENT_TYPE.DIARY ? diaryDate.value || localDateKey() : ''
        formEndDate.value = ''
        initialForm = formSnapshot()
        isModalOpen.value = true
    }

    function openEditModal(content) {
        if (modalBusy.value || detailImagesLoading.value || detailImagesError.value) return
        modalMode.value = 'edit'
        selectedContent.value = content
        formType.value = content.type
        const imgs = contentImagesMap.value[content.id] || []
        formImages.value = imgs.map(img => ({
            path: img.storage_path || img.url,
            url: img.url,
            thumbnail_path: img.thumbnail_path,
            thumbnail_url: img.thumbnail_url,
            is_cover: Boolean(img.is_cover),
            isNew: false
        }))
        formCaptions.value = imgs.map(img => img.caption)
        formTitle.value = content.title || ''
        formBody.value = content.body || ''
        formDescription.value = content.description || ''
        formVisibility.value = content.visibility || VISIBILITY.PUBLIC
        formStartDate.value = content.type === CONTENT_TYPE.DIARY ? diaryDateKey(content)
            : content.start_date ? formatDate(new Date(content.start_date).getTime()) : ''
        formEndDate.value = content.end_date ? formatDate(new Date(content.end_date).getTime()) : ''
        initialForm = formSnapshot()
        isModalOpen.value = true
    }

    function formSnapshot() {
        return JSON.stringify([formTitle.value, formBody.value, formDescription.value, formVisibility.value,
            formStartDate.value, formEndDate.value, formImages.value.map(image => [image.path || image.url, image.is_cover]), formCaptions.value])
    }

    function hasUnsavedContent() {
        return isModalOpen.value && formSnapshot() !== initialForm
    }

    async function closeModal(discardNewUploads = true) {
        if (discardNewUploads && modalBusy.value) return
        closing.value = true
        if (discardNewUploads) {
            const newImages = formImages.value.filter(image => image?.isNew)
            if (newImages.length > 0) {
                await deleteImageObjects(newImages).catch(error => {
                    console.warn('未保存图片清理失败:', error.message)
                })
            }
        }
        isModalOpen.value = false
        goBack()
        formImages.value = []
        formCaptions.value = []
        closing.value = false
    }

    async function handleFileUpload(event, showToastMessage) {
        const files = Array.from(event.target.files || [])
        event.target.value = ''
        if (modalBusy.value) return
        if (files.length === 0) return

        const remainingSlots = CONFIG.maxImagesPerContent - formImages.value.length
        if (remainingSlots <= 0) {
            showToastMessage(`每条内容最多上传 ${CONFIG.maxImagesPerContent} 张图片`, 'error')
            return
        }

        const maxBytes = sysSettings.value.max_image_size * 1024 * 1024
        const acceptedFiles = files.slice(0, remainingSlots)
        const invalidFile = acceptedFiles.find(file => !IMAGE_TYPES.includes(file.type) || file.size > maxBytes)
        if (invalidFile) {
            showToastMessage(`图片必须是有效格式，且单张不超过 ${sysSettings.value.max_image_size} MB`, 'error')
            return
        }

        uploading.value = true
        uploadProgress.value = { completed: 0, total: acceptedFiles.length, stage: '正在处理图片' }
        try {
            const uploaded = await uploadImages(acceptedFiles, progress => { uploadProgress.value = progress })
            formImages.value = [...formImages.value, ...uploaded]
            formCaptions.value = [...formCaptions.value, ...new Array(uploaded.length).fill('')]
            if (files.length > remainingSlots) {
                showToastMessage(`只上传了前 ${remainingSlots} 张，最多允许 ${CONFIG.maxImagesPerContent} 张`)
            }
        } catch (error) {
            showToastMessage('图片上传失败: ' + error.message, 'error')
        } finally {
            uploading.value = false
        }
    }

    async function removeImage(index) {
        if (modalBusy.value) return
        const [removed] = formImages.value.splice(index, 1)
        formCaptions.value.splice(index, 1)
        if (removed?.isNew) {
            await deleteImageObjects([removed]).catch(error => {
                console.warn('图片文件清理失败:', error.message)
            })
        }
    }

    function moveImage(index, direction) {
        if (modalBusy.value) return
        const destination = index + direction
        if (destination < 0 || destination >= formImages.value.length) return
        const [image] = formImages.value.splice(index, 1)
        const [caption] = formCaptions.value.splice(index, 1)
        formImages.value.splice(destination, 0, image)
        formCaptions.value.splice(destination, 0, caption)
    }

    function setCover(index) {
        if (modalBusy.value) return
        formImages.value = formImages.value.map((image, i) => ({ ...image, is_cover: i === index }))
    }

    async function handleSaveContent(currentUser, showToastMessage) {
        if (modalBusy.value) return false
        if (!currentUser) { showToastMessage('请先登录', 'error'); return false }
        if (!formTitle.value.trim()) {
            showToastMessage('请输入标题', 'error')
            return
        }
        if (formType.value === CONTENT_TYPE.DIARY && !isDiaryDate(formStartDate.value)) {
            showToastMessage('请选择有效的日记日期', 'error')
            return false
        }
        if (formStartDate.value && formEndDate.value && formStartDate.value > formEndDate.value) {
            showToastMessage('结束日期不能早于开始日期', 'error')
            return
        }
        // 编辑权限二次校验：非作者即使拿到编辑弹窗也不能保存
        if (modalMode.value === 'edit' && selectedContent.value && selectedContent.value.author_id !== currentUser.id) {
            showToastMessage('只有作者本人可以修改', 'error')
            return
        }
        const contentData = {
            id: pendingContentId.value,
            authorId: currentUser.id,
            type: formType.value,
            title: formTitle.value.trim(),
            body: formBody.value,
            description: formDescription.value,
            visibility: formVisibility.value,
            images: formImages.value,
            captions: formCaptions.value,
            startDate: formStartDate.value ? new Date(formStartDate.value).toISOString() : null,
            endDate: formEndDate.value ? new Date(formEndDate.value).toISOString() : null
        }

        saving.value = true
        try {
            if (modalMode.value === 'create') {
                await createContentApi(contentData)
                showToastMessage('发布成功')
            } else {
                await updateContentApi(selectedContent.value.id, contentData)
                showToastMessage('更新成功')
            }
            if (formType.value === CONTENT_TYPE.DIARY && currentTab.value === CONTENT_TYPE.DIARY) {
                diaryMonth.value = diaryMonthKey(formStartDate.value)
                diaryDate.value = formStartDate.value
                if (diaryAuthor.value === 'other') diaryAuthor.value = 'mine'
                searchQuery.value = ''
                currentPage.value = 1
            }
            await closeModal(false)
            return true
        } catch (e) {
            showToastMessage('操作失败: ' + e.message, 'error')
            return false
        } finally {
            saving.value = false
        }
    }

    async function handleDeleteContent(content, showToastMessage, currentUser) {
        // 删除权限二次校验：仅作者本人
        if (currentUser && content.author_id !== currentUser.id) {
            showToastMessage('只有作者本人可以删除', 'error')
            return false
        }
        try {
            await deleteContentApi(content.id)
            selectedContent.value = null
            showToastMessage('已删除')
            return true
        } catch (e) {
            showToastMessage('删除失败: ' + e.message, 'error')
            return false
        }
    }

    async function selectContent(content) {
        const request = ++detailRequest
        const version = generation
        selectedContent.value = content
        selectedContentImages.value = []
        detailImagesLoading.value = true
        detailImagesError.value = ''
        try {
            let imgs = contentImagesMap.value[content.id]
            if (!imgs) {
                const entry = activeEntry
                if (entry?.rows.some(row => row.id === content.id)) {
                    imgs = (await loadEntryImages(entry))[content.id] || []
                } else {
                    imgs = await getImagesByContentId(content.id)
                }
            }
            if (request !== detailRequest || version !== generation) return
            selectedContentImages.value = imgs
            contentImagesMap.value = { ...contentImagesMap.value, [content.id]: imgs }
        } catch {
            if (request === detailRequest && version === generation) detailImagesError.value = '图片加载失败，请重试后再编辑。'
        } finally {
            if (request === detailRequest && version === generation) detailImagesLoading.value = false
        }
    }

    async function retryImages() {
        if (selectedContent.value) return selectContent(selectedContent.value)
        if (activeEntry) await loadEntryImages(activeEntry).catch(() => {})
    }

    function goBack() {
        detailRequest++
        selectedContent.value = null
        selectedContentImages.value = []
        detailImagesLoading.value = false
        detailImagesError.value = ''
    }

    const folderColors = ['#FF6B9D', '#4ECDC4', '#1A535C', '#FFE66D', '#FF9F1C', '#9B5DE5', '#00BBF9', '#00F5D4']

    return {
        allContents, contentImagesMap, authorsMap, contentLoading, selectedContent, selectedContentImages,
        currentTab, sysSettings, folderColors,
        currentPage, pageSize, searchQuery, totalContents, contentError, imagesLoading, imagesError,
        diaryMonth, diaryDate, diaryAuthor, diaryDays,
        detailImagesLoading, detailImagesError, retryImages,
        resetContentState, invalidateContentCache, prepareListChange, cancelPendingLoad,
        isModalOpen, modalMode, formImages, formCaptions,
        formTitle, formBody, formDescription, formVisibility,
        formStartDate, formEndDate, formType,
        saving, uploading, modalBusy, uploadProgress, moveImage, setCover,
        loadContents, loadSystemSettings, switchTab,
        openCreateModal, openEditModal, hasUnsavedContent, closeModal,
        handleFileUpload, removeImage, handleSaveContent,
        handleDeleteContent, selectContent, goBack
    }
}

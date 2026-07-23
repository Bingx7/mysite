import { ref } from 'vue'
import { VISIBILITY, CONTENT_TYPE } from '../config'
import { getVisibleContents } from '../permissions'
import { getSystemSettings } from '../data'
import {
    getContentsByType,
    getImagesByContentId,
    createContent as createContentApi,
    updateContentApi,
    deleteContentApi,
    uploadImages
} from '../api'
import { formatDate } from '../utils'

/* ===== 本地缓存 ===== */
function getCacheKey(tab) { return `cache_contents_${tab}` }

function readCache(tab) {
    try {
        const raw = localStorage.getItem(getCacheKey(tab))
        if (!raw) return null
        const { data, images, time } = JSON.parse(raw)
        return { data, images, time }
    } catch { return null }
}

function writeCache(tab, data, images) {
    try {
        localStorage.setItem(getCacheKey(tab), JSON.stringify({ data, images, time: Date.now() }))
    } catch { /* localStorage 满了就忽略 */ }
}

function clearCache(tab) {
    try { localStorage.removeItem(getCacheKey(tab)) } catch { /* ignore */ }
}

/* ===== 内容状态管理 ===== */
export function useContents() {
    const allContents = ref([])
    const contentImagesMap = ref({})
    const selectedContent = ref(null)
    const selectedContentImages = ref([])
    const currentTab = ref(CONTENT_TYPE.DIARY)
    const sysSettings = ref({ registration_open: true, daily_post_limit: 10, max_image_size: 10 })
    const contentLoading = ref(false)

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

    async function loadContents(currentUser) {
        contentLoading.value = true
        // 先读缓存立即显示
        const cached = readCache(currentTab.value)
        if (cached) {
            const visible = getVisibleContents(cached.data, currentUser)
            visible.sort((a, b) => b.created_at - a.created_at)
            allContents.value = visible
            contentImagesMap.value = cached.images || {}
            contentLoading.value = false
        }
        // 同时从 Supabase 拉最新数据
        try {
            let contents
            if (currentTab.value === 'all') {
                const types = [CONTENT_TYPE.DIARY, CONTENT_TYPE.ARTICLE, CONTENT_TYPE.ALBUM]
                const results = await Promise.all(types.map(t => getContentsByType(t)))
                contents = results.flat()
            } else {
                contents = await getContentsByType(currentTab.value)
            }

            contents = getVisibleContents(contents, currentUser)
            contents.sort((a, b) => b.created_at - a.created_at)

            const imageMap = {}
            await Promise.all(contents.map(async (c) => {
                const imgs = await getImagesByContentId(c.id)
                imageMap[c.id] = imgs
            }))
            contentImagesMap.value = imageMap
            allContents.value = contents
            // 写入缓存
            writeCache(currentTab.value, contents, imageMap)
        } finally {
            contentLoading.value = false
        }
    }

    async function loadSystemSettings() {
        const settings = await getSystemSettings()
        sysSettings.value = settings
    }

    function switchTab(tab) {
        currentTab.value = tab
        selectedContent.value = null
    }

    function openCreateModal() {
        modalMode.value = 'create'
        selectedContent.value = null
        formImages.value = []
        formCaptions.value = []
        formTitle.value = ''
        formBody.value = ''
        formDescription.value = ''
        formVisibility.value = VISIBILITY.PUBLIC
        formStartDate.value = ''
        formEndDate.value = ''
        isModalOpen.value = true
    }

    function openEditModal(content) {
        modalMode.value = 'edit'
        selectedContent.value = content
        const imgs = contentImagesMap.value[content.id] || []
        formImages.value = imgs.map(img => img.url)
        formCaptions.value = imgs.map(img => img.caption)
        formTitle.value = content.title || ''
        formBody.value = content.body || ''
        formDescription.value = content.description || ''
        formVisibility.value = content.visibility || VISIBILITY.PUBLIC
        formStartDate.value = content.start_date ? formatDate(new Date(content.start_date).getTime()) : ''
        formEndDate.value = content.end_date ? formatDate(new Date(content.end_date).getTime()) : ''
        isModalOpen.value = true
    }

    function hasUnsavedContent() {
        return formTitle.value
            || formBody.value
            || formDescription.value
            || formImages.value.length > 0
            || formStartDate.value
            || formEndDate.value
            || formVisibility.value !== VISIBILITY.PUBLIC
    }

    function closeModal() {
        isModalOpen.value = false
        selectedContent.value = null
        formImages.value = []
        formCaptions.value = []
    }

    async function handleFileUpload(event) {
        const files = event.target.files
        if (files && files.length > 0) {
            const urls = await uploadImages(files)
            formImages.value = [...formImages.value, ...urls]
            formCaptions.value = [...formCaptions.value, ...new Array(urls.length).fill('')]
        }
    }

    function removeImage(index) {
        formImages.value.splice(index, 1)
        formCaptions.value.splice(index, 1)
    }

    async function handleSaveContent(currentUser, showToastMessage) {
        if (!formTitle.value) {
            showToastMessage('请输入标题', 'error')
            return
        }
        const contentData = {
            authorId: currentUser.id,
            type: currentTab.value,
            title: formTitle.value,
            body: formBody.value,
            description: formDescription.value,
            visibility: formVisibility.value,
            images: formImages.value,
            captions: formCaptions.value
        }
        if (formStartDate.value) contentData.startDate = new Date(formStartDate.value).getTime()
        if (formEndDate.value) contentData.endDate = new Date(formEndDate.value).getTime()

        try {
            if (modalMode.value === 'create') {
                await createContentApi(contentData)
                clearCache(currentTab.value)
                clearCache('all')
                showToastMessage('发布成功')
            } else {
                await updateContentApi(selectedContent.value.id, contentData)
                clearCache(currentTab.value)
                clearCache('all')
                showToastMessage('更新成功')
            }
            closeModal()
            return true
        } catch (e) {
            showToastMessage('操作失败: ' + e.message, 'error')
            return false
        }
    }

    async function handleDeleteContent(content, showToastMessage) {
        try {
            await deleteContentApi(content.id)
            clearCache(currentTab.value)
            clearCache('all')
            selectedContent.value = null
            showToastMessage('已删除')
            return true
        } catch (e) {
            showToastMessage('删除失败: ' + e.message, 'error')
            return false
        }
    }

    async function selectContent(content) {
        selectedContent.value = content
        const imgs = contentImagesMap.value[content.id] || []
        if (imgs.length === 0) {
            selectedContentImages.value = await getImagesByContentId(content.id)
        } else {
            selectedContentImages.value = imgs
        }
    }

    function goBack() {
        selectedContent.value = null
        selectedContentImages.value = []
    }

    const folderColors = ['#FF6B9D', '#4ECDC4', '#1A535C', '#FFE66D', '#FF9F1C', '#9B5DE5', '#00BBF9', '#00F5D4']

    return {
        allContents, contentImagesMap, contentLoading, selectedContent, selectedContentImages,
        currentTab, sysSettings, folderColors,
        isModalOpen, modalMode, formImages, formCaptions,
        formTitle, formBody, formDescription, formVisibility,
        formStartDate, formEndDate,
        loadContents, loadSystemSettings, switchTab,
        openCreateModal, openEditModal, hasUnsavedContent, closeModal,
        handleFileUpload, removeImage, handleSaveContent,
        handleDeleteContent, selectContent, goBack
    }
}

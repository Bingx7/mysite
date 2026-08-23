import { ref } from 'vue'
import { VISIBILITY, CONTENT_TYPE } from '../config'
import { getVisibleContents } from '../permissions'
import { getSystemSettings, getUsers } from '../data'
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
    const authorsMap = ref({})        // { [userId]: { name, avatar, level } }
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
        // 内容缓存版本号：如果数据结构变了，改版本号会强制废弃老缓存
        const CACHE_VERSION = 2
        function getCacheKeyV(tab) { return `${getCacheKey(tab)}__v${CACHE_VERSION}` }
        function readCacheV(tab) {
            try {
                const raw = localStorage.getItem(getCacheKeyV(tab))
                if (!raw) return null
                const { data, images, time } = JSON.parse(raw)
                return { data, images, time }
            } catch { return null }
        }
        function writeCacheV(tab, data, images) {
            try {
                localStorage.setItem(getCacheKeyV(tab), JSON.stringify({ data, images, time: Date.now() }))
            } catch { /* localStorage 满了就忽略 */ }
        }
        // 清理旧版本缓存
        try { localStorage.removeItem(getCacheKey(currentTab.value)) } catch { /* ignore */ }

        // 先读缓存立即显示
        const cached = readCacheV(currentTab.value)
        if (cached) {
            const visible = getVisibleContents(cached.data, currentUser)
            visible.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            allContents.value = visible
            contentImagesMap.value = cached.images || {}
            contentLoading.value = false
        }

        // 同时拉取用户列表（用于显示作者名），缓存里暂不处理作者，直接每次拉
        const usersPromise = getUsers().then(list => {
            const map = {}
            for (const u of list) {
                map[u.id] = { name: u.name || u.username || '未知', avatar: u.avatar || '👤', level: u.level }
            }
            authorsMap.value = map
        }).catch(() => { authorsMap.value = {} })

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
            contents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

            const imageMap = {}
            await Promise.all(contents.map(async (c) => {
                const imgs = await getImagesByContentId(c.id)
                imageMap[c.id] = imgs
            }))
            contentImagesMap.value = imageMap
            allContents.value = contents
            // 写入缓存
            writeCacheV(currentTab.value, contents, imageMap)
        } catch (e) {
            console.error('loadContents error:', e)
        } finally {
            await usersPromise
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
        // 编辑权限二次校验：非作者即使拿到编辑弹窗也不能保存
        if (modalMode.value === 'edit' && selectedContent.value && selectedContent.value.author_id !== currentUser.id) {
            showToastMessage('只有作者本人可以修改', 'error')
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

    async function handleDeleteContent(content, showToastMessage, currentUser) {
        // 删除权限二次校验：仅作者本人
        if (currentUser && content.author_id !== currentUser.id) {
            showToastMessage('只有作者本人可以删除', 'error')
            return false
        }
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
        allContents, contentImagesMap, authorsMap, contentLoading, selectedContent, selectedContentImages,
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

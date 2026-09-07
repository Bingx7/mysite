import { ref } from 'vue'
import { CONFIG, VISIBILITY, CONTENT_TYPE } from '../config'
import { getVisibleContents } from '../permissions'
import { getSystemSettings, getUsers } from '../data'
import {
    getContentsByType,
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

    async function loadContents(currentUser) {
        contentLoading.value = true

        // 这个站点数据量很小，直接读取 Supabase；不把私密正文和图片信息持久化到 localStorage。
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
        } catch (e) {
            console.error('loadContents error:', e)
            allContents.value = []
            contentImagesMap.value = {}
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
        formType.value = currentTab.value === 'all' ? CONTENT_TYPE.DIARY : currentTab.value
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
        formType.value = content.type
        const imgs = contentImagesMap.value[content.id] || []
        formImages.value = imgs.map(img => ({
            path: img.storage_path || img.url,
            url: img.url,
            isNew: false
        }))
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

    async function closeModal(discardNewUploads = true) {
        if (discardNewUploads) {
            const newImages = formImages.value.filter(image => image?.isNew)
            if (newImages.length > 0) {
                await deleteImageObjects(newImages).catch(error => {
                    console.warn('未保存图片清理失败:', error.message)
                })
            }
        }
        isModalOpen.value = false
        selectedContent.value = null
        formImages.value = []
        formCaptions.value = []
    }

    async function handleFileUpload(event, showToastMessage) {
        const files = Array.from(event.target.files || [])
        event.target.value = ''
        if (files.length === 0) return

        const remainingSlots = CONFIG.maxImagesPerContent - formImages.value.length
        if (remainingSlots <= 0) {
            showToastMessage(`每条内容最多上传 ${CONFIG.maxImagesPerContent} 张图片`, 'error')
            return
        }

        const maxBytes = sysSettings.value.max_image_size * 1024 * 1024
        const acceptedFiles = files.slice(0, remainingSlots)
        const invalidFile = acceptedFiles.find(file => !file.type.startsWith('image/') || file.size > maxBytes)
        if (invalidFile) {
            showToastMessage(`图片必须是有效格式，且单张不超过 ${sysSettings.value.max_image_size} MB`, 'error')
            return
        }

        try {
            const uploaded = await uploadImages(acceptedFiles)
            formImages.value = [...formImages.value, ...uploaded]
            formCaptions.value = [...formCaptions.value, ...new Array(uploaded.length).fill('')]
            if (files.length > remainingSlots) {
                showToastMessage(`只上传了前 ${remainingSlots} 张，最多允许 ${CONFIG.maxImagesPerContent} 张`)
            }
        } catch (error) {
            showToastMessage('图片上传失败: ' + error.message, 'error')
        }
    }

    async function removeImage(index) {
        const [removed] = formImages.value.splice(index, 1)
        formCaptions.value.splice(index, 1)
        if (removed?.isNew) {
            await deleteImageObjects([removed]).catch(error => {
                console.warn('图片文件清理失败:', error.message)
            })
        }
    }

    async function handleSaveContent(currentUser, showToastMessage) {
        if (!formTitle.value) {
            showToastMessage('请输入标题', 'error')
            return
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
            authorId: currentUser.id,
            type: formType.value,
            title: formTitle.value,
            body: formBody.value,
            description: formDescription.value,
            visibility: formVisibility.value,
            images: formImages.value,
            captions: formCaptions.value,
            startDate: formStartDate.value ? new Date(formStartDate.value).getTime() : null,
            endDate: formEndDate.value ? new Date(formEndDate.value).getTime() : null
        }

        try {
            if (modalMode.value === 'create') {
                await createContentApi(contentData)
                showToastMessage('发布成功')
            } else {
                await updateContentApi(selectedContent.value.id, contentData)
                showToastMessage('更新成功')
            }
            await closeModal(false)
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
        formStartDate, formEndDate, formType,
        loadContents, loadSystemSettings, switchTab,
        openCreateModal, openEditModal, hasUnsavedContent, closeModal,
        handleFileUpload, removeImage, handleSaveContent,
        handleDeleteContent, selectContent, goBack
    }
}

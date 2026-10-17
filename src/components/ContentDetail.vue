<script setup>
import { ref, computed, watch } from 'vue'
import { CONTENT_TYPE } from '../config'
import { formatDate, formatDateRange, getVisibilityLabel, getContentTypeLabel } from '../utils'
import { canEditContent, canDeleteContent } from '../permissions'
import { diaryDateKey } from '../diary.js'
import Lightbox from './Lightbox.vue'
import MediaImage from './MediaImage.vue'

const props = defineProps({ content: Object, images: Array, currentUser: Object, isLoggedIn: Boolean, author: Object, imagesLoading: Boolean, imagesError: String })
defineEmits(['back', 'edit', 'delete', 'retryImages'])
const lightboxIndex = ref(-1)
watch(() => props.content?.id, () => { lightboxIndex.value = -1 })
const authorName = computed(() => props.author?.name || '未知作者')
const canEdit = computed(() => canEditContent(props.content, props.currentUser))
const canDelete = computed(() => canDeleteContent(props.content, props.currentUser))
</script>

<template>
    <article v-if="content" :class="['content-detail', { 'album-detail': content.type === CONTENT_TYPE.ALBUM }]">
        <div class="detail-toolbar">
            <button class="back-btn" @click="$emit('back')">← 返回列表</button>
            <span>{{ getContentTypeLabel(content.type) }}</span>
        </div>
        <header class="detail-header">
            <h1 class="detail-title">{{ content.title }}</h1>
            <div class="detail-meta">
                <span class="detail-author">{{ authorName }}</span>
                <span v-if="content.type === CONTENT_TYPE.DIARY">日记日期 {{ diaryDateKey(content) }}</span>
                <span v-else>{{ formatDate(new Date(content.created_at).getTime(), true) }}</span>
                <span class="visibility-label">{{ getVisibilityLabel(content.visibility) }}</span>
                <span v-if="images.length">{{ images.length }} 张图片</span>
            </div>
            <p v-if="content.type === CONTENT_TYPE.ALBUM && content.start_date" class="album-period">{{ formatDateRange(new Date(content.start_date).getTime(), content.end_date ? new Date(content.end_date).getTime() : null) }}</p>
        </header>
        <div v-if="content.body" class="detail-body">{{ content.body }}</div>
        <div v-if="content.description" class="detail-body">{{ content.description }}</div>
        <p v-if="imagesLoading" class="detail-image-status" role="status">图片加载中，您可以先阅读正文…</p>
        <div v-if="imagesError" class="detail-image-status" role="alert">{{ imagesError }} <button class="btn btn-secondary" @click="$emit('retryImages')">重试图片</button></div>
        <div v-if="images.length" class="detail-images">
            <figure v-for="(img, index) in images" :key="img.id" class="detail-image">
                <button class="image-open" :aria-label="`查看大图：${img.caption || '图片'}`" @click="lightboxIndex = index"><MediaImage :src="img.url" :alt="img.caption || '图片'" /></button>
                <figcaption v-if="img.caption" class="image-caption">{{ img.caption }}</figcaption>
            </figure>
        </div>
        <div v-if="isLoggedIn && (canEdit || canDelete)" class="detail-actions">
            <button v-if="canEdit" :disabled="imagesLoading || Boolean(imagesError)" class="btn btn-secondary" @click="$emit('edit', content)">编辑内容</button>
            <button v-if="canDelete" class="delete-btn" @click="$emit('delete', content)">删除</button>
        </div>
        <Lightbox v-if="lightboxIndex >= 0 && images.length" :images="images" :initialIndex="lightboxIndex" @close="lightboxIndex = -1" />
    </article>
</template>

<style scoped>
.detail-image-status { color: var(--text-secondary); font-size: 13px; margin: 20px 0; }
.content-detail { max-width: 720px; margin: 0 auto; }
.album-detail { max-width: 100%; }
.detail-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid var(--border); color: var(--text-secondary); font-size: 11px; }
.back-btn { background: transparent; border: 0; color: var(--text-secondary); padding: 6px 0; cursor: pointer; font-size: 12px; }
.back-btn:hover { color: var(--text); }
.detail-header { margin-bottom: 32px; }
.detail-header::before { content: ''; display: block; width: 32px; height: 3px; margin-bottom: 22px; background: var(--brand-color); }
.detail-title { font-size: 32px; font-weight: 600; line-height: 1.5; letter-spacing: -.03em; overflow-wrap: anywhere; }
.detail-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 14px; margin-top: 18px; color: var(--text-secondary); font-size: 11px; }
.detail-author { color: var(--text); }
.visibility-label { padding: 1px 6px; border: 1px solid var(--border); border-radius: 3px; font-size: 10px; }
.album-period { color: var(--text-secondary); margin-top: 12px; font-size: 12px; }
.detail-body { color: var(--text); font-size: calc(var(--font-size) + 2px); line-height: 1.9; white-space: pre-wrap; overflow-wrap: anywhere; margin-bottom: 32px; }
.detail-images { display: grid; grid-template-columns: 1fr; gap: 28px; margin-bottom: 32px; }
.album-detail .detail-images { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
.detail-image { min-width: 0; }
.image-open { display: block; width: 100%; border: 0; background: var(--surface-muted); padding: 0; cursor: zoom-in; border-radius: 6px; overflow: hidden; }
.image-open :deep(img) { display: block; width: 100%; height: auto; }
.image-caption { padding-top: 10px; color: var(--text-secondary); font-size: 12px; line-height: 1.7; }
.detail-actions { display: flex; align-items: center; gap: 20px; border-top: 1px solid var(--border); padding-top: 24px; margin-top: 40px; }
.delete-btn { background: transparent; border: 0; padding: 8px; color: var(--danger); font-size: 12px; cursor: pointer; }
@media (max-width: 600px) {
    .detail-toolbar { margin-bottom: 28px; }
    .detail-title { font-size: 25px; }
    .detail-meta { gap: 10px; }
    .album-detail .detail-images { grid-template-columns: 1fr; }
    .detail-images { gap: 22px; }
}
</style>

<script setup>
import { ref, computed } from 'vue'
import { CONTENT_TYPE, visibilityConfig } from '../config'
import { formatDate, formatDateRange, getVisibilityLabel, getVisibilityIcon, getVisibilityColor } from '../utils'
import { canEditContent, canDeleteContent } from '../permissions'
import Lightbox from './Lightbox.vue'

const props = defineProps({
    content: Object,
    images: Array,
    currentUser: Object,
    isLoggedIn: Boolean,
    author: Object
})

const emit = defineEmits(['back', 'edit', 'delete'])

const lightboxSrc = ref('')

function openLightbox(url) { lightboxSrc.value = url }
function closeLightbox() { lightboxSrc.value = '' }

const authorName = computed(() => props.author?.name || '未知作者')
const authorAvatar = computed(() => props.author?.avatar || '👤')

const canEdit = computed(() => canEditContent(props.content, props.currentUser))
const canDelete = computed(() => canDeleteContent(props.content, props.currentUser))
</script>

<template>
    <div v-if="content" class="content-detail">
        <button class="btn btn-secondary" @click="$emit('back')" style="margin-bottom:20px;">← 返回</button>
        <div class="detail-header">
            <div class="detail-author-row">
                <span class="detail-author-badge">
                    <span class="detail-author-avatar">{{ authorAvatar }}</span>
                    <span class="detail-author-name">{{ authorName }}</span>
                </span>
            </div>
            <div class="detail-title">{{ content.title }}</div>
            <div class="detail-meta">
                <span :style="{ color: getVisibilityColor(content.visibility) }">{{ getVisibilityIcon(content.visibility) }} {{ getVisibilityLabel(content.visibility) }}</span>
                <span>{{ content.type === CONTENT_TYPE.DIARY ? '📝 日记' : content.type === CONTENT_TYPE.ARTICLE ? '📄 文章' : '🖼️ 照片集' }}</span>
                <span>📅 {{ formatDate(new Date(content.created_at).getTime(), true) }}</span>
                <span v-if="content.type === CONTENT_TYPE.ALBUM && content.start_date">📅 {{ formatDateRange(new Date(content.start_date).getTime(), content.end_date ? new Date(content.end_date).getTime() : null) }}</span>
            </div>
        </div>
        <div v-if="content.body" class="detail-body">{{ content.body }}</div>
        <div v-if="content.description" class="detail-body">{{ content.description }}</div>
        <div v-if="images.length > 0" class="detail-images">
            <div v-for="img in images" :key="img.id" class="detail-image" @click="openLightbox(img.url)">
                <img :src="img.url" :alt="img.caption || '图片'">
                <div v-if="img.caption" class="image-caption">{{ img.caption }}</div>
            </div>
        </div>
        <div v-if="isLoggedIn && canEdit" class="detail-actions" style="margin-top:24px;">
            <button class="btn btn-primary" @click="$emit('edit', content)">编辑</button>
            <button class="btn btn-danger" @click="$emit('delete', content)">删除</button>
        </div>

        <Lightbox v-if="lightboxSrc" :src="lightboxSrc" @close="closeLightbox" />
    </div>
</template>

<style scoped>
.content-detail { padding: 0; }

.detail-header { margin-bottom: 32px; }
.detail-author-row { margin-bottom: 10px; }
.detail-author-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background-color: rgba(232, 200, 122, 0.24);
    padding: 6px 14px;
    border-radius: 999px;
}
.detail-author-avatar { font-size: 18px; line-height: 1; }
.detail-author-name {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-color, #5A4E3C);
}
.detail-title { font-size: 28px; font-weight: 700; color: var(--text-color, #2D3436); margin: 20px 0; }
.detail-meta { font-size: 14px; color: var(--text-secondary-color, #636E72); display: flex; flex-wrap: wrap; gap: 16px; }

.detail-body { font-size: 16px; color: var(--text-color, #2D3436); line-height: 1.8; margin-bottom: 32px; }

.detail-images { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 32px; }
.detail-image { border-radius: 14px; overflow: hidden; cursor: pointer; transition: transform 0.2s; }
.detail-image:hover { transform: scale(1.02); }
.detail-image img { width: 100%; height: auto; }
.image-caption { padding: 10px 14px; font-size: 14px; color: var(--text-secondary-color, #636E72); background-color: rgba(0, 0, 0, 0.03); }

.detail-actions { display: flex; gap: 16px; }



@media (max-width: 768px) { .detail-images { grid-template-columns: 1fr; } }
</style>

<script setup>
import { ref, computed } from 'vue'
import { CONTENT_TYPE } from '../config'
import { formatDate, formatDateRange, truncateText, getVisibilityLabel, getVisibilityIcon, getVisibilityColor } from '../utils'

const props = defineProps({
    contents: Array,
    imagesMap: Object,
    currentTab: String,
    folderColors: Array
})

const emit = defineEmits(['select'])

const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = computed(() => props.currentTab === CONTENT_TYPE.ALBUM ? 12 : 8)

const filteredContents = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return props.contents
    return props.contents.filter(c =>
        (c.title || '').toLowerCase().includes(q) ||
        (c.body || '').toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q)
    )
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredContents.value.length / pageSize.value)))

const pagedContents = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return filteredContents.value.slice(start, start + pageSize.value)
})

function goPage(p) {
    if (p >= 1 && p <= totalPages.value) currentPage.value = p
}

// 搜索时重置页码
import { watch } from 'vue'
watch(searchQuery, () => { currentPage.value = 1 })
</script>

<template>
    <!-- 搜索栏 -->
    <div v-if="contents.length > 0 || searchQuery" class="search-bar">
        <input v-model="searchQuery" type="text" class="search-input" placeholder="搜索内容...">
        <span v-if="searchQuery" class="search-clear" @click="searchQuery = ''">✕</span>
    </div>

    <!-- 日记 / 文章列表 -->
    <div v-if="currentTab !== CONTENT_TYPE.ALBUM" class="content-list">
        <div v-for="content in pagedContents" :key="content.id" class="card card-shadow" @click="$emit('select', content)">
            <div class="card-header">
                <div class="card-title">{{ content.title }}</div>
                <div class="card-meta">
                    <span :style="{ color: getVisibilityColor(content.visibility) }">{{ getVisibilityIcon(content.visibility) }} {{ getVisibilityLabel(content.visibility) }}</span>
                    <span>📅 {{ formatDate(new Date(content.created_at).getTime()) }}</span>
                </div>
            </div>
            <div v-if="content.body || content.description" class="card-body">
                <div class="card-text">{{ truncateText(content.body || content.description, 150) }}</div>
                <div v-if="(imagesMap[content.id] || []).length > 0" class="card-images">
                    <div v-for="img in (imagesMap[content.id] || []).slice(0, 3)" :key="img.id"
                        class="card-image" :style="{ backgroundImage: 'url(' + img.url + ')' }">
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <span>{{ content.type === CONTENT_TYPE.DIARY ? '日记' : '文章' }}</span>
            </div>
        </div>
        <div v-if="filteredContents.length === 0 && searchQuery" class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-text">未找到匹配内容</div>
            <div class="empty-state-hint">试试其他关键词</div>
        </div>
        <div v-else-if="filteredContents.length === 0" class="empty-state">
            <div class="empty-state-icon">📭</div>
            <div class="empty-state-text">暂无内容</div>
            <div class="empty-state-hint">当前用户没有可见的内容</div>
        </div>
    </div>

    <!-- 照片集列表 -->
    <div v-else>
        <div class="album-grid">
            <div v-for="content in pagedContents" :key="content.id" class="album-card" @click="$emit('select', content)">
                <div class="album-visual">
                    <div :class="['album-folder']" :style="{ backgroundColor: folderColors[0] }">
                        <div class="folder-tab" :style="{ backgroundColor: folderColors[0] }"></div>
                        <div class="folder-content">
                            <div v-if="(imagesMap[content.id] || []).length > 0"
                                v-for="(img, idx) in (imagesMap[content.id] || []).slice(0, 3)" :key="img.id"
                                class="folder-image" :style="{ backgroundImage: 'url(' + img.url + ')' }">
                            </div>
                            <div v-if="(imagesMap[content.id] || []).length === 0" class="folder-placeholder">🖼️</div>
                        </div>
                    </div>
                </div>
                <div class="album-info">
                    <div class="album-title">{{ content.title }}</div>
                    <div class="album-stats">
                        <span :style="{ color: getVisibilityColor(content.visibility) }">{{ getVisibilityIcon(content.visibility) }}</span>
                        <span v-if="content.start_date">📅 {{ formatDateRange(content.start_date ? new Date(content.start_date).getTime() : null, content.end_date ? new Date(content.end_date).getTime() : null) }}</span>
                        <span v-else>📅 {{ formatDate(new Date(content.created_at).getTime()) }}</span>
                    </div>
                </div>
            </div>
            <div v-if="filteredContents.length === 0 && searchQuery" class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-text">未找到匹配内容</div>
                <div class="empty-state-hint">试试其他关键词</div>
            </div>
            <div v-else-if="filteredContents.length === 0" class="empty-state">
                <div class="empty-state-icon">📭</div>
                <div class="empty-state-text">暂无内容</div>
                <div class="empty-state-hint">当前用户没有可见的内容</div>
            </div>
        </div>
    </div>

    <!-- 分页 -->
    <div v-if="totalPages > 1" class="pagination">
        <button class="page-btn" :disabled="currentPage === 1" @click="goPage(currentPage - 1)">‹ 上一页</button>
        <template v-for="p in totalPages" :key="p">
            <button v-if="p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2 || (p === 2 && currentPage > 4) || (p === totalPages - 1 && currentPage < totalPages - 3)"
                :class="['page-num', { active: p === currentPage }]" @click="goPage(p)">{{ p }}</button>
            <span v-else-if="(p === 2 && currentPage > 4) || (p === totalPages - 1 && currentPage < totalPages - 3)" class="page-dots">…</span>
        </template>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="goPage(currentPage + 1)">下一页 ›</button>
    </div>
</template>

<style scoped>
/* 搜索 */
.search-bar {
    position: relative; margin-bottom: 24px; max-width: 400px;
}
.search-input {
    width: 100%; padding: 12px 40px 12px 16px; border: 1px solid var(--border-color, #E8E7E4);
    border-radius: 10px; font-size: 14px; background: rgba(255,255,255,0.7);
    color: var(--text-color, #2D3436); transition: border-color 0.2s;
}
.search-input:focus { outline: none; border-color: var(--brand-color, #4A5C6B); }
.search-clear {
    position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
    cursor: pointer; color: var(--text-secondary-color, #636E72); font-size: 16px;
}

.content-list { display: flex; flex-direction: column; }

.album-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px; }

.album-card { cursor: pointer; transition: transform 0.3s; }
.album-card:hover { transform: translateY(-6px); }

.album-visual { margin-bottom: 16px; }

.album-folder {
    background-color: var(--folder-color); border-radius: 14px; padding: 20px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18); position: relative; min-height: 180px;
}

.folder-tab {
    position: absolute; top: -12px; left: 24px; width: 50px; height: 20px;
    background-color: var(--folder-color); border-radius: 10px 10px 0 0;
    box-shadow: 0 -4px 8px rgba(0, 0, 0, 0.12);
}

.folder-content { position: relative; padding-top: 12px; height: 140px; }

.folder-image {
    position: absolute; width: 65%; aspect-ratio: 3/4;
    background-size: cover; background-position: center; border-radius: 8px;
    box-shadow: 0 5px 14px rgba(0, 0, 0, 0.3); transition: all 0.3s;
}
.folder-image:nth-child(1) { z-index: 3; left: 0; top: 0; transform: rotate(-3deg); }
.folder-image:nth-child(2) { z-index: 2; right: 0; top: 10px; width: 55%; transform: rotate(4deg); }
.folder-image:nth-child(3) { z-index: 1; left: 50%; top: -8px; transform: translateX(-50%) rotate(0deg); width: 60%; }

.folder-placeholder {
    width: 100%; aspect-ratio: 4/3; display: flex; align-items: center; justify-content: center;
    font-size: 40px; background-color: rgba(255, 255, 255, 0.2); border-radius: 8px;
}

.album-info { text-align: center; }
.album-title { font-size: 15px; font-weight: 700; color: var(--text-color, #2D3436); margin-bottom: 6px; letter-spacing: -0.02em; }
.album-stats { font-size: 13px; color: var(--text-secondary-color, #636E72); }

.card {
    background-color: rgba(255, 255, 255, 0.85); border-radius: 14px; padding: 24px;
    margin-bottom: 20px; cursor: pointer; transition: all 0.3s;
}
.card:hover { transform: translateY(-3px); }
.card-shadow { box-shadow: 0 5px 16px rgba(0, 0, 0, 0.08); }

.card-header { margin-bottom: 16px; }
.card-title { font-size: 18px; font-weight: 600; color: var(--text-color, #2D3436); margin-bottom: 10px; }
.card-meta { font-size: 13px; color: var(--text-secondary-color, #636E72); display: flex; gap: 14px; }

.card-body { margin-bottom: 16px; }
.card-text { font-size: 15px; color: var(--text-color, #2D3436); line-height: 1.7; margin-bottom: 16px; }

.card-images { display: flex; gap: 10px; }
.card-image { width: 100px; height: 100px; border-radius: 10px; background-size: cover; background-position: center; }

.card-footer { font-size: 13px; color: var(--text-secondary-color, #636E72); }

.empty-state { text-align: center; padding: 80px 20px; }
.empty-state-icon { font-size: 56px; margin-bottom: 20px; }
.empty-state-text { font-size: 20px; font-weight: 600; color: var(--text-color, #2D3436); margin-bottom: 10px; }
.empty-state-hint { font-size: 15px; color: var(--text-secondary-color, #636E72); }

/* 分页 */
.pagination {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--border-color, #E8E7E4);
}
.page-btn {
    padding: 8px 16px; border: 1px solid var(--border-color, #E8E7E4); border-radius: 8px;
    background: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer;
    color: var(--text-color, #2D3436); transition: all 0.2s;
}
.page-btn:hover:not(:disabled) { border-color: var(--brand-color, #4A5C6B); }
.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-num {
    width: 36px; height: 36px; border: 1px solid var(--border-color, #E8E7E4); border-radius: 8px;
    background: rgba(255,255,255,0.7); font-size: 14px; cursor: pointer;
    color: var(--text-color, #2D3436); transition: all 0.2s;
    display: flex; align-items: center; justify-content: center;
}
.page-num:hover:not(.active) { border-color: var(--brand-color, #4A5C6B); }
.page-num.active { background: var(--brand-color, #4A5C6B); color: white; border-color: var(--brand-color, #4A5C6B); }
.page-dots { width: 36px; text-align: center; color: var(--text-secondary-color, #636E72); }

@media (max-width: 768px) {
    .album-grid { grid-template-columns: repeat(2, 1fr); gap: 20px; }
    .pagination { flex-wrap: wrap; }
}

@media (max-width: 480px) {
    .album-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .album-folder { min-height: 140px; padding: 16px; }
    .folder-content { height: 110px; }
}
</style>

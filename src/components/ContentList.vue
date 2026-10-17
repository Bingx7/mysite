<script setup>
import { computed } from 'vue'
import { CONTENT_TYPE } from '../config'
import { coverFirst } from '../media'
import MediaImage from './MediaImage.vue'
import SkeletonCard from './SkeletonCard.vue'
import { formatDate, formatDateRange, truncateText, getVisibilityLabel, getContentTypeLabel } from '../utils'
import { diaryDateKey, diaryMonthLabel } from '../diary.js'

const props = defineProps({
    contents: Array, imagesMap: Object, authorsMap: Object, currentTab: String,
    currentPage: { type: Number, default: 1 }, pageSize: { type: Number, default: 8 },
    total: { type: Number, default: 0 }, searchQuery: { type: String, default: '' },
    loading: Boolean, error: String, imagesLoading: Boolean, imagesError: String,
    emptyTitle: String, emptyDescription: String, canCreate: Boolean, selectedDate: String
})
const emit = defineEmits(['select', 'search', 'page', 'retry', 'retryImages', 'create'])
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const pagedContents = computed(() => props.contents || [])
const currentPage = computed(() => props.currentPage)
const pageSize = computed(() => props.pageSize)
function imageStatus(content) {
    return Object.hasOwn(props.imagesMap || {}, content.id) ? 'ready' : props.imagesError ? 'error' : 'loading'
}
const contentGroups = computed(() => {
    if (props.currentTab !== CONTENT_TYPE.DIARY) return [{ key: 'list', label: '', contents: pagedContents.value }]
    const groups = new Map()
    for (const content of pagedContents.value) {
        const date = diaryDateKey(content)
        const key = date ? date.slice(0, 7) : 'unknown'
        if (!groups.has(key)) groups.set(key, {
            key, label: date ? diaryMonthLabel(key) : '未注明日期', contents: []
        })
        groups.get(key).contents.push(content)
    }
    return [...groups.values()]
})
function day(content) {
    return diaryDateKey(content).slice(-2) || '—'
}
const pageItems = computed(() => {
    const pages = []
    for (let page = 1; page <= totalPages.value; page++) {
        if (page === 1 || page === totalPages.value || Math.abs(page - currentPage.value) <= 1) pages.push(page)
        else if (pages[pages.length - 1] !== '…') pages.push('…')
    }
    return pages
})
function goPage(page) { if (page >= 1 && page <= totalPages.value && !props.loading) emit('page', page) }
function images(content) { return coverFirst(props.imagesMap?.[content.id] || []) }
function author(content) { return props.authorsMap?.[content.author_id]?.name || '未知作者' }
function date(content) {
    if (content.type === CONTENT_TYPE.DIARY) return diaryDateKey(content) || '未注明日期'
    return content.type === CONTENT_TYPE.ALBUM && content.start_date
        ? formatDateRange(new Date(content.start_date).getTime(), content.end_date ? new Date(content.end_date).getTime() : null)
        : formatDate(new Date(content.created_at).getTime())
}
</script>

<template>
    <div class="list-toolbar">
        <div class="search-bar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
            <input :value="searchQuery" @input="$emit('search', $event.target.value)" type="search" class="search-input" aria-label="搜索内容" placeholder="搜索标题或正文">
            <button v-if="searchQuery" class="search-clear" aria-label="清空搜索" @click="$emit('search', '')">×</button>
        </div>
        <span class="result-count" role="status">{{ loading ? '正在加载…' : searchQuery ? `找到 ${total} 条` : currentTab === CONTENT_TYPE.DIARY ? `共 ${total} 篇` : '最近发布' }}</span>
    </div>

    <div v-if="loading" role="status" aria-label="正在加载内容"><SkeletonCard :count="3" /></div>
    <div v-if="error" class="load-notice" role="alert">{{ error }} <button class="btn btn-secondary" @click="$emit('retry')">重新加载</button></div>
    <div v-if="imagesError && !loading" class="load-notice" role="status">{{ imagesError }} <button class="btn btn-secondary" @click="$emit('retryImages')">重试图片</button></div>
    <template v-if="!loading && !error">
    <div v-if="currentTab !== CONTENT_TYPE.ALBUM" :class="['content-list', { 'diary-list': currentTab === CONTENT_TYPE.DIARY }]">
        <section v-for="group in contentGroups" :key="group.key" class="record-group" :aria-label="group.label || undefined">
        <h2 v-if="group.label" class="month-heading">{{ group.label }}</h2>
        <button v-for="(content, index) in group.contents" :key="content.id" type="button"
            class="record-row" @click="$emit('select', content, $event.currentTarget)">
            <span v-if="currentTab === CONTENT_TYPE.DIARY" class="record-index diary-day" aria-hidden="true">{{ day(content) }}</span>
            <span v-else class="record-index" aria-hidden="true">{{ String((currentPage - 1) * pageSize + index + 1).padStart(2, '0') }}</span>
            <span class="record-main">
                <span class="record-heading">
                    <span class="type-label">{{ getContentTypeLabel(content.type) }}</span>
                    <span v-if="content.pinned" class="pin-label">置顶</span>
                </span>
                <span class="record-title">{{ content.title }}</span>
                <span v-if="content.body || content.description" class="record-excerpt">{{ truncateText(content.body || content.description, 150) }}</span>
                <span class="record-meta">
                    <span>{{ author(content) }}</span><span class="meta-dot">·</span><span>{{ date(content) }}</span>
                    <span class="visibility-label">{{ getVisibilityLabel(content.visibility) }}</span>
                    <span v-if="imageStatus(content) !== 'ready'" class="image-count">{{ imageStatus(content) === 'loading' ? '图片信息加载中…' : '图片暂不可用' }}</span>
                    <span v-else-if="images(content).length" class="image-count">{{ images(content).length }} 张图片</span>
                </span>
            </span>
            <span v-if="images(content).length" class="record-preview">
                <MediaImage :src="images(content)[0].thumbnail_url || images(content)[0].url" :fallback="images(content)[0].url" :alt="images(content)[0].caption || content.title" />
            </span>
            <span v-else class="record-arrow" aria-hidden="true">↗</span>
        </button>
        </section>
    </div>

    <div v-else class="album-grid">
        <button v-for="content in pagedContents" :key="content.id" type="button" class="album-card" @click="$emit('select', content, $event.currentTarget)">
            <span class="album-visual">
                <MediaImage v-if="images(content).length" class="album-cover" :src="images(content)[0].thumbnail_url || images(content)[0].url" :fallback="images(content)[0].url" :alt="images(content)[0].caption || content.title" />
                <span v-else class="album-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M3 4h18v16H3z M3 16l6-6 5 5 3-3 4 4" /><circle cx="16" cy="8" r="1" /></svg><span>{{ imageStatus(content) === 'loading' ? '图片加载中…' : imageStatus(content) === 'error' ? '图片暂不可用' : '还没有照片' }}</span></span>
                <span class="album-count">{{ imageStatus(content) === 'ready' ? images(content).length + ' 张' : '…' }}</span>
            </span>
            <span class="album-title">{{ content.title }}<span class="album-arrow" aria-hidden="true">↗</span></span>
            <span class="album-meta"><span>{{ author(content) }}</span><span>{{ getVisibilityLabel(content.visibility) }}</span></span>
            <span class="album-date">{{ date(content) }}</span>
        </button>
    </div>

    <div v-if="!pagedContents.length" class="empty-state">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.25" aria-hidden="true"><path d="M12 7h24v34H12z M18 17h12 M18 24h12 M18 31h7" /></svg>
        <p>{{ searchQuery ? '没有找到匹配内容' : emptyTitle || '这里还没有记录' }}</p>
        <span>{{ searchQuery ? '换一个关键词试试。' : emptyDescription || '当前分类下还没有可见内容。' }}</span>
        <button v-if="searchQuery" class="btn btn-secondary" @click="$emit('search', '')">清空搜索</button>
        <button v-else-if="canCreate" class="btn btn-secondary" @click="$emit('create')">{{ selectedDate ? '记录这一天' : '写一篇日记' }}</button>
    </div>

    <nav v-if="totalPages > 1" class="pagination" aria-label="内容分页">
        <button class="page-btn" :disabled="currentPage === 1" @click="goPage(currentPage - 1)" aria-label="上一页">←</button>
        <template v-for="(page, index) in pageItems" :key="index">
            <span v-if="page === '…'" class="page-dots">…</span>
            <button v-else :class="['page-num', { active: page === currentPage }]" :aria-current="page === currentPage ? 'page' : undefined" @click="goPage(page)">{{ page }}</button>
        </template>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="goPage(currentPage + 1)" aria-label="下一页">→</button>
    </nav>
    </template>
</template>

<style scoped>
.load-notice { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding: 16px 0; color: var(--text-secondary); font-size: 13px; }
.list-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 22px; }
.search-bar { position: relative; width: 300px; max-width: 100%; }
.search-bar svg { position: absolute; top: 12px; left: 12px; width: 16px; height: 16px; color: var(--text-secondary); pointer-events: none; }
.search-input { width: 100%; height: 40px; padding: 8px 36px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 13px; transition: border-color .18s, box-shadow .18s; }
.search-input:focus { border-color: var(--brand-color); box-shadow: 0 0 0 3px var(--accent-soft); }
.search-input::-webkit-search-cancel-button { display: none; }
.search-clear { position: absolute; right: 5px; top: 5px; width: 30px; height: 30px; font-size: 20px; border: 0; background: transparent; color: var(--text-secondary); cursor: pointer; }
.result-count { font-size: 12px; color: var(--text-secondary); white-space: nowrap; }
.content-list { border-top: 1px solid var(--border); }
.diary-list { border-top: 0; }
.diary-list .record-group + .record-group { margin-top: 28px; }
.month-heading { display: flex; align-items: center; gap: 12px; margin: 0; padding: 16px 0; border-bottom: 1px solid var(--border); font-size: 15px; font-weight: 600; letter-spacing: .04em; color: var(--text); }
.month-heading::before { content: ''; width: 20px; height: 2px; background: var(--brand-color); }
.record-index.diary-day { font-size: 21px; line-height: 1.2; font-weight: 400; color: var(--brand-color); opacity: .85; white-space: nowrap; }
.record-row { position: relative; width: 100%; display: flex; align-items: center; gap: 24px; padding: 28px 12px 28px 0; border: 0; border-bottom: 1px solid var(--border); border-radius: 0; text-align: left; background: transparent; color: var(--text); cursor: pointer; transition: background .2s; }
.record-row::before { content: ''; position: absolute; left: -13px; top: 28px; bottom: 28px; width: 2px; background: var(--brand-color); transform: scaleY(0); transform-origin: top; transition: transform .2s; }
.record-row:hover, .record-row:focus-visible { background: var(--accent-soft); }
.record-row:hover::before, .record-row:focus-visible::before { transform: scaleY(1); }
.record-index { align-self: flex-start; flex: 0 0 26px; padding-top: 2px; font: 11px/1.6 'SFMono-Regular', Consolas, monospace; color: var(--text-secondary); opacity: .65; }
.record-main { min-width: 0; flex: 1; display: flex; flex-direction: column; align-items: flex-start; }
.record-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.type-label { color: var(--text-secondary); font-size: 11px; letter-spacing: .04em; }
.pin-label { font-size: 10px; color: var(--brand-color); border: 1px solid var(--border); border-radius: 3px; padding: 0 5px; }
.record-title { font-size: calc(var(--font-size) + 6px); font-weight: 600; line-height: 1.5; letter-spacing: -.025em; overflow-wrap: anywhere; text-decoration: underline; text-decoration-color: transparent; text-underline-offset: 5px; text-decoration-thickness: 1px; transition: text-decoration-color .2s; }
.record-row:hover .record-title, .record-row:focus-visible .record-title { text-decoration-color: var(--border); }
.record-excerpt { font-size: calc(var(--font-size) - 1px); line-height: 1.8; color: var(--text-secondary); margin-top: 7px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.record-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: calc(var(--font-size) - 3px); color: var(--text-secondary); margin-top: 13px; }
.visibility-label { margin-left: 6px; padding: 1px 6px; border: 1px solid var(--border); border-radius: 3px; font-size: 10px; }
.image-count { margin-left: 4px; }
.record-preview { flex-shrink: 0; width: 144px; height: 104px; padding: 4px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface); transform: rotate(-2deg); transition: transform .2s; }
.record-row:hover .record-preview { transform: rotate(0); }
.record-preview :deep(img), .record-preview :deep(.image-unavailable) { width: 100%; height: 100%; object-fit: cover; border-radius: 4px; }
.record-arrow { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: 1px solid var(--border); border-radius: 50%; color: var(--text-secondary); font-size: 16px; transition: transform .2s; }
.record-row:hover .record-arrow { transform: translate(2px, -2px); }
.album-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px 24px; padding-top: 6px; }
.album-card { display: flex; flex-direction: column; min-width: 0; padding: 10px 10px 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; color: var(--text); text-align: left; cursor: pointer; transition: transform .2s, box-shadow .2s, border-color .2s; }
.album-card:hover, .album-card:focus-visible { transform: translateY(-4px); box-shadow: 0 10px 24px #00000009; border-color: color-mix(in srgb, var(--brand-color) 35%, var(--border)); }
.album-visual { width: 100%; aspect-ratio: 4/3; display: block; position: relative; border-radius: 5px; overflow: hidden; background: var(--surface-muted); }
.album-cover { width: 100%; height: 100%; object-fit: cover; transition: transform .25s; }
.album-card:hover .album-cover { transform: scale(1.025); }
.album-placeholder { display: flex; width: 100%; height: 100%; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text-secondary); font-size: 11px; }
.album-placeholder svg { width: 32px; height: 32px; }
.album-count { position: absolute; right: 10px; bottom: 10px; background: #202124cc; color: #fff; border-radius: 4px; padding: 3px 7px; font-size: 10px; }
.album-title { width: 100%; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-top: 14px; padding: 0 4px; font-size: 15px; font-weight: 600; line-height: 1.6; overflow-wrap: anywhere; }
.album-arrow { font-size: 14px; font-weight: 400; color: var(--text-secondary); }
.album-meta { width: 100%; display: flex; justify-content: space-between; gap: 8px; padding: 0 4px; font-size: 11px; color: var(--text-secondary); margin-top: 8px; }
.album-date { padding: 0 4px; font-size: 11px; color: var(--text-secondary); margin-top: 5px; }
.empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 72px 12px; color: var(--text-secondary); text-align: center; }
.empty-state svg { width: 44px; height: 44px; margin-bottom: 8px; }
.empty-state p { color: var(--text); font-size: 16px; font-weight: 500; }
.empty-state span { font-size: 13px; }
.empty-state .btn { margin-top: 12px; }
.pagination { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; margin-top: 32px; }
.page-btn, .page-num { min-width: 34px; height: 34px; padding: 4px 8px; background: transparent; border: 1px solid transparent; border-radius: 5px; font-size: 12px; color: var(--text-secondary); cursor: pointer; }
.page-btn:hover:not(:disabled), .page-num:hover { background: var(--surface-muted); color: var(--text); }
.page-num.active { border-color: var(--border); background: var(--surface); color: var(--text); font-weight: 600; }
.page-btn:disabled { opacity: .35; cursor: not-allowed; }
.page-dots { width: 20px; text-align: center; color: var(--text-secondary); }
@media (max-width: 1200px) { .album-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) {
    .list-toolbar { gap: 12px; padding-bottom: 20px; }
    .search-bar { flex: 1; width: auto; }
    .record-row { gap: 16px; padding: 25px 0; }
    .record-index { display: none; }
    .record-row::before { left: -10px; }
    .record-title { font-size: calc(var(--font-size) + 3px); }
    .record-preview { width: 82px; height: 82px; padding: 3px; }
    .record-arrow { width: 22px; height: 22px; font-size: 13px; }
    .record-meta { gap: 6px; }
    .visibility-label { margin-left: 0; }
    .album-grid { gap: 26px 14px; }
    .album-card { padding: 6px 6px 12px; border-radius: 8px; }
    .album-title { font-size: 14px; }
    .album-meta { flex-wrap: wrap; font-size: 10px; }
    .album-date { font-size: 10px; }
}
@media (max-width: 359px) { .album-grid { grid-template-columns: 1fr; } .result-count { display: none; } }
</style>

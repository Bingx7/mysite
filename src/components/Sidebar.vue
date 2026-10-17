<script setup>
import { CONTENT_TYPE } from '../config'
import { getContentTypeLabel } from '../utils'

defineProps({ currentTab: String })
defineEmits(['switchTab'])
const tabs = ['all', CONTENT_TYPE.DIARY, CONTENT_TYPE.ARTICLE, CONTENT_TYPE.ALBUM]
const paths = {
    all: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    diary: 'M5 3h14v18H5z M9 3v18 M12 8h4 M12 12h4',
    article: 'M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6',
    album: 'M3 4h18v16H3z M3 16l6-6 5 5 3-3 4 4 M16 8h.01'
}
</script>

<template>
    <aside class="sidebar" aria-label="内容分类">
        <p class="nav-caption">内容</p>
        <nav class="sidebar-nav">
            <button v-for="tab in tabs" :key="tab" type="button"
                :class="['nav-link', { active: currentTab === tab }]"
                :aria-current="currentTab === tab ? 'page' : undefined"
                @click="$emit('switchTab', tab)">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path :d="paths[tab]" /></svg>
                <span>{{ getContentTypeLabel(tab) }}</span>
                <span class="nav-indicator" aria-hidden="true"></span>
            </button>
        </nav>
        <p class="sidebar-note">日记 · 文章 · 照片<br>生活的片段，都在这里。</p>
    </aside>
</template>

<style scoped>
.sidebar { position: fixed; left: 0; top: 72px; bottom: 0; width: 216px; padding: 36px 20px 24px; border-right: 1px solid var(--border); background: var(--surface); display: flex; flex-direction: column; z-index: 80; }
.nav-caption { margin: 0 12px 16px; color: var(--text-secondary); font-size: 11px; letter-spacing: .12em; }
.sidebar-nav { display: flex; flex-direction: column; gap: 6px; }
.nav-link { display: flex; align-items: center; gap: 12px; min-height: 44px; width: 100%; padding: 10px 12px; border: 0; border-radius: 6px; background: transparent; color: var(--text-secondary); font-size: 14px; cursor: pointer; text-align: left; transition: background .15s, color .15s; }
.nav-link:hover { background: var(--surface-muted); color: var(--text); }
.nav-link.active { background: var(--accent-soft); color: var(--text); font-weight: 600; box-shadow: inset 2px 0 var(--brand-color); }
.nav-icon { width: 18px; height: 18px; flex-shrink: 0; }
.nav-indicator { margin-left: auto; width: 5px; height: 5px; border-radius: 50%; background: transparent; }
.active .nav-indicator { background: var(--brand-color); }
.sidebar-note { margin: auto 12px 0; padding-top: 24px; font-size: 11px; line-height: 1.9; color: var(--text-secondary); }
.sidebar-note::before { content: ''; display: block; width: 24px; height: 1px; margin-bottom: 16px; background: var(--brand-color); opacity: .65; }
@media (max-width: 1023px) {
    .sidebar { position: sticky; top: 64px; width: 100%; height: auto; padding: 0 24px; border-right: 0; border-bottom: 1px solid var(--border); }
    .nav-caption, .sidebar-note, .nav-icon, .nav-indicator { display: none; }
    .sidebar-nav { flex-direction: row; gap: 24px; }
    .nav-link { justify-content: center; width: auto; min-height: 48px; padding: 12px 2px; border-radius: 0; position: relative; font-size: 13px; }
    .nav-link.active { background: transparent; box-shadow: none; }
    .nav-link.active::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: var(--brand-color); }
}
@media (max-width: 480px) { .sidebar { padding: 0 20px; } .sidebar-nav { justify-content: space-between; gap: 12px; } }
</style>

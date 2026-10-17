<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
    images: { type: Array, default: () => [] },
    initialIndex: { type: Number, default: 0 }
})
const emit = defineEmits(['close'])
const clampIndex = value => Math.max(0, Math.min(Number.isFinite(value) ? value : 0, props.images.length - 1))
const index = ref(clampIndex(props.initialIndex))
const currentImage = computed(() => props.images[index.value])
const loading = ref(true)
const failed = ref(false)
const dialog = ref(null)
const closeButton = ref(null)
let previousFocus, appRoot, previousInert, previousOverflow, previousPadding
let touchStart = null
let ignoreBackdropUntil = 0

function goTo(value) {
    if (value >= 0 && value < props.images.length) index.value = value
}
function closeFromBackdrop() {
    if (Date.now() >= ignoreBackdropUntil) emit('close')
}
function onKeydown(event) {
    if (event.key === 'Escape') { event.preventDefault(); emit('close') }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(index.value - 1) }
    else if (event.key === 'ArrowRight') { event.preventDefault(); goTo(index.value + 1) }
    else if (event.key === 'Tab') {
        const buttons = [...dialog.value.querySelectorAll('button:not(:disabled)')]
        const first = buttons[0], last = buttons[buttons.length - 1]
        if (!buttons.includes(document.activeElement)) { event.preventDefault(); first?.focus() }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
}
function onTouchStart(event) {
    touchStart = event.touches.length === 1 && !event.target.closest('button')
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY, time: Date.now() }
        : null
}
function onTouchMove(event) { if (event.touches.length !== 1) touchStart = null }
function onTouchEnd(event) {
    if (!touchStart || event.touches.length || !event.changedTouches.length) { touchStart = null; return }
    const dx = event.changedTouches[0].clientX - touchStart.x
    const dy = event.changedTouches[0].clientY - touchStart.y
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - touchStart.time < 800) {
        // 只接管明确的水平滑动，保留浏览器的双指缩放。
        if (event.cancelable) event.preventDefault()
        ignoreBackdropUntil = Date.now() + 400
        goTo(index.value + (dx < 0 ? 1 : -1))
    }
    touchStart = null
}
watch(() => props.initialIndex, value => { index.value = clampIndex(value) })
watch(() => props.images.length, length => {
    if (!length) emit('close')
    else index.value = clampIndex(index.value)
})
watch([index, () => currentImage.value?.url], () => { loading.value = true; failed.value = false })

onMounted(async () => {
    previousFocus = document.activeElement
    appRoot = document.getElementById('app')
    previousInert = appRoot?.inert
    previousOverflow = document.body.style.overflow
    previousPadding = document.body.style.paddingRight
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbarWidth}px`
    document.body.style.overflow = 'hidden'
    if (appRoot) appRoot.inert = true
    document.addEventListener('keydown', onKeydown)
    await nextTick()
    closeButton.value?.focus({ preventScroll: true })
})
onUnmounted(() => {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = previousOverflow
    document.body.style.paddingRight = previousPadding
    if (appRoot) appRoot.inert = previousInert
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
})
</script>

<template>
    <Teleport to="body">
        <div ref="dialog" class="lightbox-overlay" role="dialog" aria-modal="true" aria-label="图片预览" @click.self="closeFromBackdrop">
            <div class="lightbox-toolbar">
                <span class="lightbox-counter" role="status" aria-live="polite">第 {{ index + 1 }} / {{ images.length }} 张</span>
                <button ref="closeButton" class="lightbox-close" aria-label="关闭图片预览" @click="$emit('close')">×</button>
            </div>
            <div class="lightbox-stage" @click.self="closeFromBackdrop"
                @touchstart.passive="onTouchStart" @touchmove.passive="onTouchMove"
                @touchend="onTouchEnd" @touchcancel="touchStart = null">
                <p v-if="failed || !currentImage?.url" class="lightbox-message" role="status">这张图片暂时无法加载</p>
                <template v-else>
                    <p v-if="loading" class="lightbox-message" role="status">正在加载图片…</p>
                    <img :key="`${index}:${currentImage.url}`" :src="currentImage.url" :alt="currentImage.caption || `图片 ${index + 1}`"
                        class="lightbox-image" :class="{ 'is-loading': loading }" decoding="async" draggable="false"
                        @load="loading = false" @error="failed = true; loading = false" @click.stop>
                </template>
                <button v-if="images.length > 1" class="lightbox-nav lightbox-prev" aria-label="上一张图片" :disabled="index === 0" @click.stop="goTo(index - 1)">‹</button>
                <button v-if="images.length > 1" class="lightbox-nav lightbox-next" aria-label="下一张图片" :disabled="index === images.length - 1" @click.stop="goTo(index + 1)">›</button>
            </div>
            <div class="lightbox-footer">
                <p v-if="currentImage?.caption" class="lightbox-caption">{{ currentImage.caption }}</p>
                <p v-if="images.length > 1" class="lightbox-hint"><span class="desktop-hint">← → 切换图片 · Esc 关闭</span><span class="mobile-hint">左右滑动切换图片</span></p>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.lightbox-overlay { position: fixed; inset: 0; z-index: 1100; height: 100dvh; display: flex; flex-direction: column; background: #111416f5; color: #f5f5f5; padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom); overscroll-behavior: contain; }
.lightbox-toolbar { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; min-height: 64px; padding: 10px 28px; }
.lightbox-counter { font-size: 13px; font-variant-numeric: tabular-nums; letter-spacing: .08em; color: #d6dadd; }
.lightbox-close, .lightbox-nav { display: flex; align-items: center; justify-content: center; padding: 0; width: 44px; height: 44px; border: 1px solid #ffffff26; border-radius: 50%; background: #ffffff12; color: #fff; cursor: pointer; font-weight: 300; transition: background .15s; }
.lightbox-close { font-size: 28px; }
.lightbox-close:hover, .lightbox-nav:hover:not(:disabled) { background: #ffffff26; }
.lightbox-close:focus-visible, .lightbox-nav:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
.lightbox-stage { flex: 1; min-height: 0; position: relative; display: flex; align-items: center; justify-content: center; padding: 8px 84px; touch-action: pan-y pinch-zoom; }
.lightbox-image { display: block; max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; border-radius: 3px; user-select: none; }
.lightbox-image.is-loading { opacity: 0; }
.lightbox-message { position: absolute; margin: 0; left: 20px; right: 20px; text-align: center; color: #b3bbc1; font-size: 13px; pointer-events: none; }
.lightbox-nav { position: absolute; top: calc(50% - 22px); font-size: 32px; background: #20262ccc; }
.lightbox-nav:disabled { opacity: .25; cursor: default; }
.lightbox-prev { left: 24px; }
.lightbox-next { right: 24px; }
.lightbox-footer { flex-shrink: 0; padding: 18px 28px 22px; text-align: center; }
.lightbox-caption { max-width: 720px; max-height: 16vh; overflow-y: auto; margin: 0 auto; color: #e3e6e8; font-size: 14px; line-height: 1.7; overflow-wrap: anywhere; }
.lightbox-hint { margin-top: 10px; color: #939da5; font-size: 11px; }
.mobile-hint { display: none; }
@media (max-width: 768px) {
    .lightbox-toolbar { min-height: 60px; padding: 8px 16px; }
    .lightbox-stage { padding: 0 8px; }
    .lightbox-nav { width: 40px; height: 44px; border-radius: 6px; font-size: 28px; }
    .lightbox-prev { left: 12px; }
    .lightbox-next { right: 12px; }
    .lightbox-footer { padding: 16px 20px 20px; }
    .lightbox-caption { font-size: 13px; }
    .desktop-hint { display: none; }
    .mobile-hint { display: inline; }
}
</style>

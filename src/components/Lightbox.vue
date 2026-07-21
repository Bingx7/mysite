<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
    src: String,
    alt: String
})

const emit = defineEmits(['close'])

function onKeydown(e) {
    if (e.key === 'Escape') emit('close')
}

onMounted(() => { document.addEventListener('keydown', onKeydown) })
onUnmounted(() => { document.removeEventListener('keydown', onKeydown) })
</script>

<template>
    <div class="lightbox-overlay" @click="$emit('close')">
        <button class="lightbox-close" @click="$emit('close')">✕</button>
        <img :src="src" :alt="alt || '图片'" class="lightbox-image" @click.stop>
    </div>
</template>

<style scoped>
.lightbox-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background-color: rgba(0, 0, 0, 0.92); z-index: 300;
    display: flex; align-items: center; justify-content: center;
    animation: lightboxFadeIn 0.2s ease;
}

@keyframes lightboxFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.lightbox-close {
    position: absolute; top: 20px; right: 24px;
    background: rgba(255,255,255,0.15); border: none; color: white;
    font-size: 24px; width: 44px; height: 44px; border-radius: 50%;
    cursor: pointer; transition: background 0.2s; z-index: 10;
}
.lightbox-close:hover { background: rgba(255,255,255,0.3); }

.lightbox-image {
    max-width: 90vw; max-height: 90vh; object-fit: contain;
    border-radius: 4px;
}
</style>

<script setup>
import { ref, watch } from 'vue'
const props = defineProps({ src: String, fallback: String, alt: String })
const failed = ref(false)
const useFallback = ref(false)
watch(() => [props.src, props.fallback], () => { failed.value = false; useFallback.value = false })
function onError() {
    if (!useFallback.value && props.fallback && props.fallback !== props.src) useFallback.value = true
    else failed.value = true
}
</script>

<template>
    <img v-if="!failed && (src || fallback)" :src="useFallback ? fallback : src || fallback"
        :alt="alt || '图片'" loading="lazy" decoding="async" @error="onError">
    <span v-else class="image-unavailable" role="img" :aria-label="alt || '图片暂不可用'">图片暂不可用</span>
</template>

<style scoped>
.image-unavailable { display: flex; align-items: center; justify-content: center; background: #8882; color: var(--text-secondary-color); font-size: 12px; min-height: 80px; }
</style>

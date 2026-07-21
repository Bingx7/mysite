<script setup>
defineProps({
    count: { type: Number, default: 6 }
})
</script>

<template>
    <div class="skeleton-list">
        <div v-for="i in count" :key="i" class="skeleton-card">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line short"></div>
        </div>
    </div>
</template>

<style scoped>
.skeleton-list {
    display: flex; flex-direction: column;
}

.skeleton-card {
    background-color: rgba(255, 255, 255, 0.8);
    border-radius: 14px; padding: 24px; margin-bottom: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.skeleton {
    background: linear-gradient(90deg, rgba(0,0,0,0.05) 25%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.05) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 6px;
}

.skeleton-title {
    height: 20px; width: 40%; margin-bottom: 14px;
}

.skeleton-line {
    height: 14px; width: 100%; margin-bottom: 8px;
}

.skeleton-line.short { width: 65%; }

@keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
}
</style>

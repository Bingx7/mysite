<script setup>
defineOptions({ inheritAttrs: false })
defineProps({ error: Object })
defineEmits(['close'])
</script>
<template>
    <div class="modal-overlay open">
        <section class="modal" role="dialog" aria-modal="true" aria-label="打开窗口">
            <div class="modal-body">
                <p role="status">{{ error ? '窗口暂时加载失败，请检查网络后关闭重试。' : '正在打开…' }}</p>
                <button class="btn btn-secondary" @click="$emit('close')">关闭</button>
            </div>
        </section>
    </div>
</template>
<style scoped>
.modal-overlay { position: fixed; inset: 0; z-index: 200; display: flex; justify-content: center; align-items: center; }
.modal-body { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
</style>

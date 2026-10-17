<script setup>
import { computed } from 'vue'
import { getBrandColors, getBrightnessOptions, getCardStyleOptions, getFontSizeOptions } from '../theme'

const props = defineProps({
    isOpen: Boolean,
    theme: Object
})

const emit = defineEmits(['close', 'change', 'reset'])

const brandColors = computed(() => getBrandColors())
const brightnessOptions = computed(() => getBrightnessOptions())
const cardStyleOptions = computed(() => getCardStyleOptions())
const fontSizeOptions = computed(() => getFontSizeOptions())
</script>

<template>
    <div v-if="isOpen" class="modal-overlay open" @click="$emit('close')">
        <div class="modal settings-modal" role="dialog" aria-modal="true" aria-label="外观设置" @click.stop>
            <div class="modal-header">
                <div class="modal-title">外观设置</div>
                <button aria-label="关闭外观设置" class="modal-close" @click="$emit('close')">✕</button>
            </div>
            <div class="modal-body">
                <div class="settings-section">
                    <div class="settings-title">强调色</div>
                    <div class="brand-colors">
                        <button type="button" :aria-label="`选择强调色 ${color}`" :aria-pressed="theme.brandColor === color" v-for="color in brandColors" :key="color"
                            :class="['brand-color', { active: theme.brandColor === color }]"
                            :style="{ backgroundColor: color }"
                            @click="$emit('change', 'brandColor', color)">
                        </button>
                        <input aria-label="自定义强调色" type="color" :value="theme.brandColor"
                            @input="$emit('change', 'brandColor', $event.target.value)" class="color-picker">
                    </div>
                </div>
                <div class="settings-section">
                    <div class="settings-title">背景亮度</div>
                    <div class="style-options">
                        <button v-for="option in brightnessOptions" :key="option.value"
                            :class="['style-option', { active: theme.brightness === option.value }]"
                            @click="$emit('change', 'brightness', option.value)">
                            {{ option.label }}
                        </button>
                    </div>
                </div>
                <div class="settings-section">
                    <div class="settings-title">卡片样式</div>
                    <div class="style-options">
                        <button v-for="option in cardStyleOptions" :key="option.value"
                            :class="['style-option', { active: theme.cardStyle === option.value }]"
                            @click="$emit('change', 'cardStyle', option.value)">
                            {{ option.label }}
                        </button>
                    </div>
                </div>
                <div class="settings-section">
                    <div class="settings-title">字体大小</div>
                    <div class="style-options">
                        <button v-for="option in fontSizeOptions" :key="option.value"
                            :class="['style-option', { active: theme.fontSize === option.value }]"
                            @click="$emit('change', 'fontSize', option.value)">
                            {{ option.label }}
                        </button>
                    </div>
                </div>
            </div>
            <div class="settings-footer">
                <button class="btn btn-secondary" @click="$emit('reset')">重置默认</button>
                <button class="btn btn-primary" @click="$emit('close')">关闭</button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.modal-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; z-index: 200;
    opacity: 0; visibility: hidden; transition: all 0.3s;
}
.modal-overlay.open { opacity: 1; visibility: visible; }

.modal {
    background-color: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-radius: 18px; width: 90%; max-width: 560px; max-height: 85vh; overflow-y: auto;
    opacity: 0; transform: scale(0.95); transition: all 0.3s;
}
.modal-overlay.open .modal { opacity: 1; transform: scale(1); }
.settings-modal { max-width: 500px; }

.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px; border-bottom: 1px solid var(--border-color, #E8E7E4); }
.modal-title { font-size: 20px; font-weight: 600; color: var(--text-color, #2D3436); }
.modal-close { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text-secondary-color, #636E72); padding: 4px; }

.modal-body { padding: 28px; }

.settings-section { margin-bottom: 28px; }
.settings-title { font-size: 15px; font-weight: 600; color: var(--text-color, #2D3436); margin-bottom: 14px; }

.brand-colors { display: flex; gap: 10px; flex-wrap: wrap; }
.brand-color { width: 40px; height: 40px; border-radius: 50%; cursor: pointer; transition: transform 0.2s; border: 2px solid transparent; }
.brand-color.active { border-color: var(--text-color, #2D3436); transform: scale(1.1); }
.color-picker { width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer; padding: 0; }

.style-options { display: flex; gap: 10px; }
.style-option {
    flex: 1; padding: 12px 10px; border: 1px solid var(--border-color, #E8E7E4);
    border-radius: 10px; cursor: pointer; text-align: center; font-size: 14px; font-weight: 400;
    color: var(--text-secondary-color, #636E72); transition: all 0.2s; background: none;
}
.style-option:hover { border-color: var(--brand-color, #4A5C6B); }
.style-option.active { border-color: var(--brand-color, #4A5C6B); background-color: rgba(74, 92, 107, 0.06); color: var(--text-color, #2D3436); font-weight: 500; }

.glass-slider-container { display: flex; align-items: center; gap: 14px; }
.glass-slider { flex: 1; height: 8px; border-radius: 4px; background-color: var(--border-color, #E8E7E4); outline: none; cursor: pointer; }
.glass-value { font-size: 14px; color: var(--text-secondary-color, #636E72); min-width: 50px; }

.settings-footer { display: flex; gap: 14px; padding: 20px 28px; border-top: 1px solid var(--border-color, #E8E7E4); }
.settings-footer .btn-secondary { flex: 1; }
.settings-footer .btn-primary { flex: 1; }

.btn { padding: 12px 24px; border-radius: 10px; border: none; font-size: 15px; font-weight: 500; cursor: pointer; transition: opacity 0.2s; }

</style>

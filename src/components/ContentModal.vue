<script setup>
import { CONTENT_TYPE, visibilityConfig } from '../config'
import { getContentTypeLabel, getVisibilityLabel, getVisibilityIcon } from '../utils'

const props = defineProps({
    isOpen: Boolean,
    mode: String,
    currentTab: String,
    formTitle: String,
    formBody: String,
    formDescription: String,
    formVisibility: String,
    formStartDate: String,
    formEndDate: String,
    formImages: Array,
    formCaptions: Array,
    busy: Boolean,
    saving: Boolean,
    uploading: Boolean,
    uploadProgress: Object
})

const emit = defineEmits([
    'close', 'save',
    'update:formTitle', 'update:formBody', 'update:formDescription',
    'update:formVisibility', 'update:formStartDate', 'update:formEndDate',
    'fileUpload', 'removeImage', 'moveImage', 'setCover'
])
</script>

<template>
    <div v-if="isOpen" class="modal-overlay open" @click="!busy && $emit('close')">
        <div class="modal" role="dialog" aria-modal="true" :aria-label="`${mode === 'edit' ? '编辑' : '发布'}${getContentTypeLabel(currentTab)}`" @click.stop>
            <div class="modal-header">
                <div class="modal-title">{{ mode === 'edit' ? '编辑' : '发布' }}{{ getContentTypeLabel(currentTab) }}</div>
                <button aria-label="关闭编辑窗口" class="modal-close" :disabled="busy" @click="$emit('close')">✕</button>
            </div>
            <div class="modal-body">
                <fieldset :disabled="busy" class="form-fields" :aria-busy="busy">
                <div class="form-group">
                    <label class="form-label">标题</label>
                    <input :value="formTitle" @input="$emit('update:formTitle', $event.target.value)" type="text" class="form-input" placeholder="请输入标题">
                </div>
                <div v-if="currentTab === CONTENT_TYPE.ALBUM" class="form-group">
                    <label class="form-label">描述</label>
                    <textarea :value="formDescription" @input="$emit('update:formDescription', $event.target.value)" class="form-textarea" placeholder="请输入描述"></textarea>
                </div>
                <div v-if="currentTab !== CONTENT_TYPE.ALBUM" class="form-group">
                    <label class="form-label">正文</label>
                    <textarea :value="formBody" @input="$emit('update:formBody', $event.target.value)" class="form-textarea" placeholder="请输入正文"></textarea>
                </div>
                <div v-if="currentTab === CONTENT_TYPE.ALBUM" class="form-group">
                    <label class="form-label">时间段</label>
                    <div class="date-range">
                        <input :value="formStartDate" @input="$emit('update:formStartDate', $event.target.value)" type="date" class="form-input">
                        <span>~</span>
                        <input :value="formEndDate" @input="$emit('update:formEndDate', $event.target.value)" type="date" class="form-input">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">可见性</label>
                    <div class="visibility-options">
                        <label v-for="key in Object.keys(visibilityConfig)" :key="key"
                            :class="['visibility-option', { selected: formVisibility === key }]">
                            <input type="radio" name="visibility" :value="key" :checked="formVisibility === key"
                                @change="$emit('update:formVisibility', key)">
                            <span>{{ getVisibilityIcon(key) }}</span>
                            <span>{{ getVisibilityLabel(key) }}</span>
                        </label>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">图片上传（{{ formImages.length }} / 9）</label>
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple @change="$emit('fileUpload', $event)" class="file-input">
                    <p class="upload-hint">照片自动压缩，生成小图以加快浏览；使用前移、后移调整顺序。</p>
                    <div v-if="formImages.length > 0" class="uploaded-images">
                        <div v-for="(image, idx) in formImages" :key="image.path || image.url || idx" class="uploaded-image">
                            <img :src="image.thumbnail_url || image.url || image" :alt="`图片${idx + 1}`" decoding="async">
                            <button type="button" class="uploaded-image-remove" :aria-label="`删除图片 ${idx + 1}`" @click="$emit('removeImage', idx)">✕</button>
                            <span class="image-number">{{ idx + 1 }}</span>
                            <div class="image-controls">
                                <button type="button" :disabled="busy || idx === 0" @click="$emit('moveImage', idx, -1)">前移</button>
                                <button type="button" :disabled="busy || idx === formImages.length - 1" @click="$emit('moveImage', idx, 1)">后移</button>
                                <button v-if="currentTab === CONTENT_TYPE.ALBUM" type="button" :aria-pressed="image.is_cover || (!formImages.some(item => item.is_cover) && idx === 0)" @click="$emit('setCover', idx)">
                                    {{ image.is_cover || (!formImages.some(item => item.is_cover) && idx === 0) ? '✓ 封面' : '设为封面' }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                </fieldset>
                <div v-if="uploading" class="upload-status" role="status" aria-live="polite">
                    <p>{{ uploadProgress.stage }} · 已完成 {{ uploadProgress.completed }} / {{ uploadProgress.total }} 张</p>
                    <progress :value="uploadProgress.completed" :max="uploadProgress.total || 1"></progress>
                </div>
                <p v-if="saving" class="upload-status" role="status">正在保存，请稍候…</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" :disabled="busy" @click="$emit('close')">取消</button>
                <button class="btn btn-primary" :disabled="busy" @click="$emit('save')">{{ saving ? '保存中…' : uploading ? '上传中…' : mode === 'edit' ? '保存' : '发布' }}</button>
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

.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 24px 28px; border-bottom: 1px solid var(--border-color, #E8E7E4); }
.modal-title { font-size: 20px; font-weight: 600; color: var(--text-color, #2D3436); }
.modal-close { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text-secondary-color, #636E72); padding: 4px; }

.modal-body { padding: 28px; }
.modal-footer { display: flex; justify-content: flex-end; gap: 16px; padding: 20px 28px; border-top: 1px solid var(--border-color, #E8E7E4); }

.form-group { margin-bottom: 20px; }
.form-label { display: block; font-size: 14px; font-weight: 500; color: var(--text-color, #2D3436); margin-bottom: 10px; }
.form-input { width: 100%; padding: 14px 16px; border: 1px solid var(--border-color, #E8E7E4); border-radius: 10px; font-size: 15px; background-color: rgba(255, 255, 255, 0.7); color: var(--text-color, #2D3436); transition: border-color 0.2s; }
.form-input:focus { outline: none; border-color: var(--brand-color, #4A5C6B); }
.form-textarea { width: 100%; padding: 14px 16px; border: 1px solid var(--border-color, #E8E7E4); border-radius: 10px; font-size: 15px; background-color: rgba(255, 255, 255, 0.7); color: var(--text-color, #2D3436); min-height: 120px; resize: vertical; }

.btn { padding: 12px 24px; border-radius: 10px; border: none; font-size: 15px; font-weight: 500; cursor: pointer; transition: opacity 0.2s; }


.date-range { display: flex; align-items: center; gap: 14px; }
.date-range input { flex: 1; min-width: 0; width: 0; }

.visibility-options { display: flex; flex-wrap: wrap; gap: 14px; }
.visibility-option { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 10px; background-color: rgba(0, 0, 0, 0.03); cursor: pointer; font-size: 14px; }
.visibility-option input { display: none; }
.visibility-option.selected { background-color: rgba(74, 92, 107, 0.1); }

.file-input { width: 100%; padding: 14px; border: 1px dashed var(--border-color, #E8E7E4); border-radius: 10px; cursor: pointer; background-color: rgba(0, 0, 0, 0.02); }

.uploaded-images { display: grid; grid-template-columns: repeat(auto-fill, minmax(125px, 1fr)); gap: 10px; margin-top: 14px; }
.uploaded-image { position: relative; min-width: 0; border-radius: 10px; overflow: hidden; background: rgba(0,0,0,0.04); }
.uploaded-image img { width: 100%; height: 110px; object-fit: cover; }
.form-fields { padding: 0; margin: 0; border: 0; min-width: 0; }
.upload-hint, .upload-status { font-size: 13px; line-height: 1.6; color: var(--text-secondary-color); }
.upload-status progress { width: 100%; accent-color: var(--brand-color); }
.image-controls { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px; }
.image-controls button { flex: 1; padding: 8px 4px; border: 1px solid var(--border-color); border-radius: 6px; cursor: pointer; }
.image-controls button[aria-pressed="true"] { background: var(--brand-color); color: white; }
.image-controls button[aria-pressed] { flex-basis: 100%; }
.image-number { position: absolute; top: 6px; left: 6px; background: #0009; color: white; padding: 2px 6px; border-radius: 4px; }
button:disabled { opacity: 0.5; cursor: wait; }
@media (max-width: 480px) {
    .date-range { flex-direction: column; align-items: stretch; gap: 8px; }
    .date-range input { width: 100%; flex: auto; }
    .date-range > span { text-align: center; }
    .modal-body { padding: 20px; }
}
.uploaded-image-remove { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border-radius: 50%; background-color: rgba(0, 0, 0, 0.6); color: white; border: none; font-size: 14px; cursor: pointer; }
</style>

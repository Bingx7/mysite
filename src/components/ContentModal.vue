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
    formCaptions: Array
})

const emit = defineEmits([
    'close', 'save',
    'update:formTitle', 'update:formBody', 'update:formDescription',
    'update:formVisibility', 'update:formStartDate', 'update:formEndDate',
    'fileUpload', 'removeImage'
])
</script>

<template>
    <div v-if="isOpen" class="modal-overlay open" @click="$emit('close')">
        <div class="modal" @click.stop>
            <div class="modal-header">
                <div class="modal-title">{{ mode === 'edit' ? '编辑' : '发布' }}{{ getContentTypeLabel(currentTab) }}</div>
                <button class="modal-close" @click="$emit('close')">✕</button>
            </div>
            <div class="modal-body">
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
                    <label class="form-label">图片上传</label>
                    <input type="file" accept="image/*" multiple @change="$emit('fileUpload', $event)" class="file-input">
                    <div v-if="formImages.length > 0" class="uploaded-images">
                        <div v-for="(url, idx) in formImages" :key="idx" class="uploaded-image">
                            <img :src="typeof url === 'string' ? url : url.url" :alt="`图片${idx + 1}`">
                            <button class="uploaded-image-remove" @click="$emit('removeImage', idx)">✕</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" @click="$emit('close')">取消</button>
                <button class="btn btn-primary" @click="$emit('save')">{{ mode === 'edit' ? '保存' : '发布' }}</button>
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
.date-range input { flex: 1; }

.visibility-options { display: flex; flex-wrap: wrap; gap: 14px; }
.visibility-option { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 10px; background-color: rgba(0, 0, 0, 0.03); cursor: pointer; font-size: 14px; }
.visibility-option input { display: none; }
.visibility-option.selected { background-color: rgba(74, 92, 107, 0.1); }

.file-input { width: 100%; padding: 14px; border: 1px dashed var(--border-color, #E8E7E4); border-radius: 10px; cursor: pointer; background-color: rgba(0, 0, 0, 0.02); }

.uploaded-images { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.uploaded-image { position: relative; width: 100px; height: 100px; border-radius: 10px; overflow: hidden; }
.uploaded-image img { width: 100%; height: 100%; object-fit: cover; }
.uploaded-image-remove { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border-radius: 50%; background-color: rgba(0, 0, 0, 0.6); color: white; border: none; font-size: 14px; cursor: pointer; }
</style>

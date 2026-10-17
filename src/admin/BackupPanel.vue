<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { exportBackup, readBackup, restoreBackup, downloadBlob } from '../backup'

const props = defineProps({ selected: Array, contents: Array, users: Array })
const emit = defineEmits(['busy', 'restored'])
const busy = ref(false)
const status = ref('')
const error = ref('')
const backup = ref(null)
const report = ref(null)
const existingCount = computed(() => backup.value?.contents.filter(c => props.contents.some(item => item.id === c.id)).length || 0)
const missingAuthors = computed(() => backup.value?.contents.filter(c => !props.users.some(user => user.id === c.author_id)).length || 0)
const imageCount = computed(() => backup.value?.contents.reduce((sum, c) => sum + c.images.length, 0) || 0)

function setBusy(value) { busy.value = value; emit('busy', value) }
function preventLeave(event) {
    if (busy.value) { event.preventDefault(); event.returnValue = '' }
}
onMounted(() => window.addEventListener('beforeunload', preventLeave))
onUnmounted(() => window.removeEventListener('beforeunload', preventLeave))

async function exportFull() {
    if (busy.value || !props.selected.length) return
    setBusy(true); error.value = ''; report.value = null
    try {
        const blob = await exportBackup([...props.selected], message => { status.value = message })
        downloadBlob(blob, `小站完整备份_${new Date().toISOString().slice(0, 10)}.json`)
        status.value = '完整备份已生成，包含选中内容和实际图片。'
    } catch (e) { error.value = e.message; status.value = '' }
    finally { setBusy(false) }
}

async function chooseBackup(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || busy.value) return
    setBusy(true); backup.value = null; error.value = ''; report.value = null
    status.value = '正在校验备份文件和图片…'
    try { backup.value = await readBackup(file); status.value = '校验通过，请确认恢复。' }
    catch (e) { error.value = e.message; status.value = '' }
    finally { setBusy(false) }
}

async function restore() {
    if (busy.value || !backup.value) return
    setBusy(true); error.value = ''; report.value = null
    try {
        report.value = await restoreBackup(backup.value, new Set(props.contents.map(c => c.id)), message => { status.value = message })
        status.value = '恢复处理结束。失败项目可重新导入此文件重试，已恢复的内容会跳过。'
        emit('restored')
    } catch (e) { error.value = e.message }
    finally { setBusy(false) }
}
</script>

<template>
    <section class="backup-panel" :aria-busy="busy">
        <h3>完整备份与恢复</h3>
        <p>完整备份包含正文、实际图片、图片顺序和相册封面，单文件最多 100 MB。图片较多时请按日期分批导出。</p>
        <p>仅备份当前账号可见且已选中的内容，不包含登录账号和密码。</p>
        <div class="backup-actions">
            <button :disabled="busy || !selected.length" @click="exportFull">备份选中内容及图片（{{ selected.length }} 条）</button>
            <label>选择备份恢复 <input type="file" accept=".json,application/json" :disabled="busy" @change="chooseBackup"></label>
        </div>
        <div v-if="backup" class="restore-preview">
            <p>文件包含 {{ backup.contents.length }} 条内容、{{ imageCount }} 张图片；当前列表中已有 {{ existingCount }} 条。</p>
            <p>恢复会保留日期、可见性、顺序和封面。相同编号的内容自动跳过，不覆盖现有内容。</p>
            <p v-if="missingAuthors">{{ missingAuthors }} 条内容的原作者账号不存在，将归入当前管理员账号；其余保留原作者。</p>
            <button :disabled="busy" @click="restore">确认导入缺少的内容</button>
        </div>
        <p v-if="status" role="status" aria-live="polite">{{ status }}</p>
        <p v-if="error" class="backup-error" role="alert">{{ error }}</p>
        <div v-if="report" role="status">
            <p>已恢复 {{ report.restored }} 条，跳过 {{ report.skipped }} 条，失败 {{ report.failed.length }} 条。</p>
            <ul v-if="report.failed.length"><li v-for="(item, i) in report.failed" :key="i">{{ item.title }}：{{ item.message }}</li></ul>
        </div>
    </section>
</template>

<style scoped>
.backup-panel { margin: 24px 0; padding: 20px; border: 1px solid var(--border-color, #ddd); border-radius: 12px; line-height: 1.7; }
h3 { margin-top: 0; }
p { font-size: 14px; }
.backup-actions { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
.backup-actions label { display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
input { max-width: 100%; }
button { padding: 12px 16px; background: var(--brand-color, #4A5C6B); color: white; border: 0; border-radius: 8px; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
.restore-preview { padding: 12px; margin-top: 16px; background: #8881; border-radius: 8px; }
.backup-error { color: #c62828; }
</style>

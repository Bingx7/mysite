<script setup>
import { computed } from 'vue'
import { diaryCalendarDays, diaryMonthLabel, shiftDiaryMonth, localDateKey } from '../diary.js'

const props = defineProps({ month: String, selected: String, days: Object, loading: Boolean, error: String })
defineEmits(['month', 'select', 'today', 'clear', 'retry'])
const calendar = computed(() => diaryCalendarDays(props.month))
const today = computed(() => localDateKey())
function dayLabel(date) {
    const status = props.loading ? '记录加载中' : props.error ? '记录暂未加载' : `${props.days?.[date] || 0} 篇可见日记`
    return `${date}，${status}`
}
</script>

<template>
    <aside class="diary-calendar-rail" aria-label="按日期回看日记">
        <div class="diary-calendar" :aria-busy="loading">
            <div class="calendar-heading">
                <button class="month-arrow" type="button" aria-label="上个月" @click="$emit('month', shiftDiaryMonth(month, -1))">‹</button>
                <label class="month-picker">
                    <span class="month-label">{{ diaryMonthLabel(month) }}</span>
                    <input :value="month" type="month" aria-label="选择日记月份" @change="$event.target.value && $emit('month', $event.target.value)">
                </label>
                <button class="month-arrow" type="button" aria-label="下个月" @click="$emit('month', shiftDiaryMonth(month, 1))">›</button>
            </div>
            <div class="calendar-week" aria-hidden="true"><span v-for="day in ['一','二','三','四','五','六','日']" :key="day">{{ day }}</span></div>
            <div class="calendar-days" :aria-label="diaryMonthLabel(month)">
                <template v-for="(date, index) in calendar" :key="date || `blank-${index}`">
                    <button v-if="date" type="button" :data-date="date" class="calendar-day"
                        :class="{ 'has-diary': !loading && !error && days?.[date], 'is-today': date === today }"
                        :aria-label="dayLabel(date)" :aria-pressed="selected === date" :aria-current="date === today ? 'date' : undefined"
                        @click="$emit('select', date)">{{ Number(date.slice(-2)) }}</button>
                    <span v-else aria-hidden="true"></span>
                </template>
            </div>
            <div class="calendar-actions"><span class="calendar-legend"><span aria-hidden="true">·</span> 有日记</span><button type="button" @click="$emit('today')">回到今天</button></div>
            <button v-if="selected" class="calendar-clear" type="button" @click="$emit('clear')">查看整月日记</button>
            <p v-if="loading" class="calendar-status" role="status">正在加载日期…</p>
            <p v-else-if="error" class="calendar-status" role="status">日期暂时加载失败。<button type="button" @click="$emit('retry')">重试</button></p>
        </div>
        <p class="calendar-note">{{ selected ? `正在查看 ${selected} 的日记。` : '点击日期，回看当天的记录。' }}<br>小点随作者和搜索筛选变化。</p>
    </aside>
</template>

<style scoped>
.diary-calendar-rail { min-width: 0; }
.diary-calendar { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
.calendar-heading { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 16px; }
.month-arrow { display: grid; place-items: center; width: 30px; min-height: 32px; border: 0; border-radius: 5px; background: transparent; color: var(--text-secondary); font-size: 21px; cursor: pointer; flex-shrink: 0; }
.month-arrow:hover, .calendar-day:hover { background: var(--accent-soft); }
.month-picker { position: relative; flex: 1; min-width: 0; text-align: center; }
.month-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.month-picker input { display: block; width: 100%; min-width: 0; min-height: 32px; padding: 2px; border: 0; border-radius: 4px; background: var(--surface); color: var(--text); font-size: 13px; font-weight: 600; cursor: pointer; }
.calendar-week, .calendar-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; }
.calendar-week { text-align: center; color: var(--text-secondary); font-size: 11px; margin-bottom: 8px; }
.calendar-day { position: relative; min-width: 0; min-height: 30px; padding: 2px 0 5px; border: 1px solid transparent; border-radius: 5px; font-size: 12px; color: var(--text); background: transparent; cursor: pointer; font-variant-numeric: tabular-nums; }
.calendar-day.is-today { border-color: var(--brand-color); }
.calendar-day[aria-pressed='true'] { background: var(--btn-primary-bg); color: var(--btn-primary-text); }
.calendar-day.has-diary::after { content: ''; position: absolute; left: calc(50% - 1.5px); bottom: 3px; width: 3px; height: 3px; border-radius: 50%; background: var(--text-secondary); }
.calendar-day[aria-pressed='true']::after { background: var(--btn-primary-text); }
.calendar-actions { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid var(--border); margin-top: 14px; padding-top: 10px; }
.calendar-legend { display: flex; gap: 5px; align-items: center; font-size: 11px; color: var(--text-secondary); }
.calendar-legend span { font-size: 22px; line-height: 1; color: var(--text-secondary); }
.calendar-actions button, .calendar-status button { padding: 5px; border: 0; background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 11px; }
.calendar-clear { width: 100%; min-height: 34px; margin-top: 8px; border: 0; border-radius: 5px; background: var(--surface-muted); color: var(--text); font-size: 12px; cursor: pointer; }
.calendar-status { font-size: 11px; color: var(--text-secondary); margin-top: 10px; }
.calendar-note { font-size: 11px; line-height: 1.9; margin: 14px 3px 0; color: var(--text-secondary); overflow-wrap: anywhere; }
@media (max-width: 720px) { .calendar-day { min-height: 36px; } .calendar-note { margin-top: 8px; } }
@media (pointer: coarse) { .calendar-day, .month-arrow, .calendar-actions button, .calendar-clear { min-height: 44px; } .month-picker input { min-height: 36px; font-size: 16px; } }
</style>

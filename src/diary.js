// 日记使用现有 start_date 保存日历日期，不改变发布时间，也不需要改数据库。
// 新日期以 UTC 零点编码，读取日期部分；旧日记按浏览器本地日期归档。
export function localDateKey(value = new Date()) {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return ''
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function isDiaryDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function diaryDateKey(content) {
    if (content?.start_date) {
        const date = new Date(content.start_date)
        if (Number.isFinite(date.getTime())) return date.toISOString().slice(0, 10)
    }
    return content?.created_at ? localDateKey(content.created_at) : ''
}

export function diaryMonthKey(value = localDateKey()) {
    return isDiaryDate(`${value.slice(0, 7)}-01`) ? value.slice(0, 7) : localDateKey().slice(0, 7)
}

export function shiftDiaryMonth(month, offset) {
    const [year, number] = diaryMonthKey(month).split('-').map(Number)
    const date = new Date(Date.UTC(year, number - 1 + offset, 1))
    return date.toISOString().slice(0, 7)
}

export function diaryMonthLabel(month) {
    const [year, number] = diaryMonthKey(month).split('-').map(Number)
    return `${year} 年 ${number} 月`
}

export function diaryCalendarDays(month) {
    const [year, number] = diaryMonthKey(month).split('-').map(Number)
    const offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7
    const count = new Date(Date.UTC(year, number, 0)).getUTCDate()
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)]
}

export function diaryRangeFilter(month) {
    const start = `${diaryMonthKey(month)}-01`
    const end = `${shiftDiaryMonth(month, 1)}-01`
    const localStart = new Date(`${start}T00:00:00`).toISOString()
    const localEnd = new Date(`${end}T00:00:00`).toISOString()
    return `and(start_date.gte.${start}T00:00:00.000Z,start_date.lt.${end}T00:00:00.000Z),and(start_date.is.null,created_at.gte.${localStart},created_at.lt.${localEnd})`
}

export function sortDiaryIndex(rows) {
    return [...rows].sort((a, b) => diaryDateKey(b).localeCompare(diaryDateKey(a))
        || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
}

export function diaryDayCounts(rows) {
    const result = {}
    for (const row of rows) {
        const date = diaryDateKey(row)
        if (date) result[date] = (result[date] || 0) + 1
    }
    return result
}

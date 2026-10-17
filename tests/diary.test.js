import test from 'node:test'
import assert from 'node:assert/strict'
import { diaryDateKey, localDateKey, isDiaryDate, shiftDiaryMonth, diaryCalendarDays, diaryRangeFilter, sortDiaryIndex, diaryDayCounts } from '../src/diary.js'

test('新日记日期不随时区变化，旧日记按本地发布时间归档', () => {
    assert.equal(diaryDateKey({ start_date: '2026-09-30T00:00:00Z', created_at: '2026-10-17T12:00:00Z' }), '2026-09-30')
    const created = '2026-09-30T23:59:59Z'
    assert.equal(diaryDateKey({ start_date: null, created_at: created }), localDateKey(created))
    assert.equal(diaryDateKey({ start_date: 'invalid', created_at: created }), localDateKey(created))
    assert.equal(diaryDateKey({}), '')
})

test('闰年、跨年及月历周一对齐', () => {
    assert.equal(isDiaryDate('2024-02-29'), true)
    for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '', '2026-1-01']) assert.equal(isDiaryDate(value), false)
    assert.equal(shiftDiaryMonth('2026-12', 1), '2027-01')
    assert.equal(shiftDiaryMonth('2026-01', -1), '2025-12')
    const october = diaryCalendarDays('2026-10')
    assert.deepEqual(october.slice(0, 4), [null, null, null, '2026-10-01'])
    assert.equal(october.at(-1), '2026-10-31')
    assert.equal(diaryCalendarDays('2024-02').filter(Boolean).length, 29)
})

test('日期筛选分别使用记录日期和旧记录的本地日界线，月底为开区间', () => {
    const filter = diaryRangeFilter('2026-12')
    assert.ok(filter.includes('start_date.gte.2026-12-01T00:00:00.000Z'))
    assert.ok(filter.includes('start_date.lt.2027-01-01T00:00:00.000Z'))
    assert.ok(filter.includes(`and(start_date.is.null,created_at.gte.${new Date('2026-12-01T00:00:00').toISOString()}`))
})

test('补写和旧日记混合排序，同一天可有多篇且索引包含分页之外的日期', () => {
    const rows = [
        { id: 'a', created_at: '2026-10-17T12:00:00Z', start_date: '2026-09-01T00:00:00Z' },
        { id: 'b', created_at: '2026-09-30T12:00:00Z', start_date: null },
        { id: 'c', created_at: '2026-10-16T12:00:00Z', start_date: '2026-09-01T00:00:00Z' }
    ]
    assert.deepEqual(sortDiaryIndex(rows).map(row => row.id), ['b', 'a', 'c'])
    assert.equal(rows[0].id, 'a', '排序不修改调用方数组')
    assert.equal(diaryDayCounts(rows)['2026-09-01'], 2)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { otherDiaryUsername, normalizeDiaryAuthorScope } from '../src/diaryAccess.js'

test('对方写的只向 bingx、nian 开放，且彼此对应', () => {
    assert.equal(otherDiaryUsername({ id: 'a', username: 'bingx', level: 1 }), 'nian')
    assert.equal(otherDiaryUsername({ id: 'b', username: 'nian', level: 1 }), 'bingx')
    for (const user of [null, {}, { username: 'bingx' }, { id: 'c', username: 'other', level: 3 },
        { id: 'd', username: 'BINGX', level: 4 }, { id: 'e', name: 'bingx', email: 'nian@example.com' }]) {
        assert.equal(otherDiaryUsername(user), null)
        assert.equal(normalizeDiaryAuthorScope('other', user), 'all')
    }
})

test('普通账号仍可使用全部可见和我写的，未知筛选不会被保留', () => {
    const user = { id: 'c', username: 'ordinary' }
    assert.equal(normalizeDiaryAuthorScope('mine', user), 'mine')
    assert.equal(normalizeDiaryAuthorScope('all', user), 'all')
    assert.equal(normalizeDiaryAuthorScope('unknown', user), 'all')
    assert.equal(normalizeDiaryAuthorScope('mine', null), 'all')
    assert.equal(normalizeDiaryAuthorScope('other', { id: 'a', username: 'bingx' }), 'other')
})

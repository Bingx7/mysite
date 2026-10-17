import test from 'node:test'
import assert from 'node:assert/strict'
import { contentFilter, contentPageSize } from '../src/contentQuery.js'

test('分页尺寸与前台一致', () => {
    assert.equal(contentPageSize('album'), 12)
    for (const type of ['all', 'diary', 'article']) assert.equal(contentPageSize(type), 8)
})

test('访客、作者和各等级管理员的筛选边界', () => {
    assert.equal(contentFilter(null), 'visibility.eq.public')
    const member = contentFilter({ id: 'user-a', level: 1 })
    assert.ok(member.includes('and(visibility.in.(private,partner),author_id.eq."user-a")'))
    assert.equal(member.includes('visibility.eq.internal'), false)
    assert.equal(member.includes('visibility.eq.partner'), false)
    assert.ok(contentFilter({ id: 'user-a', level: 2 }).includes('visibility.eq.internal'))
    for (const level of [3, 4]) {
        const filter = contentFilter({ id: 'user-a', level })
        assert.ok(filter.includes('visibility.eq.partner'))
        assert.ok(filter.includes('visibility.eq.internal'))
        assert.equal(filter.includes('visibility.eq.private'), false)
    }
})

test('搜索保留字面含义且安全引用，不把标点当作 PostgREST 或正则语法', () => {
    for (const term of ['中文', 'A.*B', '100%_done', 'a,b(c)', 'a"b', 'a\\b', '[abc]', '^$+?|{}', 'x),visibility.eq.private']) {
        const filter = contentFilter(null, term)
        assert.ok(filter.startsWith('and(or(visibility.eq.public),or('))
        const captured = filter.match(/title\.imatch\.("(?:\\.|[^"\\])*")/)
        assert.ok(captured)
        const pattern = JSON.parse(captured[1])
        assert.equal(new RegExp(pattern, 'i').test(term), true)
        assert.equal(new RegExp(pattern, 'i').test('无关内容'), false)
        assert.ok(filter.includes('body.imatch.'))
        assert.ok(filter.includes('description.imatch.'))
    }
})

test('空白搜索不会创建空的筛选分组', () => {
    assert.equal(contentFilter(null, '   '), contentFilter(null))
})

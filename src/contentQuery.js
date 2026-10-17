// 查询条件与前台可见性规则一致；数据库 RLS 仍是最终权限边界。
export function contentFilter(user, search = '') {
    const visible = ['visibility.eq.public']
    if (user?.id) {
        const id = JSON.stringify(user.id)
        visible.push(`and(visibility.in.(private,partner),author_id.eq.${id})`)
        if ([3, 4].includes(user.level)) visible.push('visibility.eq.partner')
        if (user.level >= 2) visible.push('visibility.eq.internal')
    }
    const term = search.trim()
    if (!term) return visible.join(',')
    // 使用转义后的字面量正则，逗号、引号、%、* 等不会成为查询语法或通配符。
    const literal = JSON.stringify(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const fields = ['title', 'body', 'description'].map(field => `${field}.imatch.${literal}`)
    return `and(or(${visible.join(',')}),or(${fields.join(',')}))`
}

export function contentPageSize(type) { return type === 'album' ? 12 : 8 }

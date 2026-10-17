// 使用登录后的 profile.username 识别这两个账号，不使用显示名、邮箱或管理员等级。
export function otherDiaryUsername(user) {
    if (!user?.id) return null
    if (user.username === 'bingx') return 'nian'
    if (user.username === 'nian') return 'bingx'
    return null
}

export function normalizeDiaryAuthorScope(scope, user) {
    if (!user?.id) return 'all'
    if (scope === 'mine') return 'mine'
    if (scope === 'other' && otherDiaryUsername(user)) return 'other'
    return 'all'
}

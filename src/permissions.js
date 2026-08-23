import { VISIBILITY, LEVEL } from './config';

// 高级权限角色：SUPER_ADMIN(3) 与 SECONDARY_ADMIN(4) 都视为"高权管理员"，
// 除后台管理入口外享有同等内容查看权限（partner、internal 等），
// 但编辑/删除内容仅限作者本人，高权管理员也不能改动他人的日记/文章。
const HIGH_PRIVILEGE_LEVELS = [LEVEL.SUPER_ADMIN, LEVEL.SECONDARY_ADMIN];

export function isHighPrivileged(userLevel) {
    return HIGH_PRIVILEGE_LEVELS.includes(userLevel);
}

export function isContentVisible(content, currentUser) {
    const userLevel = currentUser?.level ?? LEVEL.GUEST;

    switch (content.visibility) {
        case VISIBILITY.PUBLIC:
            return true;
        case VISIBILITY.PRIVATE:
            return currentUser && content.author_id === currentUser.id;
        case VISIBILITY.PARTNER:
            // 作者本人 或 高权管理员（超管/次级管理员）
            return currentUser && (content.author_id === currentUser.id || isHighPrivileged(userLevel));
        case VISIBILITY.INTERNAL:
            return userLevel >= LEVEL.ADMIN;
        default:
            return false;
    }
}

export function getVisibleContents(contents, currentUser) {
    return contents.filter(content => isContentVisible(content, currentUser));
}

// 编辑、删除内容：仅限作者本人，任何管理员都不能修改别人的日记/文章
export function canEditContent(content, currentUser) {
    if (!currentUser) return false;
    return content.author_id === currentUser.id;
}

export function canDeleteContent(content, currentUser) {
    if (!currentUser) return false;
    return content.author_id === currentUser.id;
}
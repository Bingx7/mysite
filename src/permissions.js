import { VISIBILITY, LEVEL } from './config';

export function isContentVisible(content, currentUser) {
    const userLevel = currentUser?.level || LEVEL.GUEST;
    
    switch (content.visibility) {
        case VISIBILITY.PUBLIC:
            return true;
        case VISIBILITY.PRIVATE:
            return currentUser && content.authorId === currentUser.id;
        case VISIBILITY.PARTNER:
            return currentUser && (content.authorId === currentUser.id || userLevel === LEVEL.SUPER_ADMIN);
        case VISIBILITY.INTERNAL:
            return userLevel >= LEVEL.ADMIN;
        default:
            return false;
    }
}

export function getVisibleContents(contents, currentUser) {
    return contents.filter(content => isContentVisible(content, currentUser));
}

export function canEditContent(content, currentUser) {
    if (!currentUser) return false;
    return content.authorId === currentUser.id || currentUser.level === LEVEL.SUPER_ADMIN;
}

export function canDeleteContent(content, currentUser) {
    if (!currentUser) return false;
    return content.authorId === currentUser.id || currentUser.level === LEVEL.SUPER_ADMIN;
}
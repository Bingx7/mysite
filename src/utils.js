import { levelNameMap, levelColorMap, visibilityConfig, typeLabelMap } from './config';

export function formatDate(timestamp, showTime = false) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    if (showTime) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    
    return `${year}-${month}-${day}`;
}

export function formatDateRange(startDate, endDate) {
    if (!startDate) return '';
    const start = formatDate(startDate);
    const end = endDate ? formatDate(endDate) : '至今';
    return `${start} ~ ${end}`;
}

export function truncateText(text, maxLen) {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.substring(0, maxLen) + '...';
}

export function getLevelName(level) {
    return levelNameMap[level] || '未知';
}

export function getLevelColor(level) {
    return levelColorMap[level] || '#9CA3AF';
}

export function getVisibilityLabel(visibility) {
    return visibilityConfig[visibility]?.label || '未知';
}

export function getVisibilityIcon(visibility) {
    return visibilityConfig[visibility]?.icon || '❓';
}

export function getVisibilityColor(visibility) {
    return visibilityConfig[visibility]?.color || '#9CA3AF';
}

export function getContentTypeLabel(type) {
    return typeLabelMap[type] || '未知';
}

export function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}
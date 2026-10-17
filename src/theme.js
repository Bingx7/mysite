import { reactive } from 'vue'

const DEFAULT_THEME = { brandColor: '#53616B', brightness: 'light', cardStyle: 'border', fontSize: 'medium' }
const BRAND_COLORS = ['#53616B', '#202124', '#5C6B73', '#3D4F4A', '#8B7E74', '#6B4C4C', '#000000']
const currentTheme = reactive({ ...DEFAULT_THEME })
const palettes = {
    light: { bg: '#F8F7F4', entryBg: '#F7F5F1', entryCool: '#DFE7ED', entryWarm: '#EEE2D3', surface: '#FFFFFF', muted: '#F0F1F2', text: '#202124', secondary: '#6D7278', border: '#E3E5E7', danger: '#B3443E' },
    neutral: { bg: '#F0EFEC', entryBg: '#EFEDE8', entryCool: '#D8E0E5', entryWarm: '#E7DACB', surface: '#FAFAFA', muted: '#E7E9EB', text: '#25282B', secondary: '#62686E', border: '#D9DDE0', danger: '#B3443E' },
    dark: { bg: '#181A1C', entryBg: '#181A1C', entryCool: '#26323C', entryWarm: '#302A25', surface: '#202326', muted: '#2B2F33', text: '#ECEEF0', secondary: '#A4ABB2', border: '#373C42', danger: '#F08D86' }
}

export function loadTheme() {
    let stored = {}
    try { stored = JSON.parse(localStorage.getItem('theme') || '{}') || {} } catch { /* 使用默认外观 */ }
    Object.assign(currentTheme, DEFAULT_THEME)
    for (const key of Object.keys(DEFAULT_THEME)) if (typeof stored[key] === 'string') currentTheme[key] = stored[key]
    if (currentTheme.cardStyle === 'glass') currentTheme.cardStyle = 'flat'
    applyTheme()
}
export function saveTheme() { localStorage.setItem('theme', JSON.stringify(currentTheme)) }
export function applyTheme() {
    const root = document.documentElement
    const palette = palettes[currentTheme.brightness] || palettes.light
    const brand = /^#[\da-f]{6}$/i.test(currentTheme.brandColor) ? currentTheme.brandColor : DEFAULT_THEME.brandColor
    const rgb = brand.slice(1).match(/.{2}/g).map(value => parseInt(value, 16))
    const contrastText = rgb[0] * .299 + rgb[1] * .587 + rgb[2] * .114 > 160 ? '#202124' : '#FFFFFF'
    const variables = {
        '--brand-color': brand,
        '--bg': palette.bg, '--bg-color': palette.bg,
        '--entry-bg': palette.entryBg, '--entry-cool': palette.entryCool, '--entry-warm': palette.entryWarm,
        '--surface': palette.surface, '--bg-card': palette.surface, '--card-bg': palette.surface,
        '--surface-muted': palette.muted,
        '--text': palette.text, '--text-color': palette.text,
        '--text-secondary': palette.secondary, '--text-secondary-color': palette.secondary,
        '--border': palette.border, '--border-color': palette.border,
        '--danger': palette.danger,
        '--btn-primary-bg': brand, '--btn-primary-text': contrastText,
        '--btn-secondary-bg': palette.muted, '--btn-secondary-text': palette.text,
        '--btn-danger-bg': palette.danger, '--btn-danger-text': currentTheme.brightness === 'dark' ? '#181A1C' : '#FFFFFF',
        '--font-size': ({ small: 13, medium: 14, large: 16 }[currentTheme.fontSize] || 14) + 'px'
    }
    for (const [key, value] of Object.entries(variables)) root.style.setProperty(key, value)
    root.style.colorScheme = currentTheme.brightness === 'dark' ? 'dark' : 'light'
    root.dataset.cardStyle = currentTheme.cardStyle === 'glass' ? 'flat' : currentTheme.cardStyle
}
export function getTheme() { return currentTheme }
export function setTheme(updates) { Object.assign(currentTheme, updates); applyTheme(); saveTheme() }
export function resetTheme() { Object.assign(currentTheme, DEFAULT_THEME); applyTheme(); saveTheme() }
export function getBrandColors() { return BRAND_COLORS }
export function getBrightnessOptions() { return [{ value: 'light', label: '亮色' }, { value: 'neutral', label: '中性' }, { value: 'dark', label: '暗色' }] }
export function getCardStyleOptions() { return [{ value: 'flat', label: '平面' }, { value: 'border', label: '细边框' }, { value: 'shadow', label: '轻阴影' }] }
export function getFontSizeOptions() { return [{ value: 'small', label: '小' }, { value: 'medium', label: '中' }, { value: 'large', label: '大' }] }

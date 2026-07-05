const DEFAULT_THEME = {
    brandColor: '#4A5C6B',
    brightness: 'light',
    glassStrength: 85,
    backgroundBlur: 0,
    cardStyle: 'glass',
    fontSize: 'medium'
};

const BRAND_COLORS = [
    '#2C3E50', '#5C6B73', '#3D4F4A', '#8B7E74',
    '#6B4C4C', '#4A5D6B', '#000000'
];

let currentTheme = { ...DEFAULT_THEME };

export function loadTheme() {
    const stored = localStorage.getItem('theme');
    if (stored) {
        try {
            currentTheme = { ...DEFAULT_THEME, ...JSON.parse(stored) };
        } catch {
            currentTheme = { ...DEFAULT_THEME };
        }
    }
    applyTheme();
}

export function saveTheme() {
    localStorage.setItem('theme', JSON.stringify(currentTheme));
}

export function applyTheme() {
    const root = document.documentElement;
    
    root.style.setProperty('--brand-color', currentTheme.brandColor);
    
    const brightnessConfig = {
        light: { bg: '#F5F4F1', card: 'rgba(255,255,255,0.85)', text: '#2D3436', secondary: '#636E72', border: '#E8E7E4' },
        neutral: { bg: '#E8E8E8', card: 'rgba(255,255,255,0.7)', text: '#333333', secondary: '#555555', border: '#D0D0D0' },
        dark: { bg: '#1A1A1A', card: 'rgba(40,40,40,0.85)', text: '#E0E0E0', secondary: '#888888', border: '#333333' }
    };
    
    const config = brightnessConfig[currentTheme.brightness] || brightnessConfig.light;
    root.style.setProperty('--bg-color', config.bg);
    root.style.setProperty('--card-bg', config.card);
    root.style.setProperty('--text-color', config.text);
    root.style.setProperty('--text-secondary-color', config.secondary);
    root.style.setProperty('--border-color', config.border);
    
    root.style.setProperty('--glass-opacity', currentTheme.glassStrength / 100);
    root.style.setProperty('--background-blur', currentTheme.backgroundBlur + 'px');
    
    const fontSizeConfig = {
        small: 13,
        medium: 14,
        large: 16
    };
    root.style.setProperty('--font-size', fontSizeConfig[currentTheme.fontSize] + 'px');
}

export function getTheme() {
    return currentTheme;
}

export function setTheme(updates) {
    currentTheme = { ...currentTheme, ...updates };
    applyTheme();
    saveTheme();
}

export function resetTheme() {
    currentTheme = { ...DEFAULT_THEME };
    applyTheme();
    saveTheme();
}

export function getBrandColors() {
    return BRAND_COLORS;
}

export function getBrightnessOptions() {
    return [
        { value: 'light', label: '亮色' },
        { value: 'neutral', label: '中性' },
        { value: 'dark', label: '暗色' }
    ];
}

export function getCardStyleOptions() {
    return [
        { value: 'shadow', label: '阴影' },
        { value: 'border', label: '边框' },
        { value: 'glass', label: '透明' }
    ];
}

export function getFontSizeOptions() {
    return [
        { value: 'small', label: '小' },
        { value: 'medium', label: '中' },
        { value: 'large', label: '大' }
    ];
}
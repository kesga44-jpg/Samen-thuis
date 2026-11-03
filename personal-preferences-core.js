(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisPersonalPreferences = core;
})(globalThis, function () {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ACCENT_PRESETS = { bluePurple: '#5f63d8', blue: '#315f86', purple: '#7057d9', orange: '#d56e38' };
  const DEFAULT_UI = {
    theme: 'system', accent: 'purple', accentColor: '#7057d9', density: 'comfortable',
    fontFamily: 'system', fontSize: 16, textColor: '#17243a', secondaryTextColor: '#6b7483',
    fontWeight: 400, lineHeight: 1.5, radius: 16, spacing: 1, animations: true,
    colors: {
      background: '#f3f6f8', card: '#ffffff', accent: '#7057d9', button: '#7057d9',
      buttonText: '#ffffff', navigation: '#ffffff', activeItem: '#7057d9',
      inactiveItem: '#6b7483', icon: '#315f86', border: '#e2e7ed', link: '#315f86',
      table: '#ffffff', chart: '#7057d9', success: '#31845b', warning: '#d58a27', error: '#b84f58'
    }
  };
  const HEX = /^#[0-9a-f]{6}$/i;

  function storageKey(userId) {
    const id = String(userId || '');
    if (!UUID.test(id)) throw new Error('Een aangemelde Supabase-gebruikers-ID is vereist.');
    return `samenThuisPersonalPrefsV1:${id.toLowerCase()}`;
  }

  function normalize(value, widgetIds, dashboardCore = globalThis.SamenThuisDashboard, defaultVisibleIds) {
    const ui = value?.ui && typeof value.ui === 'object' ? value.ui : {};
    const accent = ['bluePurple', 'blue', 'purple', 'orange'].includes(ui.accent) ? ui.accent : 'purple';
    const accentColor = typeof ui.accentColor === 'string' && /^#[0-9a-f]{6}$/i.test(ui.accentColor)
      ? ui.accentColor
      : ACCENT_PRESETS[accent];
    const colors = { ...DEFAULT_UI.colors };
    for (const [key, color] of Object.entries(ui.colors || {})) {
      if (Object.hasOwn(colors, key) && HEX.test(color)) colors[key] = color;
    }
    if (!HEX.test(ui.colors?.accent)) colors.accent = accentColor;
    const preferences = {
      ui: {
        ...DEFAULT_UI, ...ui, colors,
        theme: ['system', 'light', 'dark'].includes(ui.theme) ? ui.theme : 'system',
        accent,
        accentColor,
        density: ['comfortable', 'compact', 'spacious'].includes(ui.density) ? ui.density : 'comfortable',
        fontFamily: ['system', 'Inter', 'Roboto', 'Arial', 'Poppins', 'Nunito'].includes(ui.fontFamily) ? ui.fontFamily : 'system',
        fontSize: Number.isFinite(Number(ui.fontSize)) ? Math.max(12, Math.min(24, Number(ui.fontSize))) : DEFAULT_UI.fontSize,
        textColor: HEX.test(ui.textColor) ? ui.textColor : DEFAULT_UI.textColor,
        secondaryTextColor: HEX.test(ui.secondaryTextColor) ? ui.secondaryTextColor : DEFAULT_UI.secondaryTextColor,
        fontWeight: [400, 500, 600, 700].includes(Number(ui.fontWeight)) ? Number(ui.fontWeight) : DEFAULT_UI.fontWeight,
        lineHeight: Number.isFinite(Number(ui.lineHeight)) ? Math.max(1.2, Math.min(2, Number(ui.lineHeight))) : DEFAULT_UI.lineHeight,
        radius: Number.isFinite(Number(ui.radius)) ? Math.max(0, Math.min(28, Number(ui.radius))) : DEFAULT_UI.radius,
        spacing: Number.isFinite(Number(ui.spacing)) ? Math.max(0.75, Math.min(1.5, Number(ui.spacing))) : DEFAULT_UI.spacing,
        animations: ui.animations !== false
      },
      profile: normalizeProfile(value?.profile),
      dashboard: dashboardCore
        ? dashboardCore.normalize(value?.dashboard, widgetIds, defaultVisibleIds)
        : value?.dashboard
    };
    return preferences;
  }

  function normalizeProfile(value) {
    const profile = value && typeof value === 'object' ? value : {};
    return {
      firstName: String(profile.firstName || '').trim().slice(0, 80),
      lastName: String(profile.lastName || '').trim().slice(0, 80),
      nickname: String(profile.nickname || '').trim().slice(0, 80),
      personKey: ['Kees', 'Daphne'].includes(profile.personKey) ? profile.personKey : '',
      avatarPath: typeof profile.avatarPath === 'string' && /^[0-9a-f-]{36}\/profile\.jpg$/i.test(profile.avatarPath) ? profile.avatarPath : ''
    };
  }

  return { storageKey, normalize, normalizeProfile, DEFAULT_UI };
});

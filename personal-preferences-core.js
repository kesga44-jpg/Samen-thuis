(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisPersonalPreferences = core;
})(globalThis, function () {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ACCENT_PRESETS = { bluePurple: '#5f63d8', blue: '#315f86', purple: '#7057d9', orange: '#d56e38' };

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
    const preferences = {
      ui: {
        theme: ['system', 'light', 'dark'].includes(ui.theme) ? ui.theme : 'system',
        accent,
        density: ['comfortable', 'compact'].includes(ui.density) ? ui.density : 'comfortable',
        accentColor
      },
      dashboard: dashboardCore
        ? dashboardCore.normalize(value?.dashboard, widgetIds, defaultVisibleIds)
        : value?.dashboard
    };
    return preferences;
  }

  return { storageKey, normalize };
});

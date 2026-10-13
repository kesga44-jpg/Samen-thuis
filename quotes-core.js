(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisQuotes = core;
})(globalThis, function () {
  const ROTATION_INTERVAL = 24 * 60 * 60 * 1000;

  function shouldRefresh(lastCheckedAt, now = Date.now()) {
    const checked = Date.parse(lastCheckedAt || '');
    return !Number.isFinite(checked) || checked > now || now - checked >= ROTATION_INTERVAL;
  }

  return { ROTATION_INTERVAL, shouldRefresh };
});

(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisChalkboard = core;
})(globalThis, function () {
  const MAX_LENGTH = 280;
  const MAX_AUTHOR = 40;

  function length(text) { return Array.from(String(text || '')).length; }

  function validateMessage(text) {
    const value = String(text ?? '').replace(/\r\n?/g, '\n').trim();
    if (!value) return { ok: false, error: 'Schrijf eerst een berichtje.' };
    if (length(value) > MAX_LENGTH) return { ok: false, error: `Een bericht mag maximaal ${MAX_LENGTH} tekens bevatten.` };
    return { ok: true, value };
  }

  function authorName(user) {
    const meta = user?.user_metadata || {};
    const raw = String(meta.full_name || meta.name || String(user?.email || '').split('@')[0] || 'Huisgenoot').trim();
    const name = Array.from(raw || 'Huisgenoot').slice(0, MAX_AUTHOR).join('');
    return name.charAt(0).toLocaleUpperCase('nl-NL') + name.slice(1);
  }

  function isAdminRole(role) { return role === 'owner' || role === 'admin'; }

  function canDelete(message, userId, role) {
    if (!message || !userId) return false;
    return message.user_id === userId || isAdminRole(role);
  }

  function sortMessages(messages) {
    return [...(Array.isArray(messages) ? messages : [])]
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  }

  function formatWhen(iso, now = new Date()) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const time = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' }).format(date);
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) return `vandaag ${time}`;
    return `${new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(date)} ${time}`;
  }

  return { MAX_LENGTH, validateMessage, authorName, canDelete, isAdminRole, sortMessages, formatWhen };
});

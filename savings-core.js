(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisSavings = core;
})(globalThis, function () {
  const FREQUENCIES = { weekly: 'Wekelijks', monthly: 'Maandelijks', quarterly: 'Per kwartaal', yearly: 'Jaarlijks' };
  const PERIODS_PER_YEAR = { weekly: 52, monthly: 12, quarterly: 4, yearly: 1 };
  const num = v => { const n = Number(String(v ?? 0).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const round = v => Math.round((v + Number.EPSILON) * 100) / 100;
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime()) ? new Date(`${s}T12:00:00`) : null;
  const normFreq = f => FREQUENCIES[f] ? f : 'monthly';

  // Calendar-safe step: monthly steps clamp to the last day of shorter months.
  function addPeriod(date, freq, count = 1) {
    const d = new Date(date.getTime());
    if (freq === 'weekly') { d.setDate(d.getDate() + 7 * count); return d; }
    const months = (freq === 'quarterly' ? 3 : freq === 'yearly' ? 12 : 1) * count;
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return d;
  }

  function balance(goal) {
    const deposits = Array.isArray(goal?.deposits) ? goal.deposits : [];
    return round(num(goal?.current) + deposits.reduce((s, x) => s + num(x.amount), 0));
  }

  // Number of deposit moments after `today` up to and including the deadline.
  function remainingMoments(today, deadline, freq) {
    const start = parse(today), end = parse(deadline);
    if (!start || !end || end <= start) return 0;
    let n = 0, d = start;
    for (let i = 1; i < 2000; i++) {
      d = addPeriod(start, freq, i);
      if (d > end) break;
      n = i;
    }
    return Math.max(1, n);
  }

  function status(goal, today) {
    const target = num(goal.target), bal = balance(goal), left = Math.max(0, round(target - bal));
    const freq = normFreq(goal.frequency), deadline = parse(goal.deadline) ? goal.deadline : '';
    const defaultAmount = round(num(goal.periodAmount ?? (goal.monthly != null ? num(goal.monthly) * 12 / PERIODS_PER_YEAR[freq] : 0)));
    const r = { balance: bal, left, frequency: freq, planned: defaultAmount, required: null, moments: null, state: 'active', behind: 0, expectedEnd: '', feasible: true };
    if (goal.paused) { r.state = 'paused'; return r; }
    if (target > 0 && left === 0) { r.state = 'reached'; r.required = 0; return r; }
    if (deadline) {
      r.moments = remainingMoments(today, deadline, freq);
      if (deadline < today) { r.state = 'expired'; r.feasible = false; r.required = left; return r; }
      r.required = r.moments ? round(left / r.moments) : left;
      r.feasible = defaultAmount + 0.005 >= r.required;
      const start = parse(goal.startDate), dl = parse(deadline);
      if (start && dl && dl > start) {
        const total = dl - start, elapsed = Math.min(total, Math.max(0, parse(today) - start));
        const base = num(goal.startAmount);
        r.expected = round(Math.min(target, base + (target - base) * elapsed / total));
        r.behind = Math.max(0, round(r.expected - bal));
      }
    }
    if (defaultAmount > 0) {
      const periods = Math.ceil(left / defaultAmount - 1e-9);
      r.expectedEnd = iso(addPeriod(parse(today), freq, periods));
    }
    if (r.behind > 0) r.state = 'behind';
    return r;
  }

  function addDeposit(goal, input) {
    const amount = round(num(input.amount)), date = String(input.date || '');
    if (!(amount !== 0) || !Number.isFinite(amount)) throw new Error('Vul een bedrag in (niet 0)');
    if (!parse(date)) throw new Error('Ongeldige datum');
    goal.deposits = Array.isArray(goal.deposits) ? goal.deposits : [];
    const sig = `${date}|${amount}|${String(input.note || '').trim().toLowerCase()}|${input.source || ''}`;
    const dup = goal.deposits.some(x => x.id === input.id && input.id || x.sig === sig && input.externalId == null || input.externalId != null && x.externalId === input.externalId);
    if (dup) return { added: false, goal };
    goal.deposits.push({ id: input.id || `dep-${Date.now().toString(36)}-${goal.deposits.length}`, date, amount, note: input.note || '', source: input.source || '', externalId: input.externalId, sig });
    return { added: true, goal };
  }

  // Actual deposits in the period containing `today` (week = Mon-Sun, month/quarter/year = calendar).
  function actualInPeriod(goal, today, freq = normFreq(goal.frequency)) {
    const t = parse(today); if (!t) return 0;
    const key = d => {
      const x = parse(d); if (!x) return null;
      if (freq === 'weekly') { const m = new Date(x); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return iso(m); }
      if (freq === 'yearly') return String(x.getFullYear());
      if (freq === 'quarterly') return `${x.getFullYear()}-Q${Math.floor(x.getMonth() / 3)}`;
      return `${x.getFullYear()}-${x.getMonth()}`;
    };
    const k = key(today);
    return round((goal.deposits || []).filter(x => key(x.date) === k).reduce((s, x) => s + num(x.amount), 0));
  }

  const monthlyEquivalent = (amount, freq) => amount * PERIODS_PER_YEAR[normFreq(freq)] / 12;

  // Proposal: needs are expressed per month; fill by priority (1 = highest), then deadline.
  function propose(goals, available, today) {
    const avail = Math.max(0, num(available));
    const rows = goals.filter(g => !g.paused).map(g => {
      const s = status(g, today);
      const need = ['reached', 'expired', 'paused'].includes(s.state) ? 0 : monthlyEquivalent(s.required ?? s.planned, s.frequency);
      return { id: g.id, title: g.title, priority: num(g.priority) || 3, deadline: g.deadline || '9999-12-31', need: round(need), behind: s.behind, proposed: 0, reason: '' };
    });
    const totalNeed = round(rows.reduce((s, r) => s + r.need, 0));
    let rest = avail;
    [...rows].sort((a, b) => a.priority - b.priority || a.deadline.localeCompare(b.deadline)).forEach(r => {
      r.proposed = round(Math.min(r.need, rest)); rest = round(rest - r.proposed);
      r.reason = r.need === 0 ? 'Geen inleg nodig' : r.proposed >= r.need ? `Volledig voorgesteld (prioriteit ${r.priority})`
        : r.proposed > 0 ? `Gedeeltelijk: beschikbaar bedrag raakt op (prioriteit ${r.priority})` : `Niet gefinancierd: lagere prioriteit/latere deadline`;
    });
    return { rows, totalNeed, available: avail, shortfall: Math.max(0, round(totalNeed - avail)), leftover: Math.max(0, round(avail - totalNeed)) };
  }

  return { FREQUENCIES, balance, status, addDeposit, actualInPeriod, propose, remainingMoments, addPeriod, monthlyEquivalent, num, round };
});

(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisRewards = core;
})(globalThis, function () {
  const PEOPLE = ['Kees', 'Daphne'];
  const uid = () => `rw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const cleanText = value => String(value ?? '').trim().slice(0, 200);
  const uniquePeople = values => [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim()).filter(value => PEOPLE.includes(value)))];

  function balance(state) {
    return (state.ledger || []).reduce((total, entry) => total + (Number(entry.points) || 0), 0);
  }

  function normalize(raw, defaultRewards) {
    const state = raw && typeof raw === 'object' ? structuredClone(raw) : {};
    state.challenges = Array.isArray(state.challenges) ? state.challenges : [];
    state.rewards = Array.isArray(state.rewards) ? state.rewards : defaultRewards();
    state.ledger = Array.isArray(state.ledger) ? state.ledger : [];
    state.activities = Array.isArray(state.activities) ? state.activities : [];
    state.redemptions = Array.isArray(state.redemptions) ? state.redemptions : [];
    if (!state.migratedLedgerV1) {
      const historical = balance(state);
      const previousBalance = Number(state.balance) || 0;
      const difference = previousBalance - historical;
      if (difference) state.ledger.push({
        id: 'legacy-balance-opening-v1', date: new Date().toISOString().slice(0, 10),
        kind: 'correctie', title: 'Bestaand puntensaldo overgezet', points: difference
      });
      state.migratedLedgerV1 = true;
    }
    state.balance = balance(state);
    return state;
  }

  function post(state, { id = uid(), kind, title, points, sourceId = '', person = '' }) {
    if (state.ledger.some(entry => entry.id === id)) return false;
    const amount = Number(points);
    if (!Number.isInteger(amount) || !amount) throw new Error('Punten moeten een geheel getal zijn.');
    if (balance(state) + amount < 0) throw new Error('Er zijn onvoldoende punten beschikbaar.');
    state.ledger.unshift({
      id, date: new Date().toISOString().slice(0, 10), kind, title: cleanText(title),
      points: amount, ...(sourceId ? { sourceId } : {}), ...(person ? { person } : {})
    });
    state.balance = balance(state);
    return true;
  }

  function addChallenge(state, input, id = uid()) {
    const title = cleanText(input.title);
    const creator = PEOPLE.includes(input.creator) ? input.creator : '';
    const participants = uniquePeople(input.participants);
    const points = Math.max(0, Math.min(500, Math.trunc(Number(input.points) || 0)));
    const target = Math.max(1, Math.min(365, Math.trunc(Number(input.target) || 1)));
    if (!title || !creator || participants.length < 2 || !participants.includes(creator)) {
      throw new Error('Vul een titel, maker en minimaal twee deelnemers in.');
    }
    if ((input.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.startDate))
      || (input.endDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate))
      || (input.startDate && input.endDate && input.endDate < input.startDate)) {
      throw new Error('Controleer de begin- en einddatum van de uitdaging.');
    }
    const challenge = {
      id, title, description: cleanText(input.description), creator, participants,
      kind: ['competition', 'together'].includes(input.kind) ? input.kind : 'competition',
      startDate: input.startDate || '', endDate: input.endDate || '', target, points,
      status: 'proposed', responses: { [creator]: 'accepted' }, checkins: [], createdAt: new Date().toISOString()
    };
    state.challenges.unshift(challenge);
    return challenge;
  }

  function respondChallenge(state, id, person, accepted) {
    const challenge = state.challenges.find(item => item.id === id);
    if (!challenge || challenge.status !== 'proposed' || !challenge.participants.includes(person) || person === challenge.creator) return false;
    challenge.responses ||= {};
    challenge.responses[person] = accepted ? 'accepted' : 'declined';
    if (!accepted) challenge.status = 'declined';
    else if (challenge.participants.every(member => challenge.responses[member] === 'accepted')) challenge.status = 'active';
    return true;
  }

  function addCheckin(state, id, person, date, description = '') {
    const challenge = state.challenges.find(item => item.id === id);
    if (!challenge || challenge.status !== 'active' || !challenge.participants.includes(person)
      || !/^\d{4}-\d{2}-\d{2}$/.test(date)
      || (challenge.startDate && date < challenge.startDate)
      || (challenge.endDate && date > challenge.endDate)) return false;
    const checkins = challenge.checkins ||= [];
    if (checkins.some(entry => entry.person === person && entry.date === date)) return false;
    checkins.unshift({ id: uid(), person, date, description: cleanText(description), status: 'awaiting_confirmation' });
    return true;
  }

  function confirmCheckin(state, challengeId, checkinId, confirmer, accepted) {
    const challenge = state.challenges.find(item => item.id === challengeId);
    const checkin = challenge?.checkins?.find(item => item.id === checkinId);
    if (!challenge || !checkin || challenge.status !== 'active' || checkin.status !== 'awaiting_confirmation'
      || confirmer === checkin.person || !challenge.participants.includes(confirmer)) return false;
    if (!accepted) { checkin.status = 'rejected'; return true; }
    checkin.status = 'confirmed';
    const total = challenge.kind === 'together'
      ? challenge.participants.every(person => challenge.checkins.filter(entry => entry.person === person && entry.status === 'confirmed').length >= challenge.target)
      : challenge.participants.some(person => challenge.checkins.filter(entry => entry.person === person && entry.status === 'confirmed').length >= challenge.target);
    if (total) {
      challenge.status = 'completed';
      challenge.completedAt = new Date().toISOString();
      challenge.completedBy = checkin.person;
      if (challenge.points) post(state, {
        id: `challenge:${challenge.id}:completion`, kind: 'verdiend',
        title: challenge.title, points: challenge.points, sourceId: challenge.id,
        person: challenge.kind === 'together' ? 'Samen' : checkin.person
      });
    }
    return true;
  }

  function addActivity(state, input, id = uid()) {
    const title = cleanText(input.title);
    const creator = PEOPLE.includes(input.creator) ? input.creator : '';
    const participants = uniquePeople(input.participants);
    const reward = Math.max(0, Math.min(500, Math.trunc(Number(input.points) || 0)));
    if (!title || !creator || participants.length < 2 || !participants.includes(creator)) {
      throw new Error('Vul een titel, maker en minimaal twee deelnemers in.');
    }
    const activity = {
      id, title, description: cleanText(input.description), creator, participants,
      date: input.date || '', points: reward, status: 'proposed',
      responses: { [creator]: 'accepted' }, completionConfirmations: [], createdAt: new Date().toISOString()
    };
    state.activities.unshift(activity);
    return activity;
  }

  function respondActivity(state, id, person, accepted) {
    const activity = state.activities.find(item => item.id === id);
    if (!activity || activity.status !== 'proposed' || !activity.participants.includes(person) || person === activity.creator) return false;
    activity.responses ||= {};
    activity.responses[person] = accepted ? 'accepted' : 'declined';
    if (!accepted) activity.status = 'declined';
    else if (activity.participants.every(member => activity.responses[member] === 'accepted')) activity.status = 'active';
    return true;
  }

  function confirmActivity(state, id, person) {
    const activity = state.activities.find(item => item.id === id);
    if (!activity || activity.status !== 'active' || !activity.participants.includes(person)
      || activity.completionConfirmations.includes(person)) return false;
    activity.completionConfirmations.push(person);
    if (activity.participants.every(member => activity.completionConfirmations.includes(member))) {
      activity.status = 'completed';
      activity.completedAt = new Date().toISOString();
      if (activity.points) post(state, {
        id: `activity:${activity.id}:completion`, kind: 'verdiend',
        title: activity.title, points: activity.points, sourceId: activity.id, person: 'Samen'
      });
    }
    return true;
  }

  function addReward(state, input, id = uid()) {
    const title = cleanText(input.title);
    const cost = Math.max(1, Math.min(100000, Math.trunc(Number(input.cost) || 0)));
    if (!title || !cost) throw new Error('Vul een titel en een positieve puntenprijs in.');
    const reward = { id, title, note: cleanText(input.note), cost, joint: Boolean(input.joint), active: true };
    state.rewards.push(reward);
    return reward;
  }

  function redeem(state, rewardId, person, id = uid()) {
    const reward = state.rewards.find(item => item.id === rewardId && item.active !== false);
    if (!reward || !PEOPLE.includes(person)) throw new Error('Deze beloning is niet beschikbaar.');
    if (state.redemptions.some(item => item.id === id)) return state.redemptions.find(item => item.id === id);
    if (balance(state) < reward.cost) throw new Error('Er zijn onvoldoende punten beschikbaar.');
    if (reward.joint) return createJointRedemption(state, reward, [person, person === 'Kees' ? 'Daphne' : 'Kees'], id);
    post(state, { id: `redemption:${id}:debit`, kind: 'ingewisseld', title: reward.title, points: -reward.cost, sourceId: id, person });
    const redemption = {
      id, rewardId, title: reward.title, person, performer: person === 'Kees' ? 'Daphne' : 'Kees',
      cost: reward.cost, status: 'pending', createdAt: new Date().toISOString()
    };
    state.redemptions.unshift(redemption);
    return redemption;
  }

  function createJointRedemption(state, reward, participants, id = uid()) {
    const members = uniquePeople(participants);
    if (!reward || members.length < 2) throw new Error('Een gezamenlijke beloning vereist twee deelnemers.');
    if (state.redemptions.some(item => item.id === id)) return state.redemptions.find(item => item.id === id);
    const redemption = {
      id, rewardId: reward.id, title: reward.title, person: members[0], performer: '',
      participants: members, contributions: {}, cost: reward.cost, joint: true,
      status: 'pending', createdAt: new Date().toISOString()
    };
    state.redemptions.unshift(redemption);
    return redemption;
  }

  function respondRedemption(state, id, accepted) {
    const redemption = state.redemptions.find(item => item.id === id);
    if (!redemption || redemption.status !== 'pending' || redemption.performer === redemption.person) return false;
    redemption.status = accepted ? 'accepted' : 'declined';
    if (!accepted && !redemption.refunded) {
      post(state, {
        id: `redemption:${id}:refund`, kind: 'teruggestort', title: redemption.title,
        points: redemption.cost, sourceId: id, person: redemption.person
      });
      redemption.refunded = true;
    }
    return true;
  }

  function confirmRedemption(state, id, performer) {
    const redemption = state.redemptions.find(item => item.id === id);
    if (!redemption || redemption.status !== 'accepted' || redemption.performer !== performer) return false;
    redemption.status = 'completed';
    redemption.completedAt = new Date().toISOString();
    return true;
  }

  function cancelRedemption(state, id, person) {
    const redemption = state.redemptions.find(item => item.id === id);
    if (!redemption || redemption.status !== 'pending' || redemption.person !== person || redemption.refunded) return false;
    redemption.status = 'cancelled';
    redemption.refunded = true;
    post(state, {
      id: `redemption:${id}:refund`, kind: 'teruggestort', title: redemption.title,
      points: redemption.cost, sourceId: id, person
    });
    return true;
  }

  function contribute(state, redemptionId, person, amount) {
    const redemption = state.redemptions.find(item => item.id === redemptionId && item.joint);
    const contribution = Number(amount);
    if (!redemption || redemption.status !== 'pending' || !redemption.participants.includes(person)
      || !Number.isInteger(contribution) || contribution < 1 || contribution > redemption.cost) return false;
    redemption.contributions ||= {};
    if (redemption.contributions[person]) return false;
    const committed = Object.values(redemption.contributions).reduce((total, points) => total + points, 0);
    if (committed + contribution > redemption.cost) throw new Error('De bevestigde bijdragen zijn hoger dan de totale prijs.');
    if (balance(state) < contribution) throw new Error('Er zijn onvoldoende punten beschikbaar.');
    post(state, {
      id: `redemption:${redemptionId}:contribution:${person}`, kind: 'ingewisseld',
      title: `Bijdrage aan ${redemption.title}`, points: -contribution, sourceId: redemptionId, person
    });
    redemption.contributions[person] = contribution;
    const paid = Object.values(redemption.contributions).reduce((total, points) => total + points, 0);
    if (paid === redemption.cost && redemption.participants.every(member => redemption.contributions[member])) redemption.status = 'paid';
    return true;
  }

  function rejectJointRedemption(state, id, person) {
    const redemption = state.redemptions.find(item => item.id === id && item.joint);
    if (!redemption || redemption.status !== 'pending' || !redemption.participants.includes(person)
      || redemption.person === person) return false;
    redemption.status = 'declined';
    redemption.refunded = true;
    Object.entries(redemption.contributions || {}).forEach(([member, amount]) => post(state, {
      id: `redemption:${id}:refund:${member}`, kind: 'teruggestort',
      title: `Terugbetaling: ${redemption.title}`, points: amount, sourceId: id, person: member
    }));
    return true;
  }

  function scheduleJointRedemption(state, id, date) {
    const redemption = state.redemptions.find(item => item.id === id && item.joint);
    if (!redemption || redemption.status !== 'paid' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    redemption.status = 'scheduled';
    redemption.date = date;
    return true;
  }

  function completeJointRedemption(state, id, person) {
    const redemption = state.redemptions.find(item => item.id === id && item.joint);
    if (!redemption || redemption.status !== 'scheduled' || !redemption.participants.includes(person)) return false;
    redemption.completionConfirmations ||= [];
    if (redemption.completionConfirmations.includes(person)) return false;
    redemption.completionConfirmations.push(person);
    if (redemption.participants.every(member => redemption.completionConfirmations.includes(member))) {
      redemption.status = 'completed';
      redemption.completedAt = new Date().toISOString();
    }
    return true;
  }

  return {
    PEOPLE, balance, normalize, post, addChallenge, respondChallenge, addCheckin,
    confirmCheckin, addActivity, respondActivity, confirmActivity, addReward, redeem,
    respondRedemption, confirmRedemption, cancelRedemption, contribute, rejectJointRedemption,
    scheduleJointRedemption, completeJointRedemption
  };
});

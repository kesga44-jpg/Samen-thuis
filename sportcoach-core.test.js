const test = require('node:test');
const assert = require('node:assert/strict');
const Coach = require('./sportcoach-core.js');

function readyProfile(overrides = {}) {
  return {
    ...Coach.emptyProfile('Kees'),
    currentActivity: 'Wandelt regelmatig, loopt 2 km',
    availableWeeklyMinutes: 150,
    currentWeeklyMinutes: 60,
    ...overrides
  };
}

test('normaliseert profielen en bewaart de aanvullende sportgegevens', () => {
  const normalized = Coach.normalize({ profiles: { Kees: { level: 'advanced', runningCurrentKm: 5, limitations: 'vrijwillig ingevuld' } } });
  assert.equal(normalized.profiles.Kees.level, 'advanced');
  assert.equal(normalized.profiles.Kees.runningCurrentKm, 5);
  assert.equal(normalized.profiles.Kees.limitations, 'vrijwillig ingevuld');
  assert.deepEqual(normalized.programs, []);
  assert.deepEqual(normalized.evaluations, []);
  assert.equal(normalized.profiles.Daphne.name, 'Daphne');
});

test('vereist personaliseerbare context en stopt bij ingevulde fysieke aandachtspunten', () => {
  const missing = Coach.assess(Coach.emptyProfile('Kees'), { discipline: 'running', goal: '5 km', weeks: 8, sessionsPerWeek: 3 });
  assert.ok(missing.blockers.some(message => message.includes('huidige activiteit')));
  const restricted = Coach.assess(readyProfile({ limitations: 'Knieklachten' }), { discipline: 'running', goal: '5 km', weeks: 8, sessionsPerWeek: 3 });
  assert.ok(restricted.blockers.some(message => message.includes('bevoegde professional')));
});

test('beperkt frequentie op niveau en beschikbare tijd en bouwt herstelweken in', () => {
  const result = Coach.generateProgram(readyProfile({ availableWeeklyMinutes: 90, level: 'beginner' }), {
    discipline: 'running', goal: 'Opbouwen naar 5 km', weeks: 8, sessionsPerWeek: 5, periodization: 'linear'
  });
  assert.equal(result.ok, true);
  assert.equal(result.program.analysis.frequency, 3);
  assert.equal(result.program.analysis.startingWeeklyMinutes, 60);
  assert.equal(result.program.analysis.minutesPerSession, 20);
  assert.ok(result.analysis.cautions.some(message => message.includes('teruggebracht')));
  assert.equal(result.program.weeks[3].phase, 'Herstel en evaluatie');
  assert.ok(result.program.weeks[0].sessions.every(session => session.intensity.includes('RPE')));
  assert.ok(result.program.evidence.some(item => item.type === 'practical'));
  assert.deepEqual(result.program.sourceSnapshot, []);
});

test('krachttraining bevat sets, herhalingen, rust, overload en deload', () => {
  const result = Coach.generateProgram(readyProfile(), {
    discipline: 'strength', goal: 'Spieropbouw', weeks: 4, sessionsPerWeek: 3, periodization: 'linear'
  });
  const first = result.program.weeks[0].sessions[0];
  assert.ok(first.sets > 0);
  assert.ok(first.reps);
  assert.ok(first.restSeconds >= 60);
  assert.match(result.program.weeks[3].progress, /Herstelweek/);
});

test('evaluatie doet voorstellen en aanpassing verandert het bestaande programma niet', () => {
  const { program } = Coach.generateProgram(readyProfile(), {
    discipline: 'cardio', goal: 'Aerobe basis', weeks: 4, sessionsPerWeek: 3
  });
  const sessions = Array.from({ length: 4 }, (_, index) => ({
    id: `log-${index}`, programId: program.id, completed: true, rpe: 9, durationMinutes: 40, recovery: 'slecht'
  }));
  const evaluation = Coach.evaluateProgram(program, sessions);
  const adjusted = Coach.proposeAdjustment(program, evaluation);
  assert.ok(evaluation.suggestions[0].includes('herstel'));
  assert.equal(adjusted.status, 'draft');
  assert.equal(adjusted.previousProgramId, program.id);
  assert.equal(program.weeks[0].sessions[0].durationMinutes, 60 / 3);
  assert.equal(adjusted.weeks[0].sessions[0].durationMinutes, Math.round(program.weeks[0].sessions[0].durationMinutes * 0.8));
});

test('plooiometrie is gemaximeerd op twee sessies en loopdoelen krijgen geen onveilige deadlinebelofte', () => {
  const plyo = Coach.generateProgram(readyProfile({ level: 'experienced', currentWeeklyMinutes: 120 }), {
    discipline: 'plyometrics', goal: 'Sprongkracht', weeks: 8, sessionsPerWeek: 5
  });
  assert.equal(plyo.program.analysis.frequency, 2);
  const running = Coach.generateProgram(readyProfile(), {
    discipline: 'running', goal: 'Marathon', targetDistanceKm: 42.2, weeks: 8, sessionsPerWeek: 3
  });
  assert.match(running.program.weeks[0].goal, /schuift het doel voorbij deze programmaperiode/);
});

test('hardloopopbouw gebruikt actuele loopafstand, tempo en frequentie en bouwt de langste sessie geleidelijk op', () => {
  const result = Coach.generateProgram(readyProfile({
    runningCurrentKm: 4, runningLongestRunKm: 2, runningPace: '6:30 min/km',
    runningSessionsPerWeek: 2, heartRate: 'eigen zones'
  }), {
    discipline: 'running', goal: '5 km', targetDistanceKm: 5, weeks: 8, sessionsPerWeek: 4
  });
  assert.equal(result.program.analysis.frequency, 3);
  assert.ok(result.analysis.cautions.some(message => message.includes('6:30 min/km')));
  const longRunWeekOne = result.program.weeks[0].sessions.at(-1);
  const longRunWeekThree = result.program.weeks[2].sessions.at(-1);
  assert.equal(longRunWeekOne.targetDistanceKm, 2);
  assert.ok(longRunWeekThree.targetDistanceKm > longRunWeekOne.targetDistanceKm);
  assert.ok(longRunWeekThree.details.includes('betrouwbaar vastgestelde hartslagzones'));
});

test('HIIT en gecombineerde cardio zijn herkenbare keuzes en HIIT wordt voor beginners geblokkeerd', () => {
  const request = { discipline: 'cardio', goal: 'Conditie', weeks: 4, sessionsPerWeek: 3, cardioFocus: 'hiit' };
  const beginner = Coach.generateProgram(readyProfile({ level: 'beginner' }), request);
  assert.ok(beginner.analysis.blockers.some(message => message.includes('HIIT')));
  const experienced = Coach.generateProgram(readyProfile({ level: 'experienced' }), request);
  assert.equal(experienced.ok, true);
  assert.ok(experienced.program.weeks[2].sessions.some(session => session.title.includes('HIIT')));
  const combined = Coach.generateProgram(readyProfile(), { ...request, cardioFocus: 'combined' });
  assert.ok(combined.program.weeks[2].sessions.some(session => session.title === 'Kracht + conditie'));
});

test('astma-profiel blijft optioneel en sluit zonder symptomen geen enkele discipline uit', () => {
  const profile = readyProfile();
  for (const discipline of Coach.DISCIPLINES) {
    const result = Coach.generateProgram(profile, { discipline, goal: 'Persoonlijk doel', weeks: 4, sessionsPerWeek: 2 });
    assert.equal(result.ok, true, discipline);
  }
  const asthmaProfile = readyProfile({ health: {
    ...Coach.emptyProfile('Kees').health,
    asthmaStatus: 'yes',
    triggers: 'intensieve inspanning',
    environment: 'koude lucht, pollen, stof',
    medicationContext: 'privé context die niet naar een trainingsprompt mag'
  } });
  const result = Coach.generateProgram(asthmaProfile, { discipline: 'running', goal: 'Rustig trainen', weeks: 4, sessionsPerWeek: 3 });
  assert.equal(result.ok, true);
  assert.equal(result.analysis.frequency, 3);
  assert.ok(result.analysis.cautions.some(message => message.includes('sluit geen sport')));
  assert.ok(result.program.weeks[0].sessions.every(session => session.details.includes('Geleidelijke warming-up')));
  assert.ok(result.program.weeks[0].sessions.every(session => session.details.includes('Cooling-down')));
  assert.ok(result.program.weeks[0].sessions.every(session => session.details.includes('actuele omstandigheden')));
  assert.equal(JSON.stringify(result.program).includes('privé context'), false);
  assert.equal(JSON.stringify(result.program.analysis).includes('koude lucht'), false);
});

test('zelfgemelde klachten leiden tot rustige opbouw en behandelaaradvies, niet tot diagnose of sportuitsluiting', () => {
  const profile = readyProfile({ health: {
    ...Coach.emptyProfile('Kees').health,
    asthmaStatus: 'unknown',
    symptomsDuringExercise: 'Benauwdheid bij zware intervallen',
    symptomControl: 'unsure'
  } });
  const result = Coach.generateProgram(profile, { discipline: 'cardio', goal: 'Conditie', cardioFocus: 'interval', weeks: 8, sessionsPerWeek: 3 });
  assert.equal(result.ok, true);
  assert.ok(result.analysis.cautions.some(message => message.includes('arts/behandelaar')));
  assert.equal(result.analysis.healthConcern, true);
  assert.ok(result.program.weeks[2].sessions.every(session => session.title !== 'Aerobe intervallen'));
  assert.equal(result.program.weeks[4].sessions[1].intensity, 'RPE 3–4; rustig gesprek mogelijk');
  assert.ok(result.program.weeks[0].sessions[0].details.includes('houd dit voorstel rustig'));
});

test('sessie-evaluatie onderscheidt gewone vermoeidheid van gemelde luchtwegklachten en markeert alarmsymptomen', () => {
  const { program } = Coach.generateProgram(readyProfile(), { discipline: 'running', goal: 'Rustig lopen', weeks: 4, sessionsPerWeek: 2 });
  const fatigue = Coach.evaluateProgram(program, [{ programId: program.id, completed: true, symptomType: 'fatigue' }]);
  assert.equal(fatigue.airwayReports, 0);
  assert.equal(fatigue.severeReports, 0);
  const airway = Coach.evaluateProgram(program, [{ programId: program.id, completed: true, symptomType: 'airway' }]);
  assert.equal(airway.healthConcern, true);
  assert.ok(airway.suggestions[0].includes('niet hetzelfde als normale inspanningsvermoeidheid'));
  const severe = Coach.evaluateProgram(program, [{ programId: program.id, completed: true, symptomType: 'severe' }]);
  assert.equal(severe.severeReports, 1);
  assert.ok(severe.suggestions[0].includes('Stop bij klachten direct'));
  assert.equal(Coach.proposeAdjustment(program, airway).weeks[0].volume, Math.round(program.weeks[0].volume * 0.8));
});

test('normalisatie behoudt onbekende sportvelden en voegt bibliotheek- en planningsvelden veilig toe', () => {
  const result = Coach.normalize({
    futureModule: { keep: true },
    profiles: { Kees: { goals: ['kracht', 'conditie'], availableDays: ['maandag', 'vrijdag'], minutesPerSession: '35' } },
    library: [{ id: 'lib-1', title: 'Schema', category: 'Hardlopen' }],
    plans: [{ id: 'plan-1' }]
  });
  assert.deepEqual(result.futureModule, { keep: true });
  assert.deepEqual(result.profiles.Kees.goals, ['kracht', 'conditie']);
  assert.equal(result.profiles.Kees.minutesPerSession, 35);
  assert.equal(result.library[0].id, 'lib-1');
  assert.equal(result.plans[0].id, 'plan-1');
  assert.deepEqual(result.activeWorkouts, {});
});

test('oefeningen zijn herbruikbaar en ontdubbelen op naam plus discipline', () => {
  const exercises = [];
  const first = Coach.upsertExercise(exercises, { name: 'Goblet squat', discipline: 'strength', sets: 3, reps: '8' });
  const second = Coach.upsertExercise(exercises, { name: ' goblet SQUAT ', discipline: 'strength', instructions: 'Rustig uitvoeren' });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(exercises.length, 1);
  assert.equal(second.exercise.id, first.exercise.id);
  assert.equal(second.exercise.instructions, 'Rustig uitvoeren');
});

test('bronnenbibliotheek zoekt, filtert, sorteert en houdt favorieten bovenaan', () => {
  const items = [
    { id: '1', title: 'Loopschema', category: 'Hardlopen', tags: ['5 km'], createdAt: '2026-01-01' },
    { id: '2', title: 'Kracht thuis', category: 'Krachttraining', tags: ['thuis'], createdAt: '2026-02-01' }
  ];
  assert.deepEqual(Coach.searchLibrary(items, { query: '5 KM' }).map(item => item.id), ['1']);
  assert.deepEqual(Coach.searchLibrary(items, { category: 'Hardlopen' }).map(item => item.id), ['1']);
  assert.deepEqual(Coach.searchLibrary(items, { sort: 'favorites', favoriteIds: ['1'] }).map(item => item.id), ['1', '2']);
});

test('bestandsvalidatie controleert omvang, type en bestandsheader', async () => {
  const file = (name, type, bytes) => ({
    name, type, size: bytes.length,
    arrayBuffer: async () => Uint8Array.from(bytes).buffer
  });
  assert.equal((await Coach.validateUpload(file('plan.pdf', 'application/pdf', [37, 80, 68, 70, 45]))).ok, true);
  assert.equal((await Coach.validateUpload(file('fake.pdf', 'application/pdf', [0, 1, 2]))).ok, false);
  assert.equal((await Coach.validateUpload(file('image.svg', 'image/svg+xml', [60, 115, 118, 103]))).ok, false);
  assert.equal((await Coach.validateUpload({ name: 'large.png', type: 'image/png', size: 11 * 1024 * 1024, arrayBuffer() {} })).ok, false);
});

test('programma-validatie weigert onvolledige output en statistieken gebruiken alleen geregistreerde feiten', () => {
  const { program } = Coach.generateProgram(readyProfile(), {
    discipline: 'strength', goal: 'Kracht', weeks: 4, sessionsPerWeek: 2
  });
  assert.equal(Coach.validateProgram(program).ok, true);
  assert.equal(Coach.validateProgram({ ...program, weeks: [{ week: 1, sessions: [{ title: '', durationMinutes: 0 }] }] }).ok, false);
  const stats = Coach.statistics('Kees', {
    programs: [program],
    sessions: [{ person: 'Kees', completed: true, durationMinutes: 42, exercises: [{ name: 'Deadlift', sets: [{ weight: '60', completed: true }] }] }]
  });
  assert.equal(stats.completedSessions, 1);
  assert.equal(stats.trainingMinutes, 42);
  assert.deepEqual(stats.records, [{ exercise: 'Deadlift', weight: 60 }]);
  assert.equal(stats.weekly.length, 6);
});

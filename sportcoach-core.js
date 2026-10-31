(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  root.SamenThuisSportCoach = core;
})(globalThis, function () {
  const PEOPLE = ['Kees', 'Daphne'];
  const DISCIPLINES = ['running', 'strength', 'plyometrics', 'cardio', 'mobility'];
  const LEVELS = ['beginner', 'recreational', 'advanced', 'experienced'];
  const PERIODIZATIONS = ['linear', 'undulating', 'block'];
  const ASTHMA_STATUSES = ['yes', 'no', 'unknown', 'prefer-not'];
  const SYMPTOM_CONTROLS = ['none', 'concern', 'unsure', 'prefer-not'];
  const SESSION_SYMPTOMS = ['none', 'fatigue', 'airway', 'severe'];
  const LIBRARY_CATEGORIES = ['Krachttraining', 'Explosiviteit', 'Sprongkracht', 'Conditie', 'Hardlopen', 'Mobiliteit', 'Herstel', 'Groepslessen', 'Full body', 'Eigen programma’s'];
  const FILE_TYPES = {
    '.pdf': { mime: 'application/pdf', signature: bytes => String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-' },
    '.jpg': { mime: 'image/jpeg', signature: bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
    '.jpeg': { mime: 'image/jpeg', signature: bytes => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
    '.png': { mime: 'image/png', signature: bytes => [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value) },
    '.webp': { mime: 'image/webp', signature: bytes => String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' }
  };
  const number = (value, fallback = 0) => {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const bounded = (value, min, max) => Math.min(max, Math.max(min, number(value, min)));
  const makeId = (prefix = 'sport') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  function emptyProfile(name) {
    return {
      name, sportBackground: '', previousExperience: '', trainingYears: 0, level: 'beginner',
      currentActivity: '', currentWeeklyMinutes: 0, previousPrograms: '',
      strengthExperience: '', runningExperience: '', groupClassExperience: '',
      personalRecords: '', preferences: '', availableWeeklyMinutes: 0, recoveryNeeds: '',
      limitations: '', availableEquipment: '', runningCurrentKm: 0, runningPace: '',
      runningLongestRunKm: 0, runningSessionsPerWeek: 0, heartRate: '',
      health: {
        asthmaStatus: 'prefer-not', triggers: '', environment: '', symptomsDuringExercise: '',
        symptomsAfterExercise: '', symptomControl: 'prefer-not', attention: '',
        recoveryExperience: '', medicationContext: ''
      },
      userId: '', age: '', goals: [], availableDays: [], minutesPerSession: 0,
      preferredExercises: [], avoidedExercises: [], trainingPreferences: ''
    };
  }

  function normalize(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const profileSource = source.profiles && typeof source.profiles === 'object' ? source.profiles : {};
    const profiles = Object.fromEntries(PEOPLE.map(name => {
      const saved = profileSource[name] && typeof profileSource[name] === 'object' ? profileSource[name] : {};
      const profile = { ...emptyProfile(name), ...saved, name, level: LEVELS.includes(saved.level) ? saved.level : 'beginner' };
      ['sportBackground', 'previousExperience', 'currentActivity', 'previousPrograms', 'strengthExperience', 'runningExperience', 'groupClassExperience', 'personalRecords', 'preferences', 'recoveryNeeds', 'limitations', 'availableEquipment', 'runningPace', 'heartRate'].forEach(key => { profile[key] = String(profile[key] ?? ''); });
      ['goals', 'availableDays', 'preferredExercises', 'avoidedExercises'].forEach(key => {
        profile[key] = Array.isArray(profile[key]) ? [...new Set(profile[key].map(item => String(item).trim()).filter(Boolean))] : [];
      });
      ['age', 'trainingYears', 'availableWeeklyMinutes', 'currentWeeklyMinutes', 'runningCurrentKm', 'runningLongestRunKm', 'runningSessionsPerWeek', 'minutesPerSession'].forEach(key => {
        profile[key] = Math.max(0, number(profile[key]));
      });
      profile.userId = String(profile.userId || '');
      profile.trainingPreferences = String(profile.trainingPreferences || '');
      const savedHealth = saved.health && typeof saved.health === 'object' ? saved.health : {};
      profile.health = { ...emptyProfile(name).health, ...savedHealth };
      ['triggers', 'environment', 'symptomsDuringExercise', 'symptomsAfterExercise', 'attention', 'recoveryExperience', 'medicationContext'].forEach(key => { profile.health[key] = String(profile.health[key] ?? ''); });
      if (!ASTHMA_STATUSES.includes(profile.health.asthmaStatus)) profile.health.asthmaStatus = 'prefer-not';
      if (!SYMPTOM_CONTROLS.includes(profile.health.symptomControl)) profile.health.symptomControl = 'prefer-not';
      return [name, profile];
    }));
    const normalizeRecords = key => Array.isArray(source[key]) ? source[key].filter(x => x && typeof x === 'object') : [];
    return {
      ...source,
      profiles,
      programs: normalizeRecords('programs'),
      sessions: normalizeRecords('sessions'),
      sources: normalizeRecords('sources'),
      exercises: normalizeRecords('exercises').map(normalizeExercise),
      library: normalizeRecords('library'),
      evaluations: normalizeRecords('evaluations'),
      plans: normalizeRecords('plans'),
      libraryCategories: Array.isArray(source.libraryCategories)
        ? [...new Set(source.libraryCategories.map(item => String(item).trim()).filter(Boolean))]
        : LIBRARY_CATEGORIES.slice(),
      favorites: Array.isArray(source.favorites) ? [...new Set(source.favorites.map(String))] : [],
      settings: { view: 'cards', ...(source.settings && typeof source.settings === 'object' ? source.settings : {}) },
      activeWorkouts: source.activeWorkouts && typeof source.activeWorkouts === 'object' ? { ...source.activeWorkouts } : {}
    };
  }

  function normalizeExercise(exercise = {}) {
    const value = exercise && typeof exercise === 'object' ? exercise : {};
    return {
      ...value,
      id: String(value.id || makeId('exercise')),
      name: String(value.name || '').trim(),
      description: String(value.description || ''),
      discipline: DISCIPLINES.includes(value.discipline) ? value.discipline : 'strength',
      category: String(value.category || 'strength'),
      muscleGroups: Array.isArray(value.muscleGroups) ? value.muscleGroups.map(String) : [],
      equipment: Array.isArray(value.equipment) ? value.equipment.map(String) : [],
      difficulty: String(value.difficulty || 'beginner'),
      instructions: String(value.instructions || value.notes || ''),
      sets: Math.max(0, number(value.sets)),
      reps: String(value.reps || ''),
      durationSeconds: Math.max(0, number(value.durationSeconds)),
      restSeconds: Math.max(0, number(value.restSeconds)),
      imageUrl: String(value.imageUrl || ''),
      videoUrl: String(value.videoUrl || ''),
      sourceId: String(value.sourceId || ''),
      tags: Array.isArray(value.tags) ? [...new Set(value.tags.map(tag => String(tag).trim()).filter(Boolean))] : []
    };
  }

  function exerciseKey(exercise) {
    return `${String(exercise?.name || '').trim().toLocaleLowerCase('nl-NL')}|${String(exercise?.discipline || '').trim().toLocaleLowerCase('nl-NL')}`;
  }

  function upsertExercise(exercises, incoming) {
    const normalized = normalizeExercise(incoming);
    if (!normalized.name) throw new Error('Vul een oefeningsnaam in.');
    const key = exerciseKey(normalized);
    const existing = exercises.find(item => exerciseKey(item) === key);
    if (existing) {
      Object.assign(existing, normalized, { id: existing.id });
      return { exercise: existing, created: false };
    }
    exercises.push(normalized);
    return { exercise: normalized, created: true };
  }

  function searchLibrary(items, { query = '', category = '', tag = '', favoriteIds = [], sort = 'newest' } = {}) {
    const text = String(query).trim().toLocaleLowerCase('nl-NL');
    const favorites = new Set(favoriteIds);
    const filtered = (Array.isArray(items) ? items : []).filter(item => {
      const haystack = [item.title, item.description, item.source, ...(item.tags || [])].join(' ').toLocaleLowerCase('nl-NL');
      return (!text || haystack.includes(text))
        && (!category || item.category === category)
        && (!tag || (item.tags || []).includes(tag));
    });
    return filtered.sort((left, right) => {
      if (sort === 'title') return String(left.title || '').localeCompare(String(right.title || ''), 'nl-NL');
      if (sort === 'favorites') return Number(favorites.has(right.id)) - Number(favorites.has(left.id));
      return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
    });
  }

  function validateUpload(file) {
    if (!file || typeof file.name !== 'string' || typeof file.arrayBuffer !== 'function') return { ok: false, error: 'Selecteer een geldig PDF- of afbeeldingsbestand.' };
    if (file.size <= 0 || file.size > 10 * 1024 * 1024) return { ok: false, error: 'Bestanden moeten groter zijn dan 0 en maximaal 10 MB.' };
    const extension = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '';
    const type = FILE_TYPES[extension];
    if (!type || file.type !== type.mime) return { ok: false, error: 'Alleen PDF, JPG/JPEG, PNG en WebP met een passend bestandstype zijn toegestaan.' };
    return file.arrayBuffer().then(buffer => {
      const bytes = new Uint8Array(buffer);
      return type.signature(bytes)
        ? { ok: true, mime: type.mime }
        : { ok: false, error: 'De bestandsinhoud komt niet overeen met het opgegeven bestandstype.' };
    });
  }

  function validateProgram(program) {
    const errors = [];
    if (!program || typeof program !== 'object' || Array.isArray(program)) return { ok: false, errors: ['Programma moet een object zijn.'] };
    if (typeof program.id !== 'string' || !program.id.trim()) errors.push('Programma-id ontbreekt.');
    if (!PEOPLE.includes(program.person)) errors.push('Profiel is ongeldig.');
    if (!DISCIPLINES.includes(program.discipline)) errors.push('Discipline is ongeldig.');
    if (typeof program.goal !== 'string' || !program.goal.trim()) errors.push('Doel ontbreekt.');
    if (!Array.isArray(program.weeks) || program.weeks.length < 1 || program.weeks.length > 52) errors.push('Programma moet 1–52 weken bevatten.');
    (Array.isArray(program.weeks) ? program.weeks : []).forEach((week, weekIndex) => {
      if (!Array.isArray(week.sessions) || week.sessions.length > 14) errors.push(`Week ${weekIndex + 1} heeft geen geldige sessielijst.`);
      (Array.isArray(week.sessions) ? week.sessions : []).forEach((session, sessionIndex) => {
        if (!session || typeof session.title !== 'string' || !session.title.trim()) errors.push(`Sessie ${sessionIndex + 1} in week ${weekIndex + 1} mist een titel.`);
        if (!Number.isFinite(Number(session?.durationMinutes)) || Number(session.durationMinutes) < 1 || Number(session.durationMinutes) > 600) errors.push(`Sessie ${sessionIndex + 1} in week ${weekIndex + 1} heeft een ongeldige duur.`);
        if (!Array.isArray(session?.exercises)) errors.push(`Sessie ${sessionIndex + 1} in week ${weekIndex + 1} mist de oefeningenlijst.`);
      });
    });
    return { ok: errors.length === 0, errors };
  }

  function statistics(person, state = {}) {
    const sessions = (state.sessions || []).filter(item => item.person === person);
    const completed = sessions.filter(item => item.completed);
    const minutes = completed.reduce((sum, item) => sum + number(item.durationMinutes), 0);
    const programs = (state.programs || []).filter(item => item.person === person);
    const active = programs.filter(item => item.status === 'active');
    const records = new Map();
    completed.forEach(session => (session.exercises || []).forEach(exercise => (exercise.sets || []).forEach(set => {
      const weight = number(set.weight);
      if (set.completed && weight > (records.get(exercise.name) || 0)) records.set(exercise.name, weight);
    })));
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weekly = Array.from({ length: 6 }, (_, index) => {
      const start = new Date(monday);
      start.setDate(start.getDate() - (5 - index) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const rows = completed.filter(item => {
        const date = new Date(`${String(item.date || '').slice(0, 10)}T12:00:00`);
        return Number.isFinite(date.getTime()) && date >= start && date < end;
      });
      return {
        start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
        count: rows.length,
        minutes: rows.reduce((sum, item) => sum + number(item.durationMinutes), 0)
      };
    });
    return {
      completedSessions: completed.length,
      missedSessions: sessions.filter(item => !item.completed).length,
      trainingMinutes: minutes,
      activePrograms: active.length,
      completedPrograms: programs.filter(item => item.status === 'completed').length,
      goals: [...new Set(programs.map(item => item.goal).filter(Boolean))],
      records: [...records.entries()].map(([exercise, weight]) => ({ exercise, weight })),
      weekly
    };
  }

  function assess(profile, request, sessions = []) {
    const p = profile || emptyProfile('');
    const r = request || {};
    const blockers = [];
    if (!p.name || !String(p.currentActivity || '').trim()) blockers.push('Vul de huidige activiteit in het sportprofiel in.');
    if (!number(p.availableWeeklyMinutes)) blockers.push('Vul eerst de beschikbare trainingstijd per week in.');
    if (String(p.limitations || '').trim()) blockers.push('Er zijn fysieke aandachtspunten ingevuld. Laat de belasting eerst beoordelen door een bevoegde professional; het systeem kan deze aandachtspunten niet veilig interpreteren.');
    if (!DISCIPLINES.includes(r.discipline)) blockers.push('Kies een geldige sportdiscipline.');
    if (!String(r.goal || '').trim()) blockers.push('Vul het gewenste resultaat in.');
    if (r.discipline === 'cardio' && r.cardioFocus === 'hiit' && !['advanced', 'experienced'].includes(p.level)) blockers.push('HIIT is hier alleen beschikbaar voor een gevorderd of ervaren profiel; kies aerobe basis of gecontroleerde intervallen.');
    const now = Date.now();
    const recent = sessions.filter(x => {
      const date = Date.parse(x.date || '');
      return x.person === p.name && x.completed && x.discipline === r.discipline && Number.isFinite(date) && date <= now && now - date <= 28 * 86400000;
    });
    const recentHealthReports = sessions.filter(x => {
      const date = Date.parse(x.date || '');
      return x.person === p.name && x.completed && ['airway', 'severe'].includes(x.symptomType) && Number.isFinite(date) && date <= now && now - date <= 28 * 86400000;
    });
    const recentSevereReports = recentHealthReports.filter(session => session.symptomType === 'severe');
    if (recentSevereReports.length) blockers.push('Er is recent ernstige benauwdheid of een alarmsymptoom gemeld. Maak geen nieuw trainingsvoorstel voordat je dit met een arts/behandelaar hebt besproken; bij klachten die nu optreden, stop en zoek passende medische hulp.');
    const recentMinutes = recent.reduce((sum, x) => sum + number(x.durationMinutes), 0);
    const baselineWeeklyMinutes = recent.length ? recentMinutes / 4 : number(p.currentWeeklyMinutes);
    const requestedFrequency = Math.round(bounded(r.sessionsPerWeek, 1, 7));
    const levelCaps = { beginner: 3, recreational: 4, advanced: 5, experienced: 6 };
    const startingWeeklyMinutes = Math.min(number(p.availableWeeklyMinutes), baselineWeeklyMinutes > 0 ? baselineWeeklyMinutes : 40);
    const timeCap = Math.floor(startingWeeklyMinutes / 20);
    const runningProgressionCap = r.discipline === 'running' && number(p.runningSessionsPerWeek) > 0
      ? Math.min(4, Math.max(2, number(p.runningSessionsPerWeek) + 1))
      : 4;
    const disciplineCap = r.discipline === 'plyometrics' ? 2 : r.discipline === 'running' ? runningProgressionCap : 7;
    const availableDays = Array.isArray(p.availableDays) && p.availableDays.length ? p.availableDays.length : 7;
    const frequency = Math.max(1, Math.min(requestedFrequency, levelCaps[p.level] || 3, Math.max(1, timeCap), disciplineCap, availableDays));
    const weeks = Math.round(bounded(r.weeks, 4, 24));
    const minutesPerSession = Math.min(
      Math.floor(startingWeeklyMinutes / frequency),
      number(p.minutesPerSession) > 0 ? number(p.minutesPerSession) : Number.POSITIVE_INFINITY
    );
    if (minutesPerSession < 20) blockers.push('Er is onvoldoende wekelijkse tijd voor zelfs korte, bruikbare sessies; pas de beschikbare tijd of frequentie aan.');
    const cautions = [];
    if (recent.length) cautions.push(`Gebaseerd op ${recent.length} geregistreerde trainingen in de afgelopen 28 dagen (${Math.round(baselineWeeklyMinutes)} min/week).`);
    else cautions.push(`Gebaseerd op de zelf opgegeven huidige belasting (${Math.round(baselineWeeklyMinutes)} min/week); er zijn geen recente trainingslogs.`);
    if (frequency < requestedFrequency) cautions.push(`De gevraagde frequentie is teruggebracht van ${requestedFrequency} naar ${frequency} sessies per week op basis van niveau en beschikbare tijd.`);
    if (frequency < requestedFrequency && availableDays < requestedFrequency) cautions.push(`De frequentie houdt rekening met ${availableDays} beschikbare trainingsdag(en) per week.`);
    if (String(p.recoveryNeeds || '').trim()) cautions.push(`Herstelvoorkeur meegenomen: ${String(p.recoveryNeeds).trim()}.`);
    if (String(p.preferences || '').trim()) cautions.push(`Voorkeuren: ${String(p.preferences).trim()}.`);
    if (p.avoidedExercises?.length) cautions.push(`Oefeningen op de zelf opgegeven vermijdlijst zijn uitgesloten: ${p.avoidedExercises.join(', ')}.`);
    if (p.preferredExercises?.length) cautions.push(`Voorkeuroefeningen zijn meegenomen waar ze in de oefenendatabase beschikbaar zijn: ${p.preferredExercises.join(', ')}.`);
    if (String(p.availableEquipment || '').trim()) cautions.push(`Beschikbaar materiaal: ${String(p.availableEquipment).trim()}.`);
    const health = p.health || emptyProfile('').health;
    const reported = key => String(health[key] || '').trim();
    const healthConcern = ['concern', 'unsure'].includes(health.symptomControl)
      || reported('symptomsDuringExercise') || reported('symptomsAfterExercise') || recentHealthReports.length > 0;
    if (health.asthmaStatus === 'yes') cautions.push('Je hebt zelf aangegeven astma te hebben. Dit profiel sluit geen sport of trainingsvorm automatisch uit; houd je eigen belastbaarheid en eventuele behandelaarsafspraken aan.');
    if (reported('symptomsDuringExercise') || reported('symptomsAfterExercise')) cautions.push('Er zijn klachten tijdens/na inspanning ingevuld. De generator stelt geen diagnose en kan klachten niet beoordelen; bespreek terugkerende, toenemende of onvoldoende gecontroleerde klachten met je arts/behandelaar.');
    if (['concern', 'unsure'].includes(health.symptomControl)) cautions.push('Je hebt aangegeven dat klachten onvoldoende onder controle zijn of dat niet zeker te weten. Bespreek dit met je arts/behandelaar voordat je trainingsbelasting verhoogt.');
    if (recentHealthReports.length) cautions.push('Recente trainingsfeedback bevat zelfgerapporteerde luchtwegklachten. De opbouw blijft rustig; bespreek terugkerende of toenemende klachten met je arts/behandelaar.');
    if (recentHealthReports.some(session => session.symptomType === 'severe')) cautions.push('Recente trainingsfeedback bevat een melding van ernstige benauwdheid of een alarmsymptoom. Bij klachten die nu optreden: stop direct en zoek passende medische hulp.');
    if (health.triggers.trim()) cautions.push('Zelf opgegeven inspanningstriggers zijn meegenomen bij de praktische trainingskeuzes.');
    if (health.environment.trim()) cautions.push('Zelf opgegeven omgevingsfactoren zijn meegenomen als aandachtspunt; omstandigheden zijn niet automatisch gemeten.');
    if (r.discipline === 'running') cautions.push(`Loopcontext: ${number(p.runningCurrentKm)} km/week, langste recente loop ${number(p.runningLongestRunKm)} km, ${number(p.runningSessionsPerWeek)} looptrainingen/week, tempo ${p.runningPace || 'niet opgegeven'}, hartslag ${p.heartRate || 'niet opgegeven'}.`);
    return {
      person: p.name, level: p.level, goal: String(r.goal || '').trim(), discipline: r.discipline,
      weeks, requestedFrequency, frequency, availableWeeklyMinutes: number(p.availableWeeklyMinutes),
      minutesPerSession, startingWeeklyMinutes, baselineWeeklyMinutes, currentActivity: p.currentActivity,
      recentSessionCount: recent.length, periodization: PERIODIZATIONS.includes(r.periodization) ? r.periodization : 'linear',
      strengthGoal: ['hypertrophy', 'max-strength', 'endurance'].includes(r.strengthGoal) ? r.strengthGoal : 'hypertrophy',
      strengthSplit: ['full-body', 'upper-lower', 'push-pull-legs'].includes(r.strengthSplit) ? r.strengthSplit : 'full-body',
      runningFocus: ['balanced', 'easy', 'interval', 'tempo', 'heart-rate'].includes(r.runningFocus) ? r.runningFocus : 'balanced',
      cardioFocus: ['aerobic', 'interval', 'hiit', 'combined'].includes(r.cardioFocus) ? r.cardioFocus : 'aerobic',
      jumpFocus: ['landing', 'vertical', 'horizontal', 'reactive'].includes(r.jumpFocus) ? r.jumpFocus : 'landing',
      targetDistanceKm: bounded(r.targetDistanceKm, 0, 100),
      profileContext: {
        trainingYears: number(p.trainingYears), sportBackground: p.sportBackground,
        previousExperience: p.previousExperience, previousPrograms: p.previousPrograms,
        personalRecords: p.personalRecords, strengthExperience: p.strengthExperience,
        runningExperience: p.runningExperience, groupClassExperience: p.groupClassExperience,
        availableEquipment: p.availableEquipment, runningCurrentKm: number(p.runningCurrentKm),
        runningLongestRunKm: number(p.runningLongestRunKm), runningPace: p.runningPace,
        runningSessionsPerWeek: number(p.runningSessionsPerWeek), heartRate: p.heartRate,
        goals: p.goals, availableDays: p.availableDays, minutesPerSession: number(p.minutesPerSession),
        preferredExercises: p.preferredExercises, avoidedExercises: p.avoidedExercises
      },
      healthContext: {
        asthmaReported: health.asthmaStatus === 'yes',
        hasTriggers: Boolean(reported('triggers')),
        hasEnvironment: Boolean(reported('environment')),
        hasSymptoms: Boolean(reported('symptomsDuringExercise') || reported('symptomsAfterExercise')),
        hasPersonalAttention: Boolean(reported('attention')),
        hasRecoveryExperience: Boolean(reported('recoveryExperience')),
        controlConcern: ['concern', 'unsure'].includes(health.symptomControl),
        healthConcern: Boolean(healthConcern),
        recentAirwayReports: recentHealthReports.length,
        recentSevereReports: recentSevereReports.length
      },
      healthConcern: Boolean(healthConcern),
      blockers, cautions, requiresReview: false
    };
  }

  function periodizationLabel(value) {
    return ({ linear: 'Lineair', undulating: 'Undulating', block: 'Blokperiodisering' })[value] || 'Lineair';
  }

  function strengthPrescription(week, deload, periodization, index, strengthGoal) {
    const mainSets = deload ? 2 : (periodization === 'linear' && week > 1 ? 4 : 3);
    const ranges = { hypertrophy: '6–12', 'max-strength': '3–6', endurance: '12–20' };
    const reps = periodization === 'undulating' && index % 2 ? '6–8' : ranges[strengthGoal] || '6–12';
    const intensity = deload ? 'RPE 5–6, ruim van falen' : week <= 2 ? 'RPE 6–7, techniek voorop' : 'RPE 7–8, houd 2–3 herhalingen over';
    return { sets: mainSets, reps, restSeconds: 90, intensity };
  }

  function sessionTemplate(discipline, index, frequency, week, analysis, profile, exerciseLibrary) {
    const deload = week % 4 === 0;
    const duration = Math.max(20, Math.min(analysis.minutesPerSession, discipline === 'running' && index === frequency - 1 ? Math.round(analysis.minutesPerSession * 1.15) : analysis.minutesPerSession));
    const avoided = new Set((profile.avoidedExercises || []).map(value => String(value).toLocaleLowerCase('nl-NL')));
    const preferred = new Set((profile.preferredExercises || []).map(value => String(value).toLocaleLowerCase('nl-NL')));
    const library = exerciseLibrary
      .filter(item => item.discipline === discipline && !avoided.has(String(item.name || '').toLocaleLowerCase('nl-NL')))
      .sort((left, right) => Number(preferred.has(right.name.toLocaleLowerCase('nl-NL'))) - Number(preferred.has(left.name.toLocaleLowerCase('nl-NL'))))
      .slice(0, 3).map(item => item.name);
    if (discipline === 'running') {
      const quality = frequency >= 3 && index === 1 && week >= 5 && !deload && !analysis.healthConcern && analysis.runningFocus !== 'easy' && analysis.runningFocus !== 'heart-rate';
      const qualityType = analysis.runningFocus === 'tempo' ? 'Tempotraining' : analysis.runningFocus === 'interval' ? 'Gecontroleerd interval' : week % 2 ? 'Gecontroleerd interval' : 'Tempotraining';
      const type = quality ? qualityType : index === frequency - 1 ? 'Rustige duurloop' : 'Rustige duurloop / run-walk';
      const heartRateGuide = String(profile.heartRate || '').trim() ? ' Gebruik uitsluitend je eigen betrouwbaar vastgestelde hartslagzones; er zijn geen zones berekend.' : '';
      const qualityDetails = type === 'Tempotraining'
        ? 'Warming-up 10 min rustig, 10–15 min gelijkmatig stevig maar beheerst, cooling-down 5–10 min.'
        : 'Warming-up 10 min rustig, 4–6 × 2 min vlot met 2 min rustig herstel, cooling-down 5–10 min.';
      const currentWeeklyKm = number(profile.runningCurrentKm);
      const longestRun = number(profile.runningLongestRunKm) || currentWeeklyKm / Math.max(1, number(profile.runningSessionsPerWeek) || frequency);
      const boundedLongestRun = currentWeeklyKm > 0 ? Math.min(longestRun, currentWeeklyKm) : longestRun;
      const easyRun = Math.max(0, currentWeeklyKm - boundedLongestRun) / Math.max(1, frequency - 1);
      const estimatedDistance = index === frequency - 1 ? boundedLongestRun : easyRun;
      return { title: type, durationMinutes: duration, volume: `${duration} min`, intensity: quality ? 'RPE 6–7; beheerst, geen maximale inspanning' : 'RPE 3–4; praten moet mogelijk blijven', details: (quality ? qualityDetails : 'Rustig tempo. Begin zo nodig met afwisselend wandelen en joggen; verhoog niet tegelijk afstand én snelheid.') + heartRateGuide, rest: 'Plan minimaal één rustdag tussen intensieve looptrainingen.', targetDistanceKm: estimatedDistance ? Math.round(estimatedDistance * 10) / 10 : 0, exercises: library };
    }
    if (discipline === 'strength') {
      const prescription = strengthPrescription(week, deload, analysis.periodization, index, analysis.strengthGoal);
      const split = analysis.strengthSplit === 'push-pull-legs'
        ? ['Push', 'Pull', 'Legs'][index % 3]
        : analysis.strengthSplit === 'upper-lower'
          ? index % 2 ? 'Upper body' : 'Lower body'
          : 'Full body';
      const defaultExercises = split === 'Full body' ? ['Squatvariant', 'Duwbeweging', 'Trekbeweging', 'Heupstrekking'] : split === 'Upper body' || split === 'Push' || split === 'Pull' ? ['Duwbeweging', 'Trekbeweging', 'Schouderbeweging'] : ['Squatvariant', 'Heupstrekking', 'Unilaterale beenoefening'];
      const availableDefaults = defaultExercises.filter(name => !avoided.has(name.toLocaleLowerCase('nl-NL')));
      const chosenExercises = library.length ? library : availableDefaults;
      return { title: `${split} · sessie ${index + 1}`, durationMinutes: duration, volume: `${prescription.sets} sets per hoofdbeweging`, intensity: prescription.intensity, details: `Kies 3–4 passende bewegingen (${chosenExercises.length ? chosenExercises.join(', ') : 'een zelfgekozen, niet-vermijden beweging'}). ${prescription.sets} sets × ${prescription.reps} herhalingen; ${prescription.restSeconds}–180 sec rust. Houd minimaal 48 uur tussen zware sessies voor dezelfde spiergroepen.`, rest: deload ? 'Herstelweek: ongeveer 30% minder sets, geen maximale pogingen.' : 'Stop bij klachten of verlies van techniek; verhoog pas gewicht wanneer alle herhalingen beheerst lukken.', sets: prescription.sets, reps: prescription.reps, restSeconds: prescription.restSeconds, exercises: chosenExercises };
    }
    if (discipline === 'plyometrics') {
      const focus = { landing: 'landingstechniek', vertical: 'verticale sprongkracht', horizontal: 'horizontale sprongkracht', reactive: 'reactieve kracht' }[analysis.jumpFocus];
      return { title: `${focus[0].toUpperCase()}${focus.slice(1)} · ${index + 1}`, durationMinutes: Math.min(duration, 35), volume: deload ? '2 × 3 rustige sprongen' : '2–3 × 3–5 kwalitatieve contacten', intensity: 'Submaximaal; volledige rust tussen herhalingen', details: `Dynamische warming-up en lage, gecontroleerde sprongen gericht op ${focus}. Oefen zachte, stabiele landingen; stop zodra spronghoogte, controle of landing verslechtert. Gebruik alleen oefeningen uit de bronnenbibliotheek of een deskundig aangeleverd programma.`, rest: 'Maximaal 2 sessies per week, met minimaal 48–72 uur ertussen.', exercises: library };
    }
    if (discipline === 'cardio') {
      const quality = frequency >= 2 && index === 1 && week >= 3 && !deload && !analysis.healthConcern && analysis.cardioFocus !== 'aerobic';
      const hiit = quality && analysis.cardioFocus === 'hiit';
      const title = analysis.cardioFocus === 'combined' ? 'Kracht + conditie' : hiit ? 'HIIT · gecontroleerde intervallen' : quality ? 'Aerobe intervallen' : 'Aerobe basis';
      const details = analysis.cardioFocus === 'combined'
        ? 'Kies 2–3 beheersbare krachtbewegingen, gevolgd door 8–12 min matige cardio. Houd de techniek goed en verlaag de totale belasting als herstel achterblijft.'
        : hiit
          ? 'Warming-up 10 min, 4 × 1 min stevig (RPE 7–8) met 2 min rustig herstel, cooling-down 8–10 min. Stop bij klachten; geen maximale sprintinspanningen.'
          : quality
            ? 'Warming-up 8–10 min, 4 × 3 min stevig met 2 min rustig herstel, cooling-down.'
            : 'Aaneengesloten rustig bewegen of opsplitsen in blokken; kies een low-impact optie die past bij voorkeur en materiaal.';
      return { title, durationMinutes: duration, volume: `${duration} min`, intensity: hiit ? 'RPE 7–8; korte hoge inspanning, niet maximaal' : quality ? 'RPE 6–7; gecontroleerde intervallen' : 'RPE 3–4; rustig gesprek mogelijk', details, rest: deload ? 'Herstelweek: verkort de totale duur met ongeveer 25%.' : 'Wissel intensieve dagen af met rust of lichte beweging.', exercises: library };
    }
    return { title: index === 0 ? 'Mobiliteit & bewegingsvoorbereiding' : 'Herstelroutine', durationMinutes: Math.min(duration, 30), volume: '2–3 rustige rondes', intensity: 'Comfortabel bereik; geen pijn forceren', details: '5 min rustig opwarmen, daarna dynamische bewegingen en gecontroleerde mobiliteit. Statische stretches alleen comfortabel en zonder te veren; focus op de eigen voorkeur en bewegingsvoorbereiding.', rest: 'Hersteltraining blijft licht en vervangt geen medische behandeling.', exercises: library };
  }

  function generateProgram(profile, request, sessions = [], sources = [], exercises = []) {
    const analysis = assess(profile, request, sessions);
    if (analysis.blockers.length) return { ok: false, analysis };
    const p = profile;
    const availableDays = Array.isArray(p.availableDays) && p.availableDays.length ? p.availableDays : [];
    const trainingDays = Array.from({ length: analysis.frequency }, (_, index) => ({ day: availableDays[index] || index + 1 }));
    const weeks = Array.from({ length: analysis.weeks }, (_, index) => {
      const week = index + 1, recovery = week % 4 === 0;
      const currentDays = trainingDays.map((template, sessionIndex) => {
        const plan = sessionTemplate(analysis.discipline, sessionIndex, analysis.frequency, week, analysis, p, exercises);
        const growth = (analysis.discipline === 'running' || analysis.discipline === 'cardio') && !analysis.healthConcern
          ? Math.min(Math.floor((week - 1) / 4) * 0.05 + ((week - 1) % 4) * 0.02, 0.15)
          : 0;
        const progression = recovery ? (1 + Math.min(Math.floor((week - 1) / 4) * 0.05 + 0.06, 0.15)) * 0.75 : 1 + growth;
        let targetDistanceKm = plan.targetDistanceKm ? Math.round(plan.targetDistanceKm * progression * 10) / 10 : 0;
        if (analysis.discipline === 'running' && sessionIndex === analysis.frequency - 1) {
          const currentWeeklyKm = number(p.runningCurrentKm);
          const longestRun = number(p.runningLongestRunKm) || (currentWeeklyKm / Math.max(1, number(p.runningSessionsPerWeek) || analysis.frequency));
          const startingLongRun = currentWeeklyKm > 0 ? Math.min(longestRun, currentWeeklyKm) : longestRun;
          if (startingLongRun > 0) {
            const buildWeeks = week - 1 - Math.floor((week - 1) / 4);
            const step = Math.max(0.2, startingLongRun * 0.05);
            targetDistanceKm = Math.round(Math.min(analysis.targetDistanceKm || Infinity, startingLongRun + buildWeeks * step) * (recovery ? 0.75 : 1) * 10) / 10;
          }
        }
        const warmup = analysis.healthContext.asthmaReported || analysis.healthContext.hasTriggers || analysis.healthContext.hasEnvironment || analysis.healthConcern
          ? 'Geleidelijke warming-up: begin 10–15 min zeer rustig en verhoog stap voor stap. '
          : 'Warming-up: begin 5–10 min rustig en bereid de beweging geleidelijk voor. ';
        const cooldown = 'Cooling-down: verlaag de inspanning geleidelijk gedurende 5–10 min.';
        const environmentNote = analysis.healthContext.hasEnvironment || analysis.healthContext.hasTriggers
            ? ' Beoordeel zelf je opgegeven triggers en de actuele omstandigheden; die worden niet live gemeten.'
          : '';
        const symptomNote = analysis.healthConcern
          ? ' Je hebt inspanningsklachten of onzekerheid over de controle gemeld; houd dit voorstel rustig, verhoog de belasting niet en bespreek aanhoudende of onvoldoende gecontroleerde klachten met je arts/behandelaar.'
          : '';
        return {
          ...plan, day: template.day,
          exerciseIds: exercises.filter(item => item.discipline === analysis.discipline && plan.exercises.includes(item.name)).map(item => item.id),
          details: `${warmup}${plan.details} ${cooldown}${environmentNote}${symptomNote}`,
          durationMinutes: Math.max(15, Math.round(plan.durationMinutes * progression)), targetDistanceKm
        };
      });
      const phase = recovery ? 'Herstel en evaluatie' : analysis.periodization === 'block' ? ['Basis', 'Opbouw', 'Specificiteit'][Math.min(2, Math.floor((week - 1) / Math.max(1, Math.ceil(analysis.weeks / 3))))] : analysis.periodization === 'undulating' ? 'Afwisselende trainingsprikkel' : 'Geleidelijke opbouw';
      return {
        week, phase, goal: recovery ? 'Herstel, techniek en evaluatie; verlaag de totale belasting.' : `Werk aan ${analysis.goal.toLowerCase()} met beheersbare belasting.${analysis.discipline === 'running' && analysis.targetDistanceKm ? ` Doelafstand ${analysis.targetDistanceKm} km; als veilig opbouwen meer tijd vraagt, schuift het doel voorbij deze programmaperiode.` : ''}`,
        frequency: currentDays.length, volume: currentDays.reduce((sum, day) => sum + day.durationMinutes, 0),
        intensity: recovery ? 'Laag tot matig; RPE 3–5' : 'Afgestemd per sessie; geen maximale inspanning nodig',
        recovery: recovery ? 'Herstelweek; extra rust en feedback registreren.' : 'Plan minimaal één rustdag per week; houd zware sessies gescheiden.',
        progress: analysis.discipline === 'strength' ? recovery ? 'Herstelweek: ongeveer 30% minder sets; techniek en herstel centraal.' : 'Voeg alleen een herhaling of klein beetje gewicht toe als de vorige sessies beheerst waren.' : recovery ? 'Herstelweek: totale duur ongeveer 25% lager dan de voorafgaande opbouw.' : 'Progressieve duur-/afstandsstap van circa 2% per opbouwweek, met een voorzichtige bovengrens; dit is een praktische keuze, geen universele regel.',
        evaluation: week % 2 === 0 || recovery ? 'Evalueer RPE, herstel, gemiste sessies en eventuele klachten vóór verdere opbouw.' : '',
        sessions: currentDays
      };
    });
    const selectedSources = sources.filter(source => (request.sourceIds || []).includes(source.id));
    const timestamp = new Date().toISOString();
    return {
      ok: true,
      analysis,
      program: {
        id: makeId('program'), person: p.name, discipline: analysis.discipline,
        goal: analysis.goal, weeksCount: analysis.weeks, periodization: analysis.periodization,
        periodizationLabel: periodizationLabel(analysis.periodization), createdAt: timestamp,
        status: 'draft', version: 1, sourceIds: selectedSources.map(source => source.id),
        analysis, weeks,
        evidence: [
          { type: 'well-supported', label: 'Sterk onderbouwd algemeen principe', text: 'Geleidelijke trainingsopbouw, voldoende herstel en het afstemmen van belasting op de persoon zijn breed gedragen principes; er is geen universeel optimale dosis.' },
          { type: 'reasonable', label: 'Redelijk onderbouwd trainingsprincipe', text: 'Periodisering, progressieve overload en het afwisselen van trainingsprikkels kunnen structuur geven; de beste methode hangt af van doel en sporter.' },
          { type: 'practical', label: 'Praktische keuze / onzekerheid', text: 'De exacte sessies, frequentie en progressie zijn keuzes op basis van ingevoerde gegevens, geen persoonlijk gevalideerd effect. Toets ze aan herstel en feedback.' }
        ],
        sourceSnapshot: selectedSources.map(({ id, type, title, authors, year, doi, url, finding, relevance }) => ({ id, type, title, authors, year, doi, url, finding, relevance }))
      }
    };
  }

  function evaluateProgram(program, sessions = []) {
    const logs = sessions.filter(session => session.programId === program.id);
    const completed = logs.filter(session => session.completed);
    const rpeLogs = completed.filter(session => number(session.rpe) > 0);
    const averageRpe = rpeLogs.length ? rpeLogs.reduce((sum, session) => sum + number(session.rpe), 0) / rpeLogs.length : 0;
    const averageMinutes = completed.length ? completed.reduce((sum, session) => sum + number(session.durationMinutes), 0) / completed.length : 0;
    const recoveryConcern = completed.some(session => /slecht|onvoldoende|pijn/i.test(session.recovery || ''));
    const airwayReports = completed.filter(session => session.symptomType === 'airway' || session.symptomType === 'severe');
    const severeReports = completed.filter(session => session.symptomType === 'severe');
    const suggestions = [];
    if (!logs.length) suggestions.push('Registreer eerst enkele trainingen en herstelervaringen; er is nog onvoldoende informatie om belasting bij te sturen.');
    else if (severeReports.length) suggestions.push('Er is ernstige benauwdheid of een alarmsymptoom geregistreerd. Stop bij klachten direct; als dit nu gebeurt of aanhoudt, zoek passende medische hulp. Bespreek de ervaring met je arts/behandelaar voordat je trainingsbelasting verhoogt.');
    else if (airwayReports.length) suggestions.push('Er zijn luchtwegklachten geregistreerd; luchtwegklachten zijn niet hetzelfde als normale inspanningsvermoeidheid. Pas niet automatisch een diagnose toe; bespreek terugkerende klachten met je arts/behandelaar en verhoog de trainingsbelasting niet totdat je dit hebt besproken.');
    else if (averageRpe >= 8 || recoveryConcern) suggestions.push('De ervaren inspanning of het herstel vraagt aandacht. Overweeg minder volume/intensiteit en extra rust; laat aanhoudende klachten beoordelen door een professional.');
    else if (logs.length >= 4 && completed.length / logs.length < 0.7) suggestions.push('Minder dan 70% van de gelogde sessies is afgerond. Overweeg een lagere frequentie of kortere sessies voordat je opbouwt.');
    else if (logs.length >= 4 && averageRpe > 0 && averageRpe <= 5 && completed.length === logs.length) suggestions.push('Alle geregistreerde sessies zijn afgerond met lage ervaren inspanning. Een kleine progressie kan worden overwogen als herstel goed blijft.');
    else suggestions.push('De beschikbare gegevens geven geen duidelijke reden om het programma aan te passen. Blijf herstel en feedback volgen.');
    return { logged: logs.length, completed: completed.length, averageRpe: Number(averageRpe.toFixed(1)), averageMinutes: Math.round(averageMinutes), recoveryConcern, healthConcern: airwayReports.length > 0, airwayReports: airwayReports.length, severeReports: severeReports.length, suggestions };
  }

  function proposeAdjustment(program, evaluation) {
    const copy = JSON.parse(JSON.stringify(program));
    copy.id = makeId('program');
    copy.createdAt = new Date().toISOString();
    copy.status = 'draft';
    copy.version = number(program.version, 1) + 1;
    copy.previousProgramId = program.id;
    copy.adjustmentNote = evaluation.suggestions.join(' ');
    if (evaluation.averageRpe >= 8 || evaluation.recoveryConcern || evaluation.healthConcern || (evaluation.logged >= 4 && evaluation.completed / evaluation.logged < 0.7)) {
      copy.weeks = copy.weeks.map(week => ({
        ...week,
        volume: Math.round(week.volume * 0.8),
        sessions: week.sessions.map(session => ({ ...session, durationMinutes: Math.round(session.durationMinutes * 0.8), intensity: 'Licht tot matig; herstel eerst beoordelen' }))
      }));
      copy.analysis = { ...copy.analysis, cautions: [...(copy.analysis.cautions || []), 'Voorstel: circa 20% minder sessieduur. Dit concept wijzigt het bestaande programma niet.'] };
    }
    return copy;
  }

  return {
    PEOPLE, DISCIPLINES, LEVELS, PERIODIZATIONS, ASTHMA_STATUSES, SYMPTOM_CONTROLS,
    SESSION_SYMPTOMS, LIBRARY_CATEGORIES, emptyProfile, normalize, normalizeExercise,
    exerciseKey, upsertExercise, searchLibrary, validateUpload, validateProgram,
    statistics, assess, generateProgram, evaluateProgram, proposeAdjustment, makeId
  };
});

(() => {
  'use strict';

  const coach = window.SamenThuisSportCoach;
  if (!coach || typeof data === 'undefined' || typeof render !== 'function') return;

  const labels = {
    running: 'Hardlopen', strength: 'Krachttraining', plyometrics: 'Explosiviteit & sprongkracht',
    cardio: 'Conditie & cardio', mobility: 'Mobiliteit & herstel'
  };
  const levelLabels = { beginner: 'Beginner', recreational: 'Recreatieve sporter', advanced: 'Gevorderd', experienced: 'Ervaren sporter' };
  const sourceLabels = { scientific: 'Wetenschappelijk', commercial: 'Commercieel programma', book: 'Trainingsboek', website: 'Sportwetenschappelijke website', personal: 'Persoonlijke notitie / eigen programma' };
  const asthmaLabels = { yes: 'Ja', no: 'Nee', unknown: 'Onbekend', 'prefer-not': 'Liever niet invullen' };
  const controlLabels = { none: 'Geen klachten / niet van toepassing', concern: 'Klachten onvoldoende onder controle (zelf ingeschat)', unsure: 'Niet zeker', 'prefer-not': 'Liever niet invullen' };
  const symptomLabels = { none: 'Geen luchtwegklachten', fatigue: 'Normale inspanningsvermoeidheid', airway: 'Luchtwegklachten', severe: 'Ernstige benauwdheid / alarmsymptoom' };
  const libraryFilter = { query: '', category: '', tag: '', sort: 'newest', view: 'cards' };
  let pendingProgram = null;
  const restTimers = new Map();
  const escCoach = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const coachState = () => {
    data.sportCoach = coach.normalize(data.sportCoach);
    data.sportCoach.evaluations = Array.isArray(data.sportCoach.evaluations) ? data.sportCoach.evaluations : [];
    return data.sportCoach;
  };
  const id = prefix => coach.makeId(prefix);
  const accountUserId = () => {
    const sync = window.SamenThuisAccountSync;
    const userId = window.SamenThuisAuth25?.session()?.user?.id || '';
    return sync?.active?.() && userId ? String(userId) : '';
  };
  const canManageProfile = (person, state = coachState()) => {
    const uid = accountUserId();
    if (!uid) return true;
    const profile = state.profiles[person];
    if (profile.userId) return profile.userId === uid;
    return !Object.values(state.profiles).some(item => item.userId === uid);
  };
  const isSafeUrl = value => {
    try { return new URL(String(value)).protocol === 'https:'; }
    catch { return false; }
  };
  const val = (value, type = 'text', attrs = '') => `<input type="${type}" value="${escCoach(value)}" ${attrs}>`;
  const field = (label, name, value, type = 'text', attrs = '') => `<label class="field"><span>${label}</span>${val(value, type, `name="${name}" ${attrs}`)}</label>`;
  const textArea = (label, name, value, attrs = '') => `<label class="field"><span>${label}</span><textarea name="${name}" ${attrs}>${escCoach(value)}</textarea></label>`;
  const select = (label, name, value, options, attrs = '') => `<label class="field"><span>${label}</span><select name="${name}" ${attrs}>${options.map(([option, title]) => `<option value="${escCoach(option)}" ${value === option ? 'selected' : ''}>${escCoach(title)}</option>`).join('')}</select></label>`;
  const options = entries => entries.map(([key, title]) => [key, title]);
  const allPrograms = () => coachState().programs.filter(program => canManageProfile(program.person)).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  function renderProfile(name, profile) {
    if (!canManageProfile(name)) {
      return `<section class="card sport-profile"><div class="card-head"><div><p class="eyebrow">Persoonlijk trainingsprofiel</p><h2>${escCoach(name)}</h2></div><span class="tag">${levelLabels[profile.level] || levelLabels.beginner}</span></div><p>Dit profiel is gekoppeld aan het andere huishoudaccount en is hier alleen-lezen. Jullie kunnen nog steeds de gedeelde sportbibliotheek bekijken.</p><p><strong>Doelen:</strong> ${escCoach(profile.goals.join(', ') || 'Nog niet ingevuld')}</p></section>`;
    }
    return `<section class="card sport-profile"><div class="card-head"><div><p class="eyebrow">Persoonlijk profiel</p><h2>${escCoach(name)}</h2></div><span class="tag">${levelLabels[profile.level] || levelLabels.beginner}</span></div>
      <form data-sport-profile="${escCoach(name)}" class="sport-form">
        <div class="sport-fields">
          ${select('Trainingsniveau', 'level', profile.level, options(Object.entries(levelLabels)))}
          ${field('Leeftijd (optioneel)', 'age', profile.age || '', 'number', 'min="13" max="110" step="1"')}
          ${field('Aantal jaren trainen', 'trainingYears', profile.trainingYears, 'number', 'min="0" max="80" step="1"')}
          ${field('Beschikbare minuten per week', 'availableWeeklyMinutes', profile.availableWeeklyMinutes, 'number', 'min="0" max="2000" step="5"')}
          ${field('Maximale minuten per training', 'minutesPerSession', profile.minutesPerSession, 'number', 'min="0" max="600" step="5"')}
          ${field('Huidige trainingsminuten per week', 'currentWeeklyMinutes', profile.currentWeeklyMinutes, 'number', 'min="0" max="2000" step="5"')}
          ${field('Trainingsdoelen (komma-gescheiden)', 'goals', profile.goals.join(', '), 'text', 'placeholder="kracht, conditie, mobiliteit"')}
          ${field('Beschikbare trainingsdagen (komma-gescheiden)', 'availableDays', profile.availableDays.join(', '), 'text', 'placeholder="maandag, woensdag, zaterdag"')}
          ${field('Huidige loopafstand (km/week)', 'runningCurrentKm', profile.runningCurrentKm, 'number', 'min="0" max="500" step="0.5"')}
          ${field('Langste recente loop (km)', 'runningLongestRunKm', profile.runningLongestRunKm, 'number', 'min="0" max="200" step="0.1"')}
          ${field('Looptrainingen per week', 'runningSessionsPerWeek', profile.runningSessionsPerWeek, 'number', 'min="0" max="14" step="1"')}
          ${field('Gebruikelijk looptempo', 'runningPace', profile.runningPace, 'text', 'placeholder="bijv. 6:30 min/km"')}
          ${field('Hartslaggegevens (optioneel)', 'heartRate', profile.heartRate, 'text', 'placeholder="bijv. zones of recente meting"')}
          ${textArea('Sportachtergrond', 'sportBackground', profile.sportBackground)}
          ${textArea('Eerdere sportervaring', 'previousExperience', profile.previousExperience)}
          ${textArea('Eerdere trainingsprogramma’s', 'previousPrograms', profile.previousPrograms)}
          ${textArea('Huidig activiteitenniveau', 'currentActivity', profile.currentActivity, 'required')}
          ${textArea('Ervaring met krachttraining', 'strengthExperience', profile.strengthExperience)}
          ${textArea('Ervaring met hardlopen', 'runningExperience', profile.runningExperience)}
          ${textArea('Ervaring met groepslessen', 'groupClassExperience', profile.groupClassExperience)}
          ${textArea('Persoonlijke records', 'personalRecords', profile.personalRecords)}
          ${textArea('Trainingsvoorkeuren', 'preferences', profile.preferences)}
          ${textArea('Voorkeursoefeningen', 'preferredExercises', profile.preferredExercises.join(', '))}
          ${textArea('Oefeningen vermijden', 'avoidedExercises', profile.avoidedExercises.join(', '))}
          ${textArea('Overige trainingsvoorkeuren', 'trainingPreferences', profile.trainingPreferences)}
          ${textArea('Herstelbehoefte', 'recoveryNeeds', profile.recoveryNeeds)}
          ${textArea('Beschikbare materialen / oefeningen', 'availableEquipment', profile.availableEquipment)}
          ${textArea('Fysieke beperkingen of aandachtspunten (vrijwillig)', 'limitations', profile.limitations, 'placeholder="Alleen invullen als je dit zelf wilt. Bij invoer maakt de generator geen schema, maar adviseert professionele beoordeling."')}
          <details class="sport-health" open>
            <summary>Optionele astma- en inspanningsinformatie</summary>
            <p class="sport-privacy">Gezondheidsinformatie is vrijwillig en wordt lokaal in deze browser opgeslagen. Zonder actieve, versleutelde accountsynchronisatie heeft de app geen afzonderlijke toegangsbeveiliging op dit apparaat. Met accountsynchronisatie is de huishouddata versleuteld en gedeeld met de twee bevoegde huishoudleden. Een JSON-back-up bevat deze informatie leesbaar; bewaar en deel die zorgvuldig. Er gaat geen gezondheids- of medicatie-informatie naar de AI-functie; medicatie wordt nooit gebruikt voor trainingskeuzes of doseringsadvies.</p>
            ${select('Astma (zelfrapportage)', 'health.asthmaStatus', profile.health.asthmaStatus, Object.entries(asthmaLabels))}
            ${textArea('Bekende inspanningstriggers', 'health.triggers', profile.health.triggers, 'placeholder="Optioneel, bijvoorbeeld langdurige of intensieve inspanning"')}
            ${textArea('Omgevingsfactoren', 'health.environment', profile.health.environment, 'placeholder="Optioneel, bijvoorbeeld koude lucht, pollen of stof"')}
            ${textArea('Zelfgerapporteerde klachten tijdens inspanning', 'health.symptomsDuringExercise', profile.health.symptomsDuringExercise)}
            ${textArea('Zelfgerapporteerde klachten na inspanning', 'health.symptomsAfterExercise', profile.health.symptomsAfterExercise)}
            ${select('Klachten / controle (eigen inschatting)', 'health.symptomControl', profile.health.symptomControl, Object.entries(controlLabels))}
            ${textArea('Persoonlijke inspanningsaandachtspunten', 'health.attention', profile.health.attention)}
            ${textArea('Herstelervaring', 'health.recoveryExperience', profile.health.recoveryExperience)}
            ${textArea('Medicatie-informatie (optioneel, alleen ter context)', 'health.medicationContext', profile.health.medicationContext, 'placeholder="Wordt niet gebruikt voor trainingsadvies. Geen medicatie- of doseringsadvies."')}
            <button type="button" class="secondary sport-clear-health" data-sport-clear-health="${escCoach(name)}">Verwijder gezondheidsinformatie van ${escCoach(name)}</button>
          </details>
        </div><button class="primary" type="submit">Profiel ${escCoach(name)} bewaren</button>
      </form></section>`;
  }

  function renderGenerator(state) {
    const sources = state.sources.filter(source => source.id && source.title);
    const people = coach.PEOPLE.filter(name => canManageProfile(name, state));
    return `<section class="card sport-generator"><div class="card-head"><div><p class="eyebrow">Persoonlijke analyse vóór het schema</p><h2>Nieuw trainingsprogramma</h2></div></div>
      <p>De lokale generator maakt een transparant trainingsvoorstel, maar is geen AI. Er is nog geen AI-provider geconfigureerd; er wordt geen werkende AI gesimuleerd. De analyse gebruikt niveau, huidige activiteit, recente logs, tijd, herstel, voorkeuren en materiaal. Optionele inspanningsinformatie kan de warming-up en voorzichtigheid beïnvloeden. Medicatie-informatie wordt nooit meegenomen. Bekijk vóór opslaan welke velden zijn gebruikt.</p>
      <form data-sport-generate class="sport-form"><div class="sport-fields">
        ${select('Voor wie?', 'person', people[0] || '', people.map(name => [name, name]))}
        ${select('Discipline', 'discipline', 'running', Object.entries(labels))}
        ${field('Gewenst resultaat', 'goal', '', 'text', 'required placeholder="bijv. rustig opbouwen naar 5 km"')}
        ${field('Loopdoelafstand in km (optioneel)', 'targetDistanceKm', '', 'number', 'min="0" max="100" step="0.1" placeholder="5, 10, 21.1 of 42.2"')}
        ${field('Programmaweken', 'weeks', 8, 'number', 'min="4" max="24" step="1"')}
        ${field('Gewenste sessies per week', 'sessionsPerWeek', 3, 'number', 'min="1" max="7" step="1"')}
        ${select('Periodisering', 'periodization', 'linear', [['linear', 'Lineair'], ['undulating', 'Undulating'], ['block', 'Blokperiodisering']])}
        ${select('Krachtfocus', 'strengthGoal', 'hypertrophy', [['hypertrophy', 'Hypertrofie / spieropbouw'], ['max-strength', 'Maximale kracht'], ['endurance', 'Krachtuithoudingsvermogen']])}
        ${select('Krachtsplit', 'strengthSplit', 'full-body', [['full-body', 'Full body'], ['upper-lower', 'Upper / lower'], ['push-pull-legs', 'Push / pull / legs']])}
        ${select('Hardloopaccent', 'runningFocus', 'balanced', [['balanced', 'Afwisselend'], ['easy', 'Rustig / herstel'], ['interval', 'Interval'], ['tempo', 'Tempotraining'], ['heart-rate', 'Hartslaggestuurd']])}
        ${select('Cardioaccent', 'cardioFocus', 'aerobic', [['aerobic', 'Aerobe basis'], ['interval', 'Interval'], ['hiit', 'HIIT'], ['combined', 'Combinatie kracht + cardio']])}
        ${select('Sprongaccent', 'jumpFocus', 'landing', [['landing', 'Landingstechniek'], ['vertical', 'Verticale sprong'], ['horizontal', 'Horizontale sprong'], ['reactive', 'Reactieve kracht']])}
        <label class="field sport-source-select"><span>Bronnen gebruiken (optioneel)</span><select name="sourceIds" multiple size="4">${sources.map(source => `<option value="${escCoach(source.id)}">${escCoach(source.title)} · ${escCoach(sourceLabels[source.type] || 'Bron')}</option>`).join('')}</select></label>
      </div><div class="button-row"><button class="primary" type="submit">Maak lokaal voorstel</button><button class="secondary" type="button" data-sport-ai-request>AI-configuratie controleren</button></div></form>
      <p class="small-note" data-sport-ai-status role="status">AI staat uit totdat een server-side provider veilig is geconfigureerd. Gezondheids- en medicatiegegevens worden niet naar de server gestuurd.</p>
      <div id="sportAnalysis" aria-live="polite"></div></section>`;
  }

  function renderEvaluation(program, result) {
    const latest = result || coachState().evaluations.find(item => item.programId === program.id);
    if (!latest) return '';
    const summary = latest.summary || latest;
    return `<div class="sport-evaluation"><strong>Evaluatie</strong><p>${summary.logged ? `${summary.completed} van ${summary.logged} geregistreerde sessies afgerond; gemiddelde RPE ${summary.averageRpe || 'niet ingevuld'}; gemiddelde duur ${summary.averageMinutes || 0} min.` : 'Nog geen trainingslogs beschikbaar.'}</p><ul>${(summary.suggestions || []).map(text => `<li>${escCoach(text)}</li>`).join('')}</ul>${summary.logged ? `<button class="secondary" data-sport-adjust="${escCoach(program.id)}">Maak apart aangepast concept</button>` : ''}</div>`;
  }

  function renderProgram(program) {
    const weeks = program.weeks || [];
    return `<article class="card sport-program"><div class="card-head"><div><p class="eyebrow">${escCoach(program.person)} · ${escCoach(labels[program.discipline] || 'Sport')}</p><h2>${escCoach(program.goal)}</h2></div><span class="tag ${program.status === 'draft' ? 'orange' : 'green'}">${program.status === 'draft' ? 'Concept' : 'Actief voorstel'} · v${Number(program.version) || 1}</span></div>
      ${program.adjustmentNote ? `<p class="sport-alert"><strong>Apart concept, geen automatische wijziging:</strong> ${escCoach(program.adjustmentNote)}</p>` : ''}
      <p>${program.weeksCount} weken · ${program.analysis.frequency} sessies/week · ${escCoach(program.periodizationLabel || program.periodization)}</p>
      <details class="sport-analysis"><summary>Analyse en gemaakte keuzes</summary><p><strong>Huidige basis:</strong> ${escCoach(program.analysis.currentActivity)} · ${Math.round(program.analysis.baselineWeeklyMinutes || 0)} min/week.</p><p><strong>Beschikbaar:</strong> ${program.analysis.availableWeeklyMinutes} min/week; startvolume ${Math.round(program.analysis.startingWeeklyMinutes || 0)} min/week; gekozen sessieduur circa ${program.analysis.minutesPerSession} min.</p><p><strong>Sportgeschiedenis:</strong> ${program.analysis.profileContext?.trainingYears || 0} jaar ervaring. ${escCoach(program.analysis.profileContext?.sportBackground || program.analysis.profileContext?.previousExperience || 'Geen aanvullende achtergrond ingevuld.')}</p><p><strong>Eerdere programma’s / records:</strong> ${escCoach([program.analysis.profileContext?.previousPrograms, program.analysis.profileContext?.personalRecords].filter(Boolean).join(' · ') || 'Niet ingevuld.')}</p><p><strong>Sportervaring:</strong> ${escCoach([program.analysis.profileContext?.strengthExperience, program.analysis.profileContext?.runningExperience, program.analysis.profileContext?.groupClassExperience].filter(Boolean).join(' · ') || 'Niet ingevuld.')}</p><p><strong>Optionele inspanningscontext gebruikt:</strong> ${program.analysis.healthContext?.asthmaReported ? 'astma zelfgerapporteerd' : 'astma niet als aanwezig opgegeven'}${program.analysis.healthContext?.hasTriggers ? ' · triggers opgegeven' : ''}${program.analysis.healthContext?.hasEnvironment ? ' · omgevingsfactoren opgegeven' : ''}${program.analysis.healthContext?.hasSymptoms ? ' · klachten opgegeven' : ''}${program.analysis.healthContext?.controlConcern ? ' · controle-aandachtspunt opgegeven' : ''}${program.analysis.healthContext?.recentAirwayReports ? ` · ${program.analysis.healthContext.recentAirwayReports} recente klachtenlog(s)` : ''}. Waarden blijven in het profiel; ze worden niet gekopieerd naar het programma. Medicatie-informatie is uitgesloten.</p>${(program.analysis.cautions || []).map(item => `<p>${escCoach(item)}</p>`).join('')}${(program.evidence || []).map(item => `<p><span class="tag">${escCoach(item.label)}</span> ${escCoach(item.text)}</p>`).join('')}
      ${(program.sourceSnapshot || []).length ? `<h4>Geselecteerde bronnen (niet automatisch geverifieerd)</h4><ul>${program.sourceSnapshot.map(source => `<li><strong>${escCoach(source.title)}</strong> · ${escCoach(sourceLabels[source.type] || 'Bron')}${source.authors ? ` · ${escCoach(source.authors)}` : ''}${source.year ? ` · ${escCoach(source.year)}` : ''}${source.doi ? ` · DOI ${escCoach(source.doi)}` : ''}${source.url && isSafeUrl(source.url) ? ` · <a href="${escCoach(source.url)}" target="_blank" rel="noopener noreferrer">originele link</a>` : ''}${source.finding ? `<br>${escCoach(source.finding)}` : ''}${source.relevance ? `<br>Relevantie: ${escCoach(source.relevance)}` : ''}</li>`).join('')}</ul>` : '<p>Geen externe onderzoeksbron geselecteerd; er worden geen citaties verzonnen.</p>'}</details>
      <div class="sport-week-list">${weeks.map((week, index) => `<details class="sport-week" ${index === 0 ? 'open' : ''}><summary>Week ${week.week} · ${escCoach(week.phase)} · ${week.frequency} sessies · ${week.volume} min</summary><p><strong>Doel:</strong> ${escCoach(week.goal)}</p><p><strong>Intensiteit:</strong> ${escCoach(week.intensity)} · <strong>Herstel:</strong> ${escCoach(week.recovery)}</p><p><strong>Progressie:</strong> ${escCoach(week.progress)}</p>${week.evaluation ? `<p><strong>Evaluatie:</strong> ${escCoach(week.evaluation)}</p>` : ''}<div class="sport-session-list">${week.sessions.map((session, sessionIndex) => `<div class="sport-session"><strong>${escCoach(session.title)}</strong><span>${session.durationMinutes} min${session.targetDistanceKm ? ` · ${session.targetDistanceKm} km geschat` : ''} · ${escCoach(session.volume || '')}</span><p>${escCoach(session.details)}</p><p>${escCoach(session.intensity)} · ${escCoach(session.rest)}</p>${session.sets ? `<small>${session.sets} sets × ${escCoach(session.reps)} herhalingen · ${session.restSeconds} sec rust</small>` : ''}${session.exercises?.length ? `<small>Oefeningen: ${session.exercises.map(escCoach).join(', ')}</small>` : ''}<div class="button-row"><button type="button" class="secondary" data-sport-start-session="${escCoach(program.id)}:${week.week}:${sessionIndex}">Training starten</button></div></div>`).join('')}</div></details>`).join('')}</div>
      <div class="button-row"><button class="secondary" data-sport-evaluate="${escCoach(program.id)}">Evalueer op basis van logs</button>${program.status === 'draft' ? `<button class="primary" data-sport-approve="${escCoach(program.id)}">Accepteer als apart programma</button>` : ''}${program.status === 'active' ? `<button class="secondary" data-sport-complete-program="${escCoach(program.id)}">Programma afronden</button>` : ''}${program.previousProgramId ? `<span class="muted">Afgeleid van een eerder programma; bestaande versie blijft ongewijzigd.</span>` : ''}</div>${renderEvaluation(program)}</article>`;
  }

  function renderStats(state) {
    return `<section class="grid two sport-stats">${coach.PEOPLE.filter(person => canManageProfile(person, state)).map(person => {
      const stats = coach.statistics(person, state);
      const maxMinutes = Math.max(1, ...stats.weekly.map(week => week.minutes));
      return `<article class="card"><p class="eyebrow">VOORTGANG · ${escCoach(person)}</p><h2>${stats.completedSessions} trainingen</h2><p>${stats.trainingMinutes} geregistreerde minuten · ${stats.missedSessions} gemist · ${stats.activePrograms} actieve voorstellen</p><p><strong>Doelen uit programma’s:</strong> ${escCoach(stats.goals.join(', ') || 'Geen programma’s; voortgang niet beschikbaar.')}</p><div class="sport-weekly-chart" role="img" aria-label="Geregistreerde trainingsminuten per week in de afgelopen zes weken">${stats.weekly.map(week => `<div class="sport-weekly-row"><span>${escCoach(week.start.slice(5))}</span><div class="sport-weekly-track"><span style="width:${Math.round(week.minutes / maxMinutes * 100)}%"></span></div><small>${week.minutes} min · ${week.count}×</small></div>`).join('')}</div>${stats.records.length ? `<p><strong>Geregistreerde records:</strong> ${stats.records.map(record => `${escCoach(record.exercise)} ${record.weight} kg`).join(' · ')}</p>` : '<p>Geen gewicht-records geregistreerd.</p>'}<p class="small-note">Alleen geregistreerde trainingen worden geteld; ontbrekende voortgang wordt niet geschat.</p></article>`;
    }).join('')}</section>`;
  }

  function sessionOptions(programs) {
    return programs.flatMap(program => (program.weeks || []).flatMap(week =>
      (week.sessions || []).map((session, index) => [
        `${program.id}:${week.week}:${index}`,
        `${program.person} · ${program.name || program.goal} · week ${week.week} · ${session.title}`
      ])
    ));
  }

  function renderPlanner(state) {
    const programs = allPrograms().filter(program => program.status === 'active');
    const options = sessionOptions(programs);
    const view = ['week', 'month', 'all'].includes(state.settings.plannerView) ? state.settings.plannerView : 'week';
    const today = new Date();
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    const plans = (state.plans || []).filter(plan => {
      if (!canManageProfile(plan.person, state)) return false;
      if (view === 'all') return true;
      const date = new Date(`${String(plan.date || '').slice(0, 10)}T12:00:00`);
      return view === 'week'
        ? date >= startOfWeek && date < endOfWeek
        : date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
    }).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return `<section class="card sport-planner"><div class="card-head"><div><p class="eyebrow">Week- en maandplanning</p><h2>Training plannen</h2></div></div>
      ${options.length ? `<form data-sport-plan class="sport-form"><div class="sport-fields">${select('Programmasessie', 'sessionRef', options[0][0], options)}${field('Datum', 'date', new Date().toISOString().slice(0, 10), 'date', 'required')}</div><button class="primary" type="submit">Op datum plannen</button></form>` : '<p>Accepteer eerst een voorstel als actief programma om sessies te plannen.</p>'}
      ${select('Planning bekijken', 'plannerView', view, [['week', 'Deze week'], ['month', 'Deze maand'], ['all', 'Alle datums']], 'data-sport-planner-view')}
      <div class="sport-plan-list">${plans.map(plan => `<article class="sport-plan ${escCoach(plan.status)}"><div><strong>${escCoach(plan.sessionTitle)}</strong><p>${escCoach(plan.person)} · ${escCoach(plan.date)} · ${plan.durationMinutes || 0} min · ${escCoach(plan.status)}</p></div>
        ${plan.status === 'planned' ? `<form data-sport-plan-edit="${escCoach(plan.id)}" class="sport-plan-move"><label class="field">Datum<input type="date" name="date" value="${escCoach(plan.date)}" required></label><button class="secondary" type="submit">Verplaatsen</button></form><div class="button-row"><button type="button" class="primary" data-sport-start-plan="${escCoach(plan.id)}">Start training</button><button type="button" class="secondary" data-sport-plan-duplicate="${escCoach(plan.id)}">Dupliceren</button><button type="button" class="secondary" data-sport-plan-skip="${escCoach(plan.id)}">Overslaan</button></div>` : ''}
      </article>`).join('') || '<p class="muted">Nog geen geplande trainingen.</p>'}</div></section>`;
  }

  function startWorkout(program, weekNumber, sessionIndex, planId = '') {
    const week = program?.weeks?.find(item => Number(item.week) === Number(weekNumber));
    const session = week?.sessions?.[Number(sessionIndex)];
    if (!session) throw new Error('De gekozen trainingssessie bestaat niet meer.');
    const names = session.exercises?.length ? session.exercises : [session.title];
    return {
      id: id('workout'), programId: program.id, person: program.person, discipline: program.discipline,
      week: Number(weekNumber), sessionIndex: Number(sessionIndex), sessionTitle: session.title,
      planId, date: new Date().toISOString(), startedAt: Date.now(), pausedAt: 0,
      pausedMilliseconds: 0, status: 'running', targetDurationMinutes: Number(session.durationMinutes) || 0,
      details: session.details || '', intensity: session.intensity || '', restAdvice: session.rest || '',
      exercises: names.map((name, index) => ({
        id: session.exerciseIds?.[index] || '',
        name, sets: Array.from({ length: Math.max(1, Number(session.sets) || 1) }, () => ({
          weight: '', reps: '', targetReps: session.reps || '', completed: false, restSeconds: Number(session.restSeconds) || 0
        }))
      })),
      notes: '', rpe: '', pace: '', heartRate: '', recovery: '', feedback: '',
      symptomType: 'none', symptomDetails: ''
    };
  }

  function renderWorkout(workout, state) {
    if (!workout) return '';
    const elapsed = Math.max(0, Math.floor(((workout.pausedAt || Date.now()) - workout.startedAt - (workout.pausedMilliseconds || 0)) / 60000));
    return `<section class="card sport-workout" data-workout-person="${escCoach(workout.person)}" aria-label="Actieve training"><div class="card-head"><div><p class="eyebrow">TRAINING BEZIG · ${escCoach(workout.person)}</p><h2>${escCoach(workout.sessionTitle)}</h2></div><span class="tag">${workout.status === 'paused' ? 'Gepauzeerd' : `${elapsed} min`}</span></div>
      <p>${escCoach(workout.details)} ${escCoach(workout.intensity)} · ${escCoach(workout.restAdvice)}</p>
      ${workout.exercises.map((exercise, exerciseIndex) => {
        const info = state.exercises.find(item => item.id === exercise.id)
          || state.exercises.find(item => item.name.toLocaleLowerCase('nl-NL') === exercise.name.toLocaleLowerCase('nl-NL'));
        return `<article class="sport-workout-exercise"><h3>${escCoach(exercise.name)}</h3>${info?.instructions ? `<p>${escCoach(info.instructions)}</p>` : ''}${info?.imageUrl && isSafeUrl(info.imageUrl) ? `<img loading="lazy" src="${escCoach(info.imageUrl)}" alt="${escCoach(exercise.name)}">` : ''}${info?.videoUrl && isSafeUrl(info.videoUrl) ? `<p><a href="${escCoach(info.videoUrl)}" target="_blank" rel="noopener noreferrer">Uitvoeringsvideo openen ↗</a></p>` : ''}${exercise.sets.map((set, setIndex) => {
          const repsValue = set.reps !== '' && Number.isFinite(Number(set.reps)) ? set.reps : '';
          const repsTarget = set.targetReps || (repsValue === '' ? set.reps : '');
          return `<div class="sport-workout-set"><strong>Set ${setIndex + 1}</strong><label>Gewicht<input type="number" min="0" max="1000" step="0.5" data-workout-set="${exerciseIndex}:${setIndex}:weight" value="${escCoach(set.weight)}" inputmode="decimal"></label><label>Herhalingen<input type="number" min="0" max="1000" step="1" data-workout-set="${exerciseIndex}:${setIndex}:reps" value="${escCoach(repsValue)}" placeholder="${escCoach(repsTarget || '')}" inputmode="numeric"></label><label class="sport-check-label"><input type="checkbox" data-workout-set="${exerciseIndex}:${setIndex}:completed" ${set.completed ? 'checked' : ''}> Afgerond</label>${set.restSeconds ? `<button type="button" class="secondary sport-rest-timer" data-sport-rest="${escCoach(workout.person)}:${exerciseIndex}:${setIndex}" data-seconds="${set.restSeconds}">Rusttimer · ${set.restSeconds}s</button>` : ''}</div>`;
        }).join('')}</article>`;
      }).join('')}
      <div class="sport-fields">
        ${field('Ervaren inspanning (RPE 1–10)', 'rpe', workout.rpe, 'number', 'min="1" max="10" data-workout-meta="rpe"')}
        ${field('Looptempo', 'pace', workout.pace, 'text', 'data-workout-meta="pace"')}
        ${field('Hartslag (optioneel)', 'heartRate', workout.heartRate, 'text', 'data-workout-meta="heartRate"')}
        ${textArea('Herstelervaring', 'recovery', workout.recovery, 'data-workout-meta="recovery"')}
        ${textArea('Persoonlijke feedback', 'feedback', workout.feedback, 'data-workout-meta="feedback"')}
        ${select('Klachten tijdens/na deze training', 'symptomType', workout.symptomType, Object.entries(symptomLabels), 'data-workout-meta="symptomType"')}
        ${textArea('Optionele toelichting op klachten', 'symptomDetails', workout.symptomDetails, 'data-workout-meta="symptomDetails"')}
      </div>
      <div class="sport-alert" data-workout-symptom-alert role="alert" hidden></div>
      <label class="field">Notities<textarea data-workout-notes>${escCoach(workout.notes)}</textarea></label>
      ${workout.status === 'paused' ? '<p class="sport-alert" role="status">Training gepauzeerd; je registratie is lokaal bewaard.</p>' : ''}
      <div class="button-row"><button type="button" class="secondary" data-sport-workout-pause="${escCoach(workout.person)}">${workout.status === 'paused' ? 'Hervatten' : 'Pauzeren'}</button><button type="button" class="primary" data-sport-workout-finish="${escCoach(workout.person)}">Training afronden</button></div></section>`;
  }

  function renderLogForm(state) {
    const programs = allPrograms();
    const visibleSessions = state.sessions.filter(session => canManageProfile(session.person, state));
    return `<section class="card"><div class="card-head"><div><p class="eyebrow">Uitvoering & feedback</p><h2>Training registreren</h2></div></div>
      ${programs.length ? `<form data-sport-log class="sport-form"><div class="sport-fields">
        ${select('Programma', 'programId', programs[0].id, programs.map(program => [program.id, `${program.person} · ${labels[program.discipline] || 'Sport'} · ${program.goal}`]))}
        ${field('Datum', 'date', new Date().toISOString().slice(0, 10), 'date', 'required')}
        ${field('Weeknummer', 'week', 1, 'number', 'min="1" step="1"')}
        ${field('Training / sessie', 'sessionTitle', '', 'text', 'required placeholder="bijv. rustige duurloop"')}
        ${select('Uitvoering', 'status', 'completed', [['completed', 'Uitgevoerd'], ['missed', 'Gemist']])}
        ${field('Ervaren inspanning (RPE 1–10)', 'rpe', '', 'number', 'min="1" max="10" step="1"')}
        ${field('Duur (minuten)', 'durationMinutes', '', 'number', 'min="0" max="600" step="1"')}
        ${field('Gewicht en herhalingen', 'weightsReps', '', 'text', 'placeholder="bijv. squat 3×8 @ 40 kg"')}
        ${field('Looptempo', 'pace', '', 'text', 'placeholder="bijv. 6:20 min/km"')}
        ${field('Hartslag (optioneel)', 'heartRate', '', 'text', 'placeholder="gemiddeld / maximaal"')}
        ${textArea('Herstelervaring', 'recovery', '')}
        ${textArea('Persoonlijke feedback', 'feedback', '')}
        ${select('Klachten tijdens/na deze training', 'symptomType', 'none', Object.entries(symptomLabels))}
        ${textArea('Optionele toelichting op klachten', 'symptomDetails', '')}
      </div><button class="primary" type="submit">Training bewaren</button></form>` : '<p>Maak eerst een programma om trainingen eraan te koppelen.</p>'}
      <div id="sportSymptomAlert" class="sport-alert" aria-live="assertive" hidden></div>
      ${state.sessions.some(session => session.symptomType === 'severe' && canManageProfile(session.person, state)) ? '<div class="sport-alert" role="alert"><strong>Ernstige klacht geregistreerd.</strong> Als ernstige benauwdheid of een alarmsymptoom nu optreedt: stop direct en zoek passende medische hulp. Bij ernstige of aanhoudende klachten: bel de lokale spoeddienst. Dit is geen diagnose- of medicatieadvies.</div>' : ''}
      <div class="sport-logs">${visibleSessions.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12).map(session => `<div class="sport-log"><strong>${escCoach(session.sessionTitle)}</strong><span>${escCoach(session.person)} · ${escCoach(session.date)} · ${session.completed ? 'uitgevoerd' : 'gemist'} · ${session.durationMinutes || 0} min${session.rpe ? ` · RPE ${session.rpe}` : ''}</span>${session.symptomType && session.symptomType !== 'none' ? `<p><strong>Klacht:</strong> ${escCoach(symptomLabels[session.symptomType] || session.symptomType)} ${session.symptomDetails ? `· ${escCoach(session.symptomDetails)}` : ''}</p>` : ''}${session.feedback ? `<p>${escCoach(session.feedback)}</p>` : ''}<button class="delete" data-sport-delete-session="${escCoach(session.id)}" aria-label="Trainingslog verwijderen">×</button></div>`).join('') || '<p class="muted">Nog geen trainingen geregistreerd.</p>'}</div></section>`;
  }

  function renderLibrary(state) {
    if (['cards', 'list'].includes(state.settings.view)) libraryFilter.view = state.settings.view;
    const categories = [...new Set([...coach.LIBRARY_CATEGORIES, ...state.libraryCategories])];
    const tags = [...new Set(state.library.flatMap(item => item.tags || []))].sort((a, b) => a.localeCompare(b, 'nl-NL'));
    const items = coach.searchLibrary(state.library, {
      ...libraryFilter,
      favoriteIds: state.favorites
    });
    const libraryRows = items.map(item => `<article class="sport-library-item ${libraryFilter.view === 'list' ? 'compact' : ''}">
      <div class="sport-library-item-head"><div><strong>${escCoach(item.title)}</strong><span class="tag">${escCoach(item.category)}</span></div>
        <div class="button-row"><button type="button" class="secondary" data-sport-favorite="${escCoach(item.id)}" aria-pressed="${state.favorites.includes(item.id)}">${state.favorites.includes(item.id) ? '★ Favoriet' : '☆ Favoriet'}</button><button type="button" class="secondary" data-sport-duplicate-library="${escCoach(item.id)}">Dupliceren</button><button type="button" class="delete" data-sport-delete-library="${escCoach(item.id)}" aria-label="Bibliotheekitem verwijderen">×</button></div></div>
      <p>${escCoach(item.description || '')}</p><small>${escCoach(item.source || '')}${item.fileName ? ` · ${escCoach(item.fileName)}` : ''}${item.createdAt ? ` · ${escCoach(new Date(item.createdAt).toLocaleDateString('nl-NL'))}` : ''}</small>
      ${item.tags?.length ? `<p>${item.tags.map(tag => `<span class="tag">${escCoach(tag)}</span>`).join(' ')}</p>` : ''}
      ${item.storagePath ? `<button type="button" class="secondary" data-sport-open-file="${escCoach(item.storagePath)}">Bestand openen</button>` : item.url && isSafeUrl(item.url) ? `<p><a href="${escCoach(item.url)}" target="_blank" rel="noopener noreferrer">Bron openen ↗</a></p>` : ''}
      <details class="sport-library-edit"><summary>Bewerken</summary><form data-sport-library-edit="${escCoach(item.id)}" class="sport-form"><div class="sport-fields">
        ${field('Titel', 'title', item.title, 'text', 'required maxlength="120"')}
        ${select('Categorie', 'category', item.category, categories.map(category => [category, category]))}
        ${field('Bron', 'source', item.source, 'text', 'maxlength="160"')}
        ${field('Tags (komma-gescheiden)', 'tags', (item.tags || []).join(', '))}
        ${textArea('Beschrijving', 'description', item.description)}
      </div><button class="secondary" type="submit">Wijzigingen bewaren</button></form></details>
    </article>`).join('');
    const exerciseSources = state.sources.map(source => [source.id, source.title]);
    return `<section class="sport-library"><section class="card"><div class="card-head"><div><p class="eyebrow">Gezamenlijke trainingsbibliotheek</p><h2>Schema’s, bronnen en bestanden</h2></div></div>
      <p>Bestanden blijven in een private Supabase Storage-bucket; alleen titel en metadata komen in de versleutelde huishoudsync. Uploaden vereist aangemelde accountsynchronisatie en de Storage-migratie. Links worden niet opgehaald of uitgevoerd.</p>
      <form data-sport-library class="sport-form"><div class="sport-fields">
        ${field('Titel', 'title', '', 'text', 'required maxlength="120"')}
        ${select('Categorie', 'category', 'Eigen programma’s', categories.map(category => [category, category]))}
        ${field('Bron / organisatie', 'source', '', 'text', 'maxlength="160"')}
        ${field('Tags (komma-gescheiden)', 'tags', '')}
        ${field('Externe website / video (https)', 'url', '', 'url', 'placeholder="https://…"')}
        ${textArea('Beschrijving', 'description', '')}
        ${field('PDF / afbeelding uploaden (max. 10 MB)', 'file', '', 'file', 'accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"')}
      </div><button class="primary" type="submit">Bibliotheekitem toevoegen</button></form>
      <form data-sport-category class="sport-category-form"><label class="field">Eigen categorie<input name="category" maxlength="60" required></label><button class="secondary" type="submit">Categorie toevoegen</button></form>
      <div class="sport-library-controls">
        <label class="field">Zoeken<input data-sport-library-filter="query" value="${escCoach(libraryFilter.query)}" placeholder="Titel, bron, tags"></label>
        ${select('Categorie filter', 'categoryFilter', libraryFilter.category, [['', 'Alle categorieën'], ...categories.map(category => [category, category])], 'data-sport-library-filter="category"')}
        ${select('Tag filter', 'tagFilter', libraryFilter.tag, [['', 'Alle tags'], ...tags.map(tag => [tag, tag])], 'data-sport-library-filter="tag"')}
        ${select('Sorteren', 'sortFilter', libraryFilter.sort, [['newest', 'Nieuwste eerst'], ['title', 'Titel'], ['favorites', 'Favorieten eerst']], 'data-sport-library-filter="sort"')}
        ${select('Weergave', 'viewFilter', libraryFilter.view, [['cards', 'Kaarten'], ['list', 'Compacte lijst']], 'data-sport-library-filter="view"')}
      </div>
      <div class="sport-library-list ${libraryFilter.view === 'list' ? 'list-view' : 'card-view'}">${libraryRows || '<p class="muted">Geen bibliotheekitems gevonden.</p>'}</div>
      ${state.libraryCategories.filter(category => !coach.LIBRARY_CATEGORIES.includes(category)).map(category => `<button type="button" class="text-btn" data-sport-remove-category="${escCoach(category)}">Verwijder ongebruikte categorie: ${escCoach(category)}</button>`).join('')}
    </section>
    <section class="grid two sport-libraries"><section class="card"><div class="card-head"><div><p class="eyebrow">Bronnenbibliotheek</p><h2>Wetenschap, boeken en notities</h2></div></div>
      <p>Houd wetenschappelijk onderzoek, commerciële programma’s en eigen voorkeuren gescheiden. Externe gegevens zijn niet automatisch gecontroleerd.</p>
      <form data-sport-source class="sport-form"><div class="sport-fields">
        ${select('Bronsoort', 'type', 'scientific', Object.entries(sourceLabels))}
        ${field('Titel', 'title', '', 'text', 'required')}
        ${field('Auteur / organisatie', 'authors', '', 'text')}
        ${field('Publicatiejaar', 'year', '', 'number', 'min="1800" max="2100" step="1"')}
        ${field('DOI', 'doi', '', 'text', 'placeholder="10.xxxx/..."')}
        ${field('Originele URL', 'url', '', 'url')}
        ${textArea('Belangrijkste bevinding / notitie', 'finding', '')}
        ${textArea('Relevantie voor training', 'relevance', '')}
      </div><button class="primary" type="submit">Bron bewaren</button></form>
      <div class="sport-library-list">${state.sources.map(source => `<article class="sport-library-item"><strong>${escCoach(source.title)}</strong><span class="tag">${escCoach(sourceLabels[source.type] || source.type)}</span><p>${escCoach([source.authors, source.year].filter(Boolean).join(' · '))}</p>${source.doi ? `<p>DOI ${escCoach(source.doi)}</p>` : ''}${source.url && isSafeUrl(source.url) ? `<p><a href="${escCoach(source.url)}" target="_blank" rel="noopener noreferrer">Open originele URL</a></p>` : ''}${source.finding ? `<p>${escCoach(source.finding)}</p>` : ''}${source.relevance ? `<small>Relevantie: ${escCoach(source.relevance)}</small>` : ''}<button class="delete" data-sport-delete-source="${escCoach(source.id)}" aria-label="Bron verwijderen">×</button></article>`).join('') || '<p class="muted">Nog geen bronnen toegevoegd.</p>'}</div></section>
      <section class="card"><div class="card-head"><div><p class="eyebrow">Oefeningendatabase</p><h2>Herbruikbare oefeningen</h2></div></div><p>Oefeningen worden op naam en discipline ontdubbeld, zodat programma’s naar één herbruikbare oefening kunnen verwijzen.</p>
      <form data-sport-exercise class="sport-form"><div class="sport-fields">
        ${field('Naam', 'name', '', 'text', 'required maxlength="120"')}
        ${field('Beschrijving', 'description', '')}
        ${select('Discipline', 'discipline', 'strength', Object.entries(labels))}
        ${field('Categorie / bewegingsvorm', 'category', 'strength')}
        ${field('Spiergroepen (komma-gescheiden)', 'muscleGroups', '')}
        ${field('Benodigd materiaal (komma-gescheiden)', 'equipment', '')}
        ${select('Moeilijkheid', 'difficulty', 'beginner', [['beginner', 'Beginner'], ['recreational', 'Recreatief'], ['advanced', 'Gevorderd']])}
        ${field('Sets', 'sets', '', 'number', 'min="0" max="30" step="1"')}
        ${field('Herhalingen', 'reps', '', 'text', 'maxlength="40"')}
        ${field('Duur (seconden)', 'durationSeconds', '', 'number', 'min="0" max="3600" step="1"')}
        ${field('Rust (seconden)', 'restSeconds', '', 'number', 'min="0" max="900" step="1"')}
        ${field('Afbeelding URL', 'imageUrl', '', 'url', 'placeholder="https://…"')}
        ${field('Video URL', 'videoUrl', '', 'url', 'placeholder="https://…"')}
        ${select('Bronverwijzing', 'sourceId', '', [['', 'Geen bron'], ...exerciseSources])}
        ${field('Tags (komma-gescheiden)', 'tags', '')}
        ${textArea('Uitvoeringsinstructies', 'instructions', '')}
      </div><button class="primary" type="submit">Oefening bewaren</button></form>
      <div class="sport-library-list">${state.exercises.map(exercise => `<article class="sport-library-item"><strong>${escCoach(exercise.name)}</strong><span class="tag">${escCoach(labels[exercise.discipline] || 'Sport')}</span><p>${escCoach(exercise.description)}</p><p>${escCoach([exercise.muscleGroups.join(', '), exercise.equipment.join(', ')].filter(Boolean).join(' · '))}</p><small>${exercise.sets || '—'} sets · ${escCoach(exercise.reps || '—')} herhalingen · ${exercise.restSeconds || 0}s rust · ${escCoach(exercise.difficulty)}</small>${exercise.instructions ? `<p>${escCoach(exercise.instructions)}</p>` : ''}${exercise.imageUrl && isSafeUrl(exercise.imageUrl) ? `<img loading="lazy" src="${escCoach(exercise.imageUrl)}" alt="${escCoach(exercise.name)}">` : ''}${exercise.videoUrl && isSafeUrl(exercise.videoUrl) ? `<p><a href="${escCoach(exercise.videoUrl)}" target="_blank" rel="noopener noreferrer">Video openen</a></p>` : ''}<button class="delete" data-sport-delete-exercise="${escCoach(exercise.id)}" aria-label="Oefening verwijderen">×</button></article>`).join('') || '<p class="muted">Nog geen oefeningen toegevoegd.</p>'}</div></section></section></section>`;
  }

  function renderSportCoach() {
    const state = coachState();
    document.querySelector('#addBtn').style.display = 'none';
    document.querySelector('#pageTitle').textContent = 'Sport & Training';
    return `<div class="sportcoach-page"><section class="card sport-intro"><p class="eyebrow">SPORTWETENSCHAP · PERSOONLIJKE TRAININGSANALYSE</p><h2>Trainingskeuzes inzichtelijk en aanpasbaar</h2><p>Geen universeel schema: eerst profiel en huidige belasting, daarna een disciplinespecifiek voorstel. Dit hulpmiddel stelt geen diagnose. Wijzigingen aan bestaande programma’s worden nooit automatisch toegepast.</p><p><strong>Wetenschappelijke transparantie:</strong> onderbouwde algemene principes worden onderscheiden van praktische keuzes. Alleen daadwerkelijk opgeslagen bronnen worden als bron getoond.</p></section>
      <div class="grid two">${coach.PEOPLE.map(name => renderProfile(name, state.profiles[name])).join('')}</div>
      ${renderGenerator(state)}
      ${renderStats(state)}
      <section><div class="card-head sport-section-head"><div><p class="eyebrow">Periodisering & trainingsopbouw</p><h2>Programma’s</h2></div></div>${allPrograms().map(renderProgram).join('') || '<div class="empty">Nog geen programma’s. Vul een persoonlijk profiel in om te beginnen.</div>'}</section>
      ${renderPlanner(state)}${Object.values(state.activeWorkouts).filter(workout => canManageProfile(workout.person, state)).map(workout => renderWorkout(workout, state)).join('')}${renderLogForm(state)}${renderLibrary(state)}
      <p class="sport-disclaimer">Bij pijn, blessure, ziekte of andere fysieke aandachtspunten: stop bij klachten en vraag professionele begeleiding. Training kan vermoeidheid of letsel veroorzaken. Dit hulpmiddel vervangt geen medische beoordeling.</p>
    </div>`;
  }

  function updateSportNavigation() {
    window.__st_current_page__ = 'sportcoach';
  }

  function selected(form, name) {
    return Array.from(form.elements[name]?.selectedOptions || []).map(option => option.value);
  }

  function reportAnalysis(form, result) {
    const target = document.querySelector('#sportAnalysis');
    if (!target) return;
    if (!result.ok) {
      target.innerHTML = `<div class="sport-alert"><strong>Programma niet gemaakt</strong><ul>${result.analysis.blockers.map(item => `<li>${escCoach(item)}</li>`).join('')}</ul></div>`;
      return;
    }
    const analysis = result.analysis;
    const program = result.program;
    target.innerHTML = `<div class="sport-analysis-result"><p><strong>Analyse ${escCoach(analysis.person)}:</strong> ${escCoach(levelLabels[analysis.level])} · ${escCoach(labels[analysis.discipline])} · ${analysis.weeks} weken · ${analysis.frequency} sessies/week · circa ${analysis.minutesPerSession} min/sessie.</p><p>Huidig: ${escCoach(analysis.currentActivity)}; ${Math.round(analysis.baselineWeeklyMinutes)} min/week geregistreerd/ingevuld.</p><p><strong>In deze lokale analyse gebruikt:</strong> trainingsniveau, activiteit, trainings- en herstelgeschiedenis, tijd, voorkeuren, materiaal, sportdiscipline en vrijwillig ingevulde inspanningsinformatie. Medicatie-informatie is uitgesloten. Geen gegevens worden naar een externe AI verstuurd.</p><ul>${analysis.cautions.map(item => `<li>${escCoach(item)}</li>`).join('')}</ul><p>De precieze progressie en oefenkeuze zijn praktische voorstellen, geen gegarandeerd resultaat. Bekijk per week volume, intensiteit, herstel en evaluatiemomenten. Het voorstel wordt pas opgeslagen na je bevestiging.</p><form class="sport-review" data-sport-review><label class="field">Programmanaam<input name="name" maxlength="120" value="${escCoach(program.name)}" required></label><label class="field">Doel aanpassen<input name="goal" maxlength="200" value="${escCoach(program.goal)}" required></label><button class="primary" type="submit">Voorstel opslaan als concept</button></form></div>${renderProgram(program)}`;
  }

  function saveChange(message) {
    if (save() === false) return false;
    render();
    if (typeof toast === 'function') toast(message);
    return true;
  }

  async function checkAiConfiguration() {
    const status = document.querySelector('[data-sport-ai-status]');
    const form = document.querySelector('[data-sport-generate]');
    if (!status || !form) return;
    let session;
    try { session = await window.SamenThuisAuth25?.ready?.(); }
    catch (error) { status.textContent = error.message || 'Aanmeldstatus kon niet worden gecontroleerd; er is geen AI-aanvraag verstuurd.'; return; }
    if (!session?.access_token || !window.SamenThuisAccountSync?.active?.()) {
      status.textContent = 'AI-aanroep niet uitgevoerd: meld je aan en activeer eerst accountsynchronisatie. De lokale generator blijft beschikbaar; er wordt geen AI gesimuleerd.';
      return;
    }
    const values = Object.fromEntries(new FormData(form).entries());
    const profile = coachState().profiles[values.person];
    const payload = {
      profile: {
        level: profile.level,
        availableWeeklyMinutes: Number(profile.availableWeeklyMinutes),
        availableDays: profile.availableDays,
        equipment: profile.availableEquipment
      },
      request: {
        discipline: values.discipline,
        goal: String(values.goal || '').trim(),
        weeks: Number(values.weeks),
        sessionsPerWeek: Number(values.sessionsPerWeek),
        sourceIds: selected(form, 'sourceIds')
      }
    };
    status.textContent = 'Trainingsaanvraag wordt naar de beveiligde huishoudfunctie gestuurd; gezondheids- en medicatiegegevens zijn uitgesloten.';
    try {
      const base = String(syncConfig?.projectUrl || '').replace(/\/+$/, '');
      const response = await fetch(`${base}/functions/v1/sport-training`, {
        method: 'POST',
        headers: {
          apikey: syncConfig?.anonKey || DEFAULT_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      status.textContent = result.message || result.error || `AI-aanvraag mislukt (${response.status}); er is geen schema opgeslagen.`;
    } catch (error) {
      status.textContent = error.message || 'AI-configuratie kon niet worden gecontroleerd; er is geen schema opgeslagen.';
    }
  }

  sections.sportcoach = { label: 'Sport & Training', icon: '🏃' };
  window.SamenThuisSportAccess = { canManagePerson: person => canManageProfile(person) };
  const baseSportRender = render;
  render = function renderWithSportCoach(...args) {
    if (current === 'sportcoach') {
      document.querySelector('#view').innerHTML = renderSportCoach();
      updateSportNavigation();
      if (typeof updateSyncBadge === 'function') updateSyncBadge();
      return;
    }
    return baseSportRender(...args);
  };



  document.addEventListener('click', event => {
    if (event.target.closest('[data-sport-ai-request]')) { checkAiConfiguration(); return; }
    const restButton = event.target.closest('[data-sport-rest]');
    if (restButton) {
      const key = restButton.dataset.sportRest;
      const previous = restTimers.get(key);
      if (previous) { clearInterval(previous.timer); restTimers.delete(key); }
      let remaining = Math.min(900, Math.max(1, Number(restButton.dataset.seconds) || 60));
      restButton.textContent = `Rust ${remaining}s`;
      const timer = setInterval(() => {
        remaining -= 1;
        if (!restButton.isConnected) { clearInterval(timer); restTimers.delete(key); return; }
        if (remaining <= 0) {
          clearInterval(timer);
          restTimers.delete(key);
          restButton.textContent = 'Rust klaar';
          return;
        }
        restButton.textContent = `Rust ${remaining}s`;
      }, 1000);
      restTimers.set(key, { timer });
      return;
    }
    const startPlan = event.target.closest('[data-sport-start-plan]');
    if (startPlan) {
      const state = coachState(), plan = state.plans.find(item => item.id === startPlan.dataset.sportStartPlan);
      const program = state.programs.find(item => item.id === plan?.programId);
      if (!plan || !program || !canManageProfile(plan.person, state)) return;
      if (state.activeWorkouts[plan.person]) { if (typeof toast === 'function') toast('Rond eerst de actieve training af of pauzeer deze.'); return; }
      try { state.activeWorkouts[plan.person] = startWorkout(program, plan.week, plan.sessionIndex, plan.id); }
      catch (error) { if (typeof toast === 'function') toast(error.message); return; }
      saveChange('Geplande training gestart.');
      return;
    }
    const startSession = event.target.closest('[data-sport-start-session]');
    if (startSession) {
      const state = coachState();
      const [programId, week, sessionIndex] = startSession.dataset.sportStartSession.split(':');
      const program = state.programs.find(item => item.id === programId);
      if (!program || !canManageProfile(program.person, state)) { if (typeof toast === 'function') toast('Je kunt alleen je eigen trainingsprogramma uitvoeren.'); return; }
      if (state.activeWorkouts[program.person]) { if (typeof toast === 'function') toast('Rond eerst de actieve training af of pauzeer deze.'); return; }
      const planned = (state.plans || []).find(item => item.programId === program.id && item.week === Number(week)
        && item.sessionIndex === Number(sessionIndex) && item.status === 'planned' && item.date === new Date().toISOString().slice(0, 10));
      try { state.activeWorkouts[program.person] = startWorkout(program, week, sessionIndex, planned?.id || ''); }
      catch (error) { if (typeof toast === 'function') toast(error.message); return; }
      saveChange('Training gestart en voortgang bewaard.');
      return;
    }
    const pauseWorkout = event.target.closest('[data-sport-workout-pause]');
    if (pauseWorkout) {
      const state = coachState(), person = pauseWorkout.dataset.sportWorkoutPause;
      const workout = state.activeWorkouts[person];
      if (!workout || !canManageProfile(person, state)) return;
      const now = Date.now();
      if (workout.status === 'paused') {
        workout.pausedMilliseconds = (workout.pausedMilliseconds || 0) + Math.max(0, now - Number(workout.pausedAt || now));
        workout.pausedAt = 0;
        workout.status = 'running';
      } else {
        workout.pausedAt = now;
        workout.status = 'paused';
      }
      saveChange(workout.status === 'paused' ? 'Training gepauzeerd.' : 'Training hervat.');
      return;
    }
    const finishWorkout = event.target.closest('[data-sport-workout-finish]');
    if (finishWorkout) {
      const state = coachState(), person = finishWorkout.dataset.sportWorkoutFinish;
      const workout = state.activeWorkouts[person];
      if (!workout || !canManageProfile(person, state)) return;
      const now = Date.now();
      const paused = (workout.pausedMilliseconds || 0) + (workout.status === 'paused' ? Math.max(0, now - Number(workout.pausedAt || now)) : 0);
      const durationMinutes = Math.max(1, Math.round((now - Number(workout.startedAt || now) - paused) / 60000));
      state.sessions.unshift({
        id: id('session'), programId: workout.programId, person: workout.person, discipline: workout.discipline,
        date: new Date(workout.startedAt).toISOString().slice(0, 10), week: workout.week, sessionTitle: workout.sessionTitle,
        completed: true, durationMinutes, rpe: Number(workout.rpe) || 0, pace: workout.pace || '',
        heartRate: workout.heartRate || '', recovery: workout.recovery || '', feedback: workout.feedback || workout.notes || '',
        symptomType: workout.symptomType || 'none', symptomDetails: workout.symptomDetails || '',
        exercises: workout.exercises.map(exercise => ({ id: exercise.id, name: exercise.name, sets: exercise.sets.map(set => ({ ...set })) }))
      });
      if (workout.planId) {
        const plan = state.plans.find(item => item.id === workout.planId);
        if (plan) { plan.status = 'completed'; plan.completedAt = new Date(now).toISOString(); }
      }
      delete state.activeWorkouts[person];
      if (workout.symptomType === 'severe') window.alert('Stop de training. Bij ernstige benauwdheid of een alarmsymptoom dat nu optreedt of aanhoudt: zoek passende medische hulp of bel de lokale spoeddienst. Dit is geen diagnose- of medicatieadvies.');
      saveChange('Training afgerond en aan je persoonlijke geschiedenis toegevoegd.');
      return;
    }
    const favorite = event.target.closest('[data-sport-favorite]');
    if (favorite) {
      const state = coachState(), itemId = favorite.dataset.sportFavorite;
      state.favorites = state.favorites.includes(itemId) ? state.favorites.filter(item => item !== itemId) : [...state.favorites, itemId];
      saveChange('Favorieten bijgewerkt.');
      return;
    }
    const duplicateItem = event.target.closest('[data-sport-duplicate-library]');
    if (duplicateItem) {
      const state = coachState(), source = state.library.find(item => item.id === duplicateItem.dataset.sportDuplicateLibrary);
      if (!source) return;
      state.library.unshift({ ...source, id: id('library'), title: `${source.title} (kopie)`, createdAt: new Date().toISOString() });
      saveChange('Bibliotheekitem gedupliceerd.');
      return;
    }
    const deleteItem = event.target.closest('[data-sport-delete-library]');
    if (deleteItem) {
      if (!confirm('Bibliotheekverwijzing verwijderen? Een eventueel Storage-bestand blijft behouden.')) return;
      const state = coachState(), itemId = deleteItem.dataset.sportDeleteLibrary;
      state.library = state.library.filter(item => item.id !== itemId);
      state.favorites = state.favorites.filter(item => item !== itemId);
      saveChange('Bibliotheekverwijzing verwijderd; opgeslagen bestanden blijven behouden.');
      return;
    }
    const openFile = event.target.closest('[data-sport-open-file]');
    if (openFile) {
      const tab = window.open('about:blank', '_blank');
      if (tab) tab.opener = null;
      window.SamenThuisAccountSync?.signedSportFileUrl(openFile.dataset.sportOpenFile).then(url => {
        if (tab) tab.location = url;
        else { const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.click(); }
      }).catch(error => {
        if (tab) tab.close();
        if (typeof toast === 'function') toast(error.message || 'Bestand openen mislukt.');
      });
      return;
    }
    const removeCategory = event.target.closest('[data-sport-remove-category]');
    if (removeCategory) {
      const state = coachState(), category = removeCategory.dataset.sportRemoveCategory;
      if (state.library.some(item => item.category === category)) { if (typeof toast === 'function') toast('Verplaats eerst de bibliotheekitems uit deze categorie.'); return; }
      state.libraryCategories = state.libraryCategories.filter(item => item !== category);
      saveChange('Categorie verwijderd.');
      return;
    }
    const planDuplicate = event.target.closest('[data-sport-plan-duplicate]');
    if (planDuplicate) {
      const state = coachState(), source = state.plans.find(item => item.id === planDuplicate.dataset.sportPlanDuplicate);
      if (!source || !canManageProfile(source.person, state)) return;
      state.plans.push({ ...source, id: id('plan'), date: new Date(new Date(`${source.date}T12:00:00`).getTime() + 86400000).toISOString().slice(0, 10), status: 'planned', createdAt: new Date().toISOString() });
      saveChange('Training naar de volgende dag gekopieerd.');
      return;
    }
    const planSkip = event.target.closest('[data-sport-plan-skip]');
    if (planSkip) {
      const state = coachState(), plan = state.plans.find(item => item.id === planSkip.dataset.sportPlanSkip);
      if (!plan || !canManageProfile(plan.person, state)) return;
      plan.status = 'skipped';
      saveChange('Training overgeslagen; de planning is behouden.');
      return;
    }
    const clearHealth = event.target.closest('[data-sport-clear-health]');
    if (clearHealth) {
      if (!confirm(`Alle optionele gezondheidsinformatie van ${clearHealth.dataset.sportClearHealth} verwijderen?`)) return;
      const state = coachState();
      if (!canManageProfile(clearHealth.dataset.sportClearHealth, state)) return;
      state.profiles[clearHealth.dataset.sportClearHealth].health = coach.emptyProfile(clearHealth.dataset.sportClearHealth).health;
      saveChange('Gezondheidsinformatie verwijderd.');
      return;
    }
    const deleteSession = event.target.closest('[data-sport-delete-session]');
    if (deleteSession) {
      if (!confirm('Deze trainingslog, inclusief eventuele klachtenfeedback, verwijderen?')) return;
      const state = coachState();
      const target = state.sessions.find(session => session.id === deleteSession.dataset.sportDeleteSession);
      if (!target || !canManageProfile(target.person, state)) { if (typeof toast === 'function') toast('Je kunt alleen je eigen trainingsgeschiedenis wijzigen.'); return; }
      state.sessions = state.sessions.filter(session => session.id !== deleteSession.dataset.sportDeleteSession);
      saveChange('Trainingslog verwijderd.');
      return;
    }
    const evaluateButton = event.target.closest('[data-sport-evaluate]');
    if (evaluateButton) {
      const state = coachState();
      const program = state.programs.find(item => item.id === evaluateButton.dataset.sportEvaluate);
      if (!program || !canManageProfile(program.person, state)) return;
      const summary = coach.evaluateProgram(program, state.sessions);
      state.evaluations = state.evaluations.filter(item => item.programId !== program.id);
      state.evaluations.push({ id: id('evaluation'), programId: program.id, createdAt: new Date().toISOString(), summary });
      saveChange('Evaluatie bewaard; het programma is niet gewijzigd.');
      return;
    }
    const adjustmentButton = event.target.closest('[data-sport-adjust]');
    if (adjustmentButton) {
      const state = coachState();
      const program = state.programs.find(item => item.id === adjustmentButton.dataset.sportAdjust);
      const evaluation = state.evaluations.find(item => item.programId === adjustmentButton.dataset.sportAdjust);
      if (!program || !evaluation || !canManageProfile(program.person, state)) return;
      if (!confirm('Een apart concept maken? Het bestaande trainingsprogramma blijft ongewijzigd.')) return;
      state.programs.push(coach.proposeAdjustment(program, evaluation.summary));
      saveChange('Apart concept gemaakt; het oorspronkelijke programma is ongewijzigd.');
      return;
    }
    const approveButton = event.target.closest('[data-sport-approve]');
    if (approveButton) {
      const program = coachState().programs.find(item => item.id === approveButton.dataset.sportApprove);
      if (!program || program.status !== 'draft' || !canManageProfile(program.person)) return;
      if (!confirm('Dit concept als apart programma accepteren? Het oorspronkelijke programma blijft ongewijzigd.')) return;
      program.status = 'active';
      saveChange('Concept geaccepteerd als apart programma; de eerdere versie is behouden.');
      return;
    }
    const completeProgram = event.target.closest('[data-sport-complete-program]');
    if (completeProgram) {
      const state = coachState(), program = state.programs.find(item => item.id === completeProgram.dataset.sportCompleteProgram);
      if (!program || program.status !== 'active' || !canManageProfile(program.person, state)) return;
      if (!confirm('Dit programma als afgerond markeren? Trainingslogs en eerdere programmaversies blijven behouden.')) return;
      program.status = 'completed';
      program.completedAt = new Date().toISOString();
      saveChange('Programma afgerond.');
      return;
    }
    const deleteSource = event.target.closest('[data-sport-delete-source]');
    if (deleteSource && confirm('Deze bron verwijderen?')) {
      const state = coachState();
      state.sources = state.sources.filter(item => item.id !== deleteSource.dataset.sportDeleteSource);
      state.programs.forEach(program => { program.sourceIds = (program.sourceIds || []).filter(sourceId => sourceId !== deleteSource.dataset.sportDeleteSource); });
      saveChange('Bron verwijderd.');
      return;
    }
    const deleteExercise = event.target.closest('[data-sport-delete-exercise]');
    if (deleteExercise && confirm('Deze oefening verwijderen?')) {
      const state = coachState();
      state.exercises = state.exercises.filter(item => item.id !== deleteExercise.dataset.sportDeleteExercise);
      saveChange('Oefening verwijderd.');
    }
  });

  document.addEventListener('submit', async event => {
    const profileForm = event.target.closest('[data-sport-profile]');
    if (profileForm) {
      event.preventDefault();
      const state = coachState(), person = profileForm.dataset.sportProfile;
      const profile = state.profiles[person];
      if (!canManageProfile(person, state)) { if (typeof toast === 'function') toast('Dit profiel hoort bij het andere huishoudaccount.'); return; }
      if (!profile.userId && accountUserId()) profile.userId = accountUserId();
      new FormData(profileForm).forEach((value, key) => {
        if (key.startsWith('health.')) {
          profile.health[key.slice('health.'.length)] = String(value).trim();
          return;
        }
        if (['goals', 'availableDays', 'preferredExercises', 'avoidedExercises'].includes(key)) {
          profile[key] = String(value).split(',').map(item => item.trim()).filter(Boolean);
          return;
        }
        profile[key] = ['age', 'trainingYears', 'availableWeeklyMinutes', 'minutesPerSession', 'currentWeeklyMinutes', 'runningCurrentKm', 'runningLongestRunKm', 'runningSessionsPerWeek'].includes(key) ? Number(value) || 0 : String(value).trim();
      });
      saveChange(`Profiel ${person} bewaard.`);
      return;
    }
    const generator = event.target.closest('[data-sport-generate]');
    if (generator) {
      event.preventDefault();
      const state = coachState(), formData = new FormData(generator);
      const request = Object.fromEntries(formData.entries());
      if (!canManageProfile(request.person, state)) { if (typeof toast === 'function') toast('Je kunt alleen voor je eigen profiel een programma maken.'); return; }
      request.sourceIds = selected(generator, 'sourceIds');
      const result = coach.generateProgram(state.profiles[request.person], request, state.sessions, state.sources, state.exercises);
      if (!result.ok) { pendingProgram = null; reportAnalysis(generator, result); return; }
      result.program.name = `${request.person} · ${labels[result.program.discipline]} · ${result.program.goal}`;
      const validation = coach.validateProgram(result.program);
      if (!validation.ok) {
        pendingProgram = null;
        const target = document.querySelector('#sportAnalysis');
        if (target) target.innerHTML = `<div class="sport-alert"><strong>Voorstel niet geldig</strong><ul>${validation.errors.map(escCoach).map(error => `<li>${error}</li>`).join('')}</ul></div>`;
        return;
      }
      pendingProgram = result.program;
      reportAnalysis(generator, result);
      return;
    }
    const reviewForm = event.target.closest('[data-sport-review]');
    if (reviewForm) {
      event.preventDefault();
      if (!pendingProgram) return;
      const values = Object.fromEntries(new FormData(reviewForm).entries());
      pendingProgram.name = String(values.name || '').trim().slice(0, 120);
      pendingProgram.goal = String(values.goal || '').trim().slice(0, 200);
      const validation = coach.validateProgram(pendingProgram);
      if (!validation.ok) { if (typeof toast === 'function') toast(validation.errors[0]); return; }
      const state = coachState();
      state.programs.unshift(pendingProgram);
      pendingProgram = null;
      if (save() === false) return;
      render();
      if (typeof toast === 'function') toast('Voorstel als concept opgeslagen; het is nog niet actief.');
      return;
    }
    const planForm = event.target.closest('[data-sport-plan]');
    if (planForm) {
      event.preventDefault();
      const state = coachState(), values = Object.fromEntries(new FormData(planForm).entries());
      const [programId, weekNumber, sessionIndex] = String(values.sessionRef || '').split(':');
      const program = state.programs.find(item => item.id === programId);
      const week = program?.weeks?.find(item => Number(item.week) === Number(weekNumber));
      const session = week?.sessions?.[Number(sessionIndex)];
      if (!program || !session || program.status !== 'active' || !canManageProfile(program.person, state)) {
        if (typeof toast === 'function') toast('Kies een geldige sessie van je actieve programma.');
        return;
      }
      state.plans.push({
        id: id('plan'), person: program.person, programId, week: Number(weekNumber),
        sessionIndex: Number(sessionIndex), sessionTitle: session.title,
        durationMinutes: Number(session.durationMinutes) || 0, date: values.date,
        status: 'planned', createdAt: new Date().toISOString()
      });
      saveChange('Training aan je persoonlijke planning toegevoegd.');
      return;
    }
    const movePlanForm = event.target.closest('[data-sport-plan-edit]');
    if (movePlanForm) {
      event.preventDefault();
      const state = coachState(), plan = state.plans.find(item => item.id === movePlanForm.dataset.sportPlanEdit);
      if (!plan || !canManageProfile(plan.person, state)) return;
      plan.date = String(new FormData(movePlanForm).get('date') || '');
      saveChange('Geplande training verplaatst.');
      return;
    }
    const editLibraryForm = event.target.closest('[data-sport-library-edit]');
    if (editLibraryForm) {
      event.preventDefault();
      const state = coachState(), item = state.library.find(entry => entry.id === editLibraryForm.dataset.sportLibraryEdit);
      if (!item) return;
      const values = Object.fromEntries(new FormData(editLibraryForm).entries());
      Object.assign(item, {
        title: String(values.title || '').trim().slice(0, 120),
        category: String(values.category || '').trim().slice(0, 60),
        source: String(values.source || '').trim().slice(0, 160),
        tags: String(values.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
        description: String(values.description || '').trim()
      });
      saveChange('Bibliotheekitem bijgewerkt.');
      return;
    }
    const libraryForm = event.target.closest('[data-sport-library]');
    if (libraryForm) {
      event.preventDefault();
      const state = coachState(), values = Object.fromEntries(new FormData(libraryForm).entries());
      const file = libraryForm.elements.file.files?.[0] || null;
      const url = String(values.url || '').trim();
      if (!file && url && !isSafeUrl(url)) { if (typeof toast === 'function') toast('Gebruik voor externe bronnen een volledige https-URL.'); return; }
      const itemId = id('library');
      let upload = null;
      if (file) {
        const valid = await coach.validateUpload(file);
        if (!valid.ok) { if (typeof toast === 'function') toast(valid.error); return; }
        const uploader = window.SamenThuisAccountSync?.uploadSportFile;
        if (typeof uploader !== 'function') { if (typeof toast === 'function') toast('Bestandsopslag is niet beschikbaar; activeer account-sync en pas de Storage-migratie toe.'); return; }
        try { upload = await uploader(file, itemId); }
        catch (error) { if (typeof toast === 'function') toast(error.message || 'Bestand uploaden mislukt.'); return; }
      }
      state.library.unshift({
        id: itemId,
        title: String(values.title || '').trim().slice(0, 120),
        description: String(values.description || '').trim().slice(0, 2000),
        source: String(values.source || '').trim().slice(0, 160),
        category: String(values.category || 'Eigen programma’s').trim().slice(0, 60),
        tags: String(values.tags || '').split(',').map(tag => tag.trim()).filter(Boolean),
        type: file ? (upload.contentType === 'application/pdf' ? 'pdf' : 'image') : url ? (/youtube\.com|youtu\.be/i.test(url) ? 'video' : 'link') : 'note',
        url: file ? '' : url,
        fileName: upload?.fileName || '',
        contentType: upload?.contentType || '',
        fileSize: upload?.size || 0,
        storagePath: upload?.path || '',
        linkedExercises: [],
        createdAt: new Date().toISOString(),
        ownerUserId: accountUserId()
      });
      saveChange('Bibliotheekitem toegevoegd.');
      return;
    }
    const categoryForm = event.target.closest('[data-sport-category]');
    if (categoryForm) {
      event.preventDefault();
      const state = coachState(), category = String(new FormData(categoryForm).get('category') || '').trim().slice(0, 60);
      if (category && !state.libraryCategories.includes(category) && !coach.LIBRARY_CATEGORIES.includes(category)) state.libraryCategories.push(category);
      saveChange('Categorie bewaard.');
      return;
    }
    const logForm = event.target.closest('[data-sport-log]');
    if (logForm) {
      event.preventDefault();
      const state = coachState(), values = Object.fromEntries(new FormData(logForm).entries());
      const program = state.programs.find(item => item.id === values.programId);
      if (!program || !canManageProfile(program.person, state)) { if (typeof toast === 'function') toast('Selecteer een bestaand programma van je eigen profiel.'); return; }
      state.sessions.unshift({
        id: id('session'), programId: program.id, person: program.person, discipline: program.discipline,
        date: values.date, week: Number(values.week) || 1, sessionTitle: values.sessionTitle.trim(),
        completed: values.status === 'completed', rpe: Number(values.rpe) || 0, durationMinutes: Number(values.durationMinutes) || 0,
        weightsReps: values.weightsReps.trim(), pace: values.pace.trim(), heartRate: values.heartRate.trim(),
        recovery: values.recovery.trim(), feedback: values.feedback.trim()
        ,symptomType: values.symptomType, symptomDetails: values.symptomDetails.trim()
      });
      if (values.symptomType === 'severe') {
        window.alert('Stop de training direct. Als ernstige benauwdheid of een alarmsymptoom nu optreedt of aanhoudt, zoek passende medische hulp of bel de lokale spoeddienst. Dit is geen diagnose- of medicatieadvies.');
      }
      saveChange('Training geregistreerd.');
      return;
    }
    const sourceForm = event.target.closest('[data-sport-source]');
    if (sourceForm) {
      event.preventDefault();
      const state = coachState(), values = Object.fromEntries(new FormData(sourceForm).entries());
      if (values.url && !isSafeUrl(values.url)) { if (typeof toast === 'function') toast('Gebruik een volledige https-URL.'); return; }
      state.sources.unshift({ ...values, id: id('source'), createdAt: new Date().toISOString(), year: Number(values.year) || '' });
      saveChange('Bron bewaard.');
      return;
    }
    const exerciseForm = event.target.closest('[data-sport-exercise]');
    if (exerciseForm) {
      event.preventDefault();
      const state = coachState(), values = Object.fromEntries(new FormData(exerciseForm).entries());
      if ((values.imageUrl && !isSafeUrl(values.imageUrl)) || (values.videoUrl && !isSafeUrl(values.videoUrl))) {
        if (typeof toast === 'function') toast('Afbeelding- en videolinks moeten met https beginnen.');
        return;
      }
      const result = coach.upsertExercise(state.exercises, {
        ...values, id: id('exercise'), createdAt: new Date().toISOString(),
        sets: Number(values.sets) || 0, durationSeconds: Number(values.durationSeconds) || 0,
        restSeconds: Number(values.restSeconds) || 0,
        muscleGroups: String(values.muscleGroups || '').split(',').map(item => item.trim()).filter(Boolean),
        equipment: String(values.equipment || '').split(',').map(item => item.trim()).filter(Boolean),
        tags: String(values.tags || '').split(',').map(item => item.trim()).filter(Boolean)
      });
      saveChange(result.created ? 'Oefening bewaard.' : 'Dubbele oefening bijgewerkt in de bestaande record.');
    }
  });

  document.addEventListener('change', event => {
    const plannerView = event.target.closest('[data-sport-planner-view]');
    if (plannerView) {
      const state = coachState();
      state.settings.plannerView = plannerView.value;
      save();
      render();
      return;
    }
    const filter = event.target.closest('[data-sport-library-filter]');
    if (filter) {
      libraryFilter[filter.dataset.sportLibraryFilter] = filter.value;
      if (filter.dataset.sportLibraryFilter === 'view') coachState().settings.view = filter.value;
      render();
      return;
    }
    const setInput = event.target.closest('[data-workout-set]');
    if (setInput) {
      const card = setInput.closest('[data-workout-person]');
      const state = coachState(), workout = state.activeWorkouts[card?.dataset.workoutPerson];
      if (!workout || !canManageProfile(workout.person, state)) return;
      const [exerciseIndex, setIndex, property] = setInput.dataset.workoutSet.split(':');
      const set = workout.exercises[Number(exerciseIndex)]?.sets[Number(setIndex)];
      if (!set || !['weight', 'reps', 'completed'].includes(property)) return;
      set[property] = property === 'completed' ? setInput.checked : setInput.value;
      save();
      return;
    }
    const workoutMeta = event.target.closest('[data-workout-meta]');
    if (workoutMeta) {
      const person = workoutMeta.closest('[data-workout-person]')?.dataset.workoutPerson;
      const state = coachState(), workout = state.activeWorkouts[person];
      if (!workout || !canManageProfile(person, state)) return;
      workout[workoutMeta.dataset.workoutMeta] = workoutMeta.value;
      const alert = workoutMeta.closest('[data-workout-person]').querySelector('[data-workout-symptom-alert]');
      if (workoutMeta.dataset.workoutMeta === 'symptomType' && alert) {
        alert.hidden = ['none', 'fatigue'].includes(workoutMeta.value);
        alert.innerHTML = workoutMeta.value === 'severe'
          ? '<strong>Stop nu met trainen.</strong> Bij ernstige benauwdheid of alarmsymptomen die nu optreden of aanhouden: zoek passende medische hulp of bel de lokale spoeddienst. Geen diagnose- of medicatieadvies.'
          : workoutMeta.value === 'airway'
            ? '<strong>Luchtwegklachten zijn niet hetzelfde als normale inspanningsvermoeidheid.</strong> Stop of onderbreek de inspanning en bespreek terugkerende of toenemende klachten met een arts/behandelaar.'
            : '';
      }
      save();
      return;
    }
    const workoutNotes = event.target.closest('[data-workout-notes]');
    if (workoutNotes) {
      const person = workoutNotes.closest('[data-workout-person]')?.dataset.workoutPerson;
      const workout = coachState().activeWorkouts[person];
      if (workout) { workout.notes = workoutNotes.value; save(); }
      return;
    }
    const symptomSelect = event.target.closest('[name="symptomType"]');
    if (!symptomSelect) return;
    const alertBox = document.querySelector('#sportSymptomAlert');
    if (!alertBox) return;
    const symptomType = symptomSelect.value;
    alertBox.hidden = symptomType === 'none' || symptomType === 'fatigue';
    alertBox.innerHTML = symptomType === 'severe'
      ? '<strong>Stop nu met trainen.</strong> Bij ernstige benauwdheid of alarmsymptomen die nu optreden of aanhouden: zoek passende medische hulp of bel de lokale spoeddienst. Geen diagnose- of medicatieadvies.'
      : symptomType === 'airway'
        ? '<strong>Luchtwegklachten zijn niet hetzelfde als normale inspanningsvermoeidheid.</strong> Stop of onderbreek de inspanning. Bespreek terugkerende, toenemende of onvoldoende gecontroleerde klachten met je arts/behandelaar.'
        : '';
  });

})();

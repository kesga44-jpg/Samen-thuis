import { parseDate } from './utils.js';

export const QUESTIONS = [
  'Wat gaf je vandaag onverwacht veel energie?',
  'Welke kleine gewoonte van ons waardeer je het meest?',
  'Waar kijk je deze week samen het meest naar uit?',
  'Wat zou je graag vaker samen doen zonder dat het veel hoeft te kosten?',
  'Wanneer voelde jij je deze week echt gezien?',
  'Wat kunnen we morgen doen om de dag fijner te maken?',
  'Welke herinnering aan ons maakt je direct aan het lachen?',
  'Wat is iets kleins waar je op dit moment trots op bent?',
  'Welke plek zouden we samen nog eens willen ontdekken?',
  'Wat heb je vandaag nodig: rust, hulp, aandacht of iets anders?',
  'Welke maaltijd zouden we binnenkort samen willen maken?',
  'Wat vind je fijn aan hoe we ons huis samen maken?',
  'Welke taak zou deze week eerlijker of slimmer verdeeld kunnen worden?',
  'Wat was het mooiste moment van je dag?',
  'Welke droom wil je de komende tijd meer ruimte geven?',
  'Wat zou een perfecte vrije ochtend voor ons zijn?',
  'Waarvoor ben je vandaag dankbaar in onze relatie?',
  'Wat wil je dat ik deze week niet vergeet?',
  'Wat is iets nieuws dat we samen zouden kunnen proberen?',
  'Welke eigenschap van de ander bewonder je?',
  'Wat helpt jou om na een drukke dag thuis te landen?',
  'Welke traditie zouden we samen willen beginnen?',
  'Wat betekent een gezellig huis voor jou?',
  'Waar kunnen we deze maand bewust tijd voor maken?',
  'Welke muziek past vandaag bij jouw stemming?',
  'Wat zou je graag leren van de ander?',
  'Welke dag uit het afgelopen jaar zou je opnieuw willen beleven?',
  'Wat kunnen we vandaag voor elkaar makkelijker maken?',
  'Waar hoop je over een jaar met ons te staan?',
  'Wat is een compliment dat je de ander vandaag wilt geven?',
  'Welke kleine verrassing zou je blij maken?'
];

export function questionForDate(date) {
  const dayNumber = Math.floor(parseDate(date).getTime() / 86400000);
  return QUESTIONS[Math.abs(dayNumber) % QUESTIONS.length];
}

export const answerText = value => (typeof value === 'string' ? value : String(value?.answer || ''));

/** Antwoorden blijven verborgen tot Kees én Daphne hebben geantwoord. */
export function questionStatus(answers = {}) {
  const kees = answerText(answers.Kees), daphne = answerText(answers.Daphne);
  return { kees: Boolean(kees), daphne: Boolean(daphne), revealed: Boolean(kees && daphne) };
}

/** Een gegeven antwoord is definitief: wijzigen na opslaan wordt geweigerd. */
export function submitAnswer(dailyAnswers, date, person, answer, now = new Date().toISOString()) {
  const text = String(answer || '').trim().slice(0, 800);
  if (!['Kees', 'Daphne'].includes(person) || !text) return false;
  const day = dailyAnswers[date] = dailyAnswers[date] || {};
  if (answerText(day[person])) return false;
  day[person] = { answer: text, answeredAt: now };
  return true;
}

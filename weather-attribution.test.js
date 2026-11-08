// Open-Meteo-licentie (CC BY 4.0): bronvermelding met link bij elke weergave van weergegevens.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
const LINK = /href="https:\/\/open-meteo\.com\/"[^>]*>Open-Meteo<\/a> \(CC BY 4\.0\)/;

test('dashboardweer, weerpagina en luchtkwaliteit tonen de Open-Meteo-bronvermelding', () => {
  const weather18 = app.slice(app.indexOf('async function weather18('), app.indexOf('async function weather18(') + 6000);
  assert.match(weather18, LINK, 'dashboardweer');
  const air = app.slice(app.indexOf('async function air24('), app.indexOf('async function air24(') + 6000);
  assert.match(air, LINK, 'luchtkwaliteit en pollen');
  assert.match(app, new RegExp('weather-attribution">Weerdata: <a ' + LINK.source), 'weerpagina');
});

test('geen API-sleutel voor Open-Meteo en de cache van 30 minuten blijft', () => {
  assert.doesNotMatch(app, /open-meteo\.com[^'"`]*apikey/i);
  assert.match(app, /Date\.now\(\) - cached\.savedAt < 30 \* 60 \* 1000/);
  assert.match(app, /Date\.now\(\)-c\.t<1800000/);
});

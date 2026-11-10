// Optioneel: NODE_PATH=<playwright-modulepad> node e2e/auto-contrast.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;
let browser;
try {
  browser = await chromium.launch();
  for (const width of [375, 768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.route(url => !url.href.startsWith(base), route => route.abort());
    const page = await context.newPage();
    await page.goto(base);
    for (const theme of ['light', 'dark']) {
      for (const palette of ['lavender', 'ocean', 'forest', 'sunset']) {
        await page.goto(base + '#/settings/profiel');
        await page.locator(`[data-color-preset="${palette}"]`).waitFor({ state: 'attached' });
        await page.evaluate(({ theme, palette }) => {
          document.querySelector(`[data-color-preset="${palette}"]`).click();
          window.SamenThuisPersonalUi20.set({ ...window.SamenThuisPersonalUi20.get(), theme });
        }, { theme, palette });
        await page.goto(base + '#/auto24');
        await page.locator('[data-auto24-tab="fills"]').waitFor();
        await page.evaluate(() => {
          data.cars = [{ id: 'test-car', name: 'Testauto', plate: 'TEST01', isDefault: true }, { id: 'test-car-2', name: 'Tweede auto', plate: 'TEST02' }];
          data.fuelEntries = [{ id: 'test-fill', carId: 'test-car', date: new Date().toISOString().slice(0, 10), station: 'Teststation', liters: 40, total: 70, pricePerLiter: 1.75, odometer: 10000 }];
          document.querySelector('[data-auto24-tab="fills"]').click();
        });
        const measure = async selector => page.locator(selector).evaluateAll(elements => {
          function rgba(value) {
            const m = value.match(/rgba?\(([^)]+)\)/);
            if (!m) throw new Error(`Unsupported colour: ${value}`);
            const parts = m[1].split(/[, /]+/).filter(Boolean).map(Number);
            return [parts[0], parts[1], parts[2], parts[3] ?? 1];
          }
          function blend(fg, bg) {
            return fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3])).concat(1);
          }
          function luminance(rgb) {
            return rgb.slice(0, 3).map(v => {
              const c = v / 255;
              return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
          }
          function ratio(fg, bg) {
            const a = luminance(fg), b = luminance(bg);
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          }
          return elements.map(el => {
            const style = getComputedStyle(el);
            let bg = [255, 255, 255, 1];
            const layers = [];
            for (let node = el; node; node = node.parentElement) {
              const s = getComputedStyle(node);
              if (s.backgroundImage !== 'none') throw new Error(`Unexpected background image on ${node.className}`);
              layers.push(rgba(s.backgroundColor));
              if (layers.at(-1)[3] === 1) break;
            }
            for (const layer of layers.reverse()) bg = blend(layer, bg);
            const fg = blend(rgba(style.webkitTextFillColor), bg);
            return { text: el.textContent.trim(), ratio: ratio(fg, bg), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height };
          });
        });
        const check = (entries, label) => {
          assert.ok(entries.length, `${width}/${theme}/${palette}: missing ${label}`);
          for (const entry of entries) {
            assert.ok(entry.ratio >= 4.5, `${width}/${theme}/${palette}: ${label} ${entry.text}: ${entry.ratio.toFixed(2)}:1`);
            assert.ok(entry.width >= 44 && entry.height >= 44, `${width}/${theme}/${palette}: ${label} touch target`);
          }
        };
        check(await measure('[data-auto24-edit]'), 'Bewerk');
        await page.locator('[data-auto24-edit]').hover();
        check(await measure('[data-auto24-edit]'), 'Bewerk hover');
        await page.keyboard.press('Tab');
        await page.locator('[data-auto24-edit]').focus();
        assert.notEqual(await page.locator('[data-auto24-edit]').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
        await page.locator('[data-auto24-edit]').click();
        assert.equal(await page.locator('[data-fuel24-form][data-edit-id="test-fill"]').count(), 1);
        await page.locator('[data-auto24-tab="stats"]').click();
        for (const period of ['week', 'month', 'year']) {
          await page.locator(`[data-auto24-period="${period}"]`).click();
          check(await measure('[data-auto24-period], [data-auto24-allcars]'), `filters ${period}`);
          await page.locator(`[data-auto24-period="${period}"]`).hover();
          check(await measure(`[data-auto24-period="${period}"]`), `filter ${period} hover`);
        }
        await page.locator('[data-auto24-statcar="test-car-2"]').uncheck();
        check(await measure('[data-auto24-allcars]'), 'Alle auto’s inactief');
        await page.locator('[data-auto24-allcars]').click();
        check(await measure('[data-auto24-allcars]'), 'Alle auto’s actief');
        const hero = await page.locator('.stats-hero24').evaluate(el => ({
          gradient: getComputedStyle(el).backgroundImage,
          overlay: getComputedStyle(el.firstElementChild).backgroundColor,
          colors: [...el.querySelectorAll('small, strong')].map(e => ({ color: getComputedStyle(e).webkitTextFillColor, opacity: getComputedStyle(e).opacity }))
        }));
        const gradientColors = [...hero.gradient.matchAll(/rgb\((\d+), (\d+), (\d+)\)/g)].map(m => m.slice(1).map(Number));
        assert.equal(gradientColors.length, 2, hero.gradient);
        const alpha = Number(hero.overlay.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1] || 0);
        for (const color of gradientColors) {
          const lum = color.map(v => (v * (1 - alpha) + 255 * alpha) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
          assert.ok(1.05 / (lum + 0.05) >= 4.5, `${width}/${theme}/${palette}: gradient contrast`);
        }
        assert.ok(hero.colors.every(c => c.color === 'rgb(255, 255, 255)' && c.opacity === '1'), `${width}/${theme}/${palette}: hero text`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}/${theme}/${palette}: horizontal overflow`);
        if (process.env.E2E_SHOTS && palette === 'lavender') await page.screenshot({ path: path.join(process.env.E2E_SHOTS, `auto-stats-${width}-${theme}.png`), fullPage: true });
      }
    }
    await context.close();
  }
  console.log('Auto-contrast: 3 breedtes × 2 thema’s × 4 kleurenpaletten geslaagd.');
} finally {
  if (browser) await browser.close();
  server.close();
}

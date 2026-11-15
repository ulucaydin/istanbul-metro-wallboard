import { expect, test } from '@playwright/test';
import { POLL_INTERVAL } from '../src/notices.js';

const displays = [[1920, 1080], [1366, 768], [1080, 1920], [390, 844]];

async function checkMap(page) {
  await expect(page.locator('.network-svg')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const result = await page.evaluate(() => {
    const viewport = document.getElementById('map-viewport').getBoundingClientRect();
    const boxes = [...document.querySelectorAll('[data-station-label]')].map(node => node.getBoundingClientRect());
    const clipping = boxes.some(box => box.left < viewport.left - 1 || box.right > viewport.right + 1
      || box.top < viewport.top - 1 || box.bottom > viewport.bottom + 1);
    const overlapping = boxes.some((a, index) => boxes.slice(index + 1).some(b =>
      Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.75
      && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.75));
    return {
      clipping, overlapping, labels: boxes.length,
      stops: document.querySelectorAll('[data-station]').length,
      overflow: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(result).toMatchObject({ clipping: false, overlapping: false, stops: 157, overflow: false });
  expect(result.labels).toBeGreaterThanOrEqual(8);
}

for (const [width, height] of displays) {
  test(`map, largest text and focused route at ${width}×${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('#notice-state')).toHaveText('Published');
    await expect(page.locator('#line-count')).toHaveText('11 of 11');
    await expect(page.getByRole('heading', { name: 'Network map' })).toHaveCount(0);
    await checkMap(page);
    await page.screenshot({ path: testInfo.outputPath('default.png') });

    await page.getByRole('button', { name: 'Display settings' }).click();
    await page.getByRole('radio', { name: 'Largest' }).check();
    await page.getByRole('button', { name: 'Close settings' }).click();
    await expect(page.locator('#board')).toHaveAttribute('data-text-size', 'largest');
    await checkMap(page);
    await page.screenshot({ path: testInfo.outputPath('largest.png') });

    await page.getByRole('button', { name: /^M5 Üsküdar/ }).click();
    const route = page.getByRole('dialog');
    await expect(route.getByRole('listitem')).toHaveCount(24);
    await expect(route.getByRole('listitem').last()).toHaveText('Sultanbeyli');
    await expect(route.getByRole('listitem').filter({ hasText: 'Dudullu' })).toContainText('M8');
    await page.screenshot({ path: testInfo.outputPath('focused.png') });
    await page.keyboard.press('Escape');
    await expect(route).toBeHidden();
    expect(errors).toEqual([]);
  });

  test(`Metroboard finishes and layouts fit ${width}×${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const settings = page.getByRole('button', { name: 'Display settings' });
    const map = page.getByRole('img', { name: 'Metroboard view of Istanbul rail' });
    for (const mapOnly of [false, true]) {
      for (const finish of ['Light', 'Dark']) {
        await settings.click();
        await page.getByRole('radio', { name: 'Metroboard view' }).check();
        await page.getByRole('checkbox', { name: 'Map-only view' }).setChecked(mapOnly);
        await page.getByRole('radio', { name: finish, exact: true }).check();
        await page.getByRole('radio', { name: 'Largest', exact: true }).check();
        await page.getByRole('button', { name: 'Close settings' }).click();
        await expect(map).toBeVisible();
        await expect(map.locator('.geographic-land, .geographic-coast')).toHaveCount(0);
        await expect(map.locator('.station-lens')).toHaveCount(344);
        await expect(page.locator('html')).toHaveAttribute('data-finish', finish.toLowerCase());
        await checkMap(page);
        await page.screenshot({ path: testInfo.outputPath(`${mapOnly ? 'map-only' : 'dashboard'}-${finish}.png`) });
      }
    }
    await page.reload();
    await expect(map).toBeVisible();
    await expect(page.locator('#board')).toHaveAttribute('data-map-only', '');
    await expect(page.locator('html')).toHaveAttribute('data-finish', 'dark');
  });
}

test('map controls hide after inactivity and reappear for pointer, touch, and keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.goto('/');
  const navigation = page.locator('.map-navigation');
  await expect(navigation).toHaveCSS('opacity', '1');
  await page.clock.fastForward(7000);
  await expect(navigation).toHaveCSS('opacity', '0');
  await page.mouse.move(300, 300);
  await expect(navigation).toHaveCSS('opacity', '1');
  await page.clock.fastForward(7000);
  await expect(navigation).toHaveCSS('opacity', '0');
  await page.locator('#map-zoom-in').focus();
  await expect(navigation).toHaveCSS('opacity', '1');
  await page.clock.fastForward(7000);
  await expect(navigation).toHaveCSS('opacity', '1');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeFocused();
  await page.locator('#map-viewport').focus();
  await page.clock.fastForward(7000);
  await expect(navigation).toHaveCSS('opacity', '0');
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' })));
  await expect(navigation).toHaveCSS('opacity', '1');
});

test('map credits collapse after startup and can be reopened with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const time = new Date('2026-11-11T20:00:00Z');
  await page.clock.install({ time });
  await page.clock.pauseAt(new Date(time.getTime() + 1000));
  await page.goto('/');
  const credit = page.getByRole('link', { name: '© OpenStreetMap contributors' });
  await expect(credit).toBeVisible();
  await expect(page.locator('.map-legend')).not.toContainText('OpenStreetMap');
  await page.clock.fastForward(5000);
  await expect(credit).toBeHidden();
  await page.locator('#map-credits summary').press('Enter');
  await expect(credit).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  await expect(page.getByRole('link', { name: 'Download ODbL geographic data' })).toBeVisible();
});

test('Metroboard materials and grains persist and preserve the running simulation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const settings = page.getByRole('button', { name: 'Display settings' });
  await settings.click();
  const panel = page.locator('#metal-options');
  await expect(panel).toBeHidden();
  await page.getByRole('radio', { name: 'Metroboard view' }).check();
  await expect(panel).toBeVisible();
  const material = page.getByLabel('Material');
  const grain = page.getByLabel('Grain');
  await expect(material).toHaveValue('aluminum');
  await expect(grain).toHaveValue('fine');
  await page.getByLabel('Simulation time').selectOption('rush');
  await page.getByRole('button', { name: 'Start simulation' }).click();
  const status = page.locator('#tracking-message');
  await expect(status).toHaveText('Simulation · 08:20 TRT');
  const card = page.locator('.map-card');
  const viewport = page.locator('#map-viewport');
  const initialBackground = await viewport.evaluate(node => getComputedStyle(node).backgroundImage);
  await settings.click();
  await material.selectOption('brass');
  await grain.selectOption('vertical');
  await expect(card).toHaveAttribute('data-material', 'brass');
  await expect(card).toHaveAttribute('data-grain', 'vertical');
  expect(await viewport.evaluate(node => getComputedStyle(node).backgroundImage)).not.toBe(initialBackground);
  await page.getByRole('radio', { name: 'Dark', exact: true }).check();
  const darkBrass = await viewport.evaluate(node => getComputedStyle(node).getPropertyValue('--metal-base').trim());
  await material.selectOption('copper');
  expect(await viewport.evaluate(node => getComputedStyle(node).getPropertyValue('--metal-base').trim())).not.toBe(darkBrass);
  await grain.selectOption('coarse');
  expect(await viewport.evaluate(node => getComputedStyle(node).backgroundSize)).toContain('2048px 1024px');
  await grain.selectOption('smooth');
  expect(await viewport.evaluate(node => getComputedStyle(node).backgroundImage)).not.toContain('brushed-metal.svg');
  await grain.selectOption('vertical');
  await page.getByRole('radio', { name: 'Geographic', exact: true }).check();
  await expect(panel).toBeHidden();
  await page.getByRole('radio', { name: 'Metroboard view' }).check();
  await expect(material).toHaveValue('copper');
  await expect(grain).toHaveValue('vertical');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(status).toHaveText('Simulation · 08:20 TRT');
  await expect(page.locator('.is-approaching').first()).toBeAttached();
  await page.reload();
  await settings.click();
  await expect(material).toHaveValue('copper');
  await expect(grain).toHaveValue('vertical');
  await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
});

test('preferences survive reload and fullscreen can enter and exit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Display settings' }).click();
  await page.getByText('Individual lines', { exact: true }).click();
  await page.getByRole('checkbox', { name: /^M11 Gayrettepe/ }).uncheck();
  await page.getByRole('radio', { name: 'Large', exact: true }).check();
  await page.getByRole('button', { name: 'Enter fullscreen' }).click();
  await expect(page.getByRole('button', { name: 'Exit fullscreen' })).toBeVisible();
  await page.getByRole('button', { name: 'Exit fullscreen' }).click();
  await expect(page.getByRole('button', { name: 'Enter fullscreen' })).toBeVisible();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.locator('#line-count')).toHaveText('10 of 11');
  await expect(page.locator('[data-station="halkali"]')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('#board')).toHaveAttribute('data-text-size', 'large');
  await expect(page.locator('#line-count')).toHaveText('10 of 11');
  await page.getByRole('button', { name: /^M2 Yenikapı/ }).click();
  await expect(page.getByRole('heading', { name: 'Seyrantepe shuttle' })).toBeVisible();
});

test('clock and date roll over at Istanbul midnight', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-11T20:59:50Z') });
  await page.clock.pauseAt(new Date('2026-11-11T20:59:55Z'));
  await page.goto('/');
  await expect(page.locator('#clock-time')).toHaveText('23:59');
  await expect(page.locator('#clock-date')).toHaveText('Wed 11 Nov');
  await page.clock.fastForward(6000);
  await expect(page.locator('#clock-time')).toHaveText('00:00');
  await expect(page.locator('#clock-date')).toHaveText('Thu 12 Nov');
});

test('a scheduled refresh rejects malformed data and recovers on reconnection', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-11T20:00:00Z') });
  await page.clock.pauseAt(new Date('2026-11-11T20:00:05Z'));
  let requests = 0;
  let malformed = false;
  await page.route('**/service-notices.json', async route => {
    requests++;
    if (malformed) await route.fulfill({ json: { invalid: true } });
    else await route.continue();
  });
  await page.goto('/');
  await expect(page.locator('#notice-state')).toHaveText('Published');
  const previous = await page.locator('#last-fetched').getAttribute('datetime');
  await page.getByRole('button', { name: 'Notice details' }).click();
  await expect(page.getByRole('dialog').getByText('27 Apr 2026')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Original notice' })).toHaveAttribute('href', /^https:\/\/metro\.istanbul\//);
  await page.keyboard.press('Escape');

  malformed = true;
  await page.clock.fastForward(POLL_INTERVAL + 1000);
  await expect(page.locator('#notice-state')).toHaveText('Delayed');
  await expect(page.locator('#last-fetched')).toHaveAttribute('datetime', previous);
  expect(requests).toBe(2);

  malformed = false;
  await page.evaluate(() => {
    for (let index = 0; index < 8; index++) window.dispatchEvent(new Event('online'));
  });
  await expect(page.locator('#notice-state')).toHaveText('Published');
  await expect(page.locator('#last-fetched')).not.toHaveAttribute('datetime', previous);
  expect(requests).toBe(3);
  await page.clock.fastForward(POLL_INTERVAL + 1000);
  await expect.poll(() => requests).toBe(4);
});

test('cold failure, offline reload and recovery distinguish cached notices from fresh fetches', async ({ page, context }) => {
  await page.route('**/service-notices.json', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#notice-state')).toHaveText('Unavailable');
  await expect(page.locator('#last-fetched')).toHaveText('—');

  await page.unroute('**/service-notices.json');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('#notice-state')).toHaveText('Published');
  const previous = await page.locator('#last-fetched').getAttribute('datetime');
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await expect(page.locator('#notice-state')).toHaveText('Delayed');
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('.network-svg')).toBeVisible();
  await expect(page.locator('#notice-state')).toHaveText('Delayed');
  await expect(page.locator('#last-fetched')).toHaveAttribute('datetime', previous);

  await context.setOffline(false);
  await expect(page.locator('#notice-state')).toHaveText('Published');
  await expect(page.locator('#last-fetched')).not.toHaveAttribute('datetime', previous);
});

test('custom Istanbul day and time update service, advance, and handle invalid input', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-11T12:00:00Z') });
  await page.goto('/');
  const settings = page.getByRole('button', { name: 'Display settings' });
  await settings.click();
  const scenario = page.getByLabel('Simulation time');
  await scenario.selectOption('custom');
  const time = page.getByLabel('Istanbul time', { exact: true });
  const day = page.getByLabel('Istanbul day');
  await time.fill('');
  await expect(page.getByText('Enter a valid Istanbul time.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start simulation' })).toBeDisabled();
  await time.fill('08:20');
  await page.getByRole('button', { name: 'Start simulation' }).click();
  await expect(page.locator('#tracking-message')).toHaveText('Simulation · Mon 08:20 TRT');
  await expect(page.locator('[data-lit]').first()).toBeAttached();
  await page.clock.fastForward(60_000);
  await expect(page.locator('#tracking-message')).toHaveText('Simulation · Mon 08:21 TRT');
  await settings.click();
  await time.fill('01:20');
  await expect(page.locator('#tracking-message')).toHaveText('Simulation · Mon 01:20 TRT · No active trains');
  await day.selectOption('6');
  await expect(page.locator('#tracking-message')).toHaveText('Simulation · Sun 01:20 TRT');
  await expect(page.locator('[data-lit]').first()).toBeAttached();
  await time.fill('');
  await expect(page.getByRole('button', { name: 'Stop simulation' })).toBeEnabled();
  await page.getByRole('button', { name: 'Stop simulation' }).click();
  await expect(page.locator('#tracking-message')).toHaveText('Train tracking unavailable');
  await settings.click();
  await scenario.selectOption('rush');
  await expect(page.locator('#simulation-custom')).toBeHidden();
  await page.getByRole('button', { name: 'Start simulation' }).click();
  await expect(page.locator('#tracking-message')).toHaveText('Simulation · 08:20 TRT');
});

test('simulation starts from settings, pulses station lamps, and can be stopped', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('.network-svg')).toBeVisible();
  await expect(page.locator('[data-lit]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start simulation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Display settings' }).click();
  await page.getByRole('radio', { name: 'Dark' }).check();
  await page.getByLabel('Simulation time').selectOption('rush');
  await page.getByRole('button', { name: 'Start simulation' }).click();
  await expect(page.locator('#tracking-message')).toHaveText('Simulation · 08:20 TRT');
  await expect(page.locator('#approach-legend')).toBeVisible();
  await expect(page.locator('[data-lit]').first()).toBeVisible();
  const pulse = page.locator('.station-lamp.is-approaching').first();
  await expect(pulse).toHaveCSS('animation-name', 'lamp-pulse');
  await expect(page.locator('[data-simulated-train]')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(pulse).toHaveCSS('animation-name', 'none');
  await expect(pulse).toHaveCSS('opacity', '0.55');
  await page.getByRole('button', { name: 'Display settings' }).click();
  await page.getByRole('button', { name: 'Stop simulation' }).click();
  await expect(page.locator('[data-lit], .is-approaching')).toHaveCount(0);
  await expect(page.locator('#tracking-message')).toHaveText('Train tracking unavailable');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-finish', 'dark');
  await expect(page.locator('[data-lit]')).toHaveCount(0);
});

test('the next station pulses in transit, lights steadily on arrival, and hands off on departure', async ({ page }) => {
  const start = new Date('2026-11-11T05:19:55Z');
  await page.clock.install({ time: new Date(start.getTime() - 1000) });
  await page.clock.pauseAt(start);
  await page.goto('/');
  await page.clock.runFor(100);
  await page.getByRole('button', { name: 'Display settings' }).click();
  await page.getByRole('button', { name: 'Start simulation' }).click();

  const levent = page.locator('[data-lamp-platform="M6/levent"]');
  const nispetiye = page.locator('[data-lamp-platform="M6/nispetiye"]');
  const etiler = page.locator('[data-lamp-platform="M6/etiler"]');
  await expect(levent).toHaveClass('station-lamp is-lit');

  await page.clock.fastForward(25_000);
  await expect(levent).toHaveClass('station-lamp');
  await expect(levent).toHaveCSS('opacity', '0');
  await expect(nispetiye).toHaveClass('station-lamp is-lit is-approaching');
  await expect(nispetiye).toHaveCSS('animation-name', 'lamp-pulse');

  await page.clock.fastForward(100_000);
  await expect(nispetiye).toHaveClass('station-lamp is-lit');
  await expect(nispetiye).toHaveCSS('animation-name', 'none');

  await page.clock.fastForward(50_000);
  await expect(nispetiye).toHaveClass('station-lamp');
  await expect(etiler).toHaveClass('station-lamp is-lit is-approaching');

  await page.clock.setSystemTime(new Date('2026-11-11T00:05:00Z'));
  await page.clock.fastForward(1000);
  await expect(page.locator('#tracking-message')).toHaveText('Simulation · 03:05 TRT · No active trains');
  await expect(page.locator('[data-lit], .is-approaching')).toHaveCount(0);
});

test('an enabled feed lights explicit destinations and clears expired observations', async ({ page }) => {
  const start = Date.parse('2026-11-11T19:00:00Z');
  const timestamp = offset => new Date(start + offset).toISOString();
  await page.clock.install({ time: start });
  await page.route('**/tracking-config.json', route => route.fulfill({ json: { enabled: true } }));
  let unreachable = false;
  let arrived = false;
  await page.route('**/station-occupancy.json', route => unreachable
    ? route.fulfill({ status: 503 })
    : route.fulfill({ json: {
      observedAt: timestamp(0),
      coveredLines: ['M4'],
      positions: [
        { stationId: 'kadikoy', lineId: 'M4', status: 'STOPPED_AT', observedAt: timestamp(0) },
        { stationId: 'ayrilik', lineId: 'M4', status: 'STOPPED_AT', observedAt: timestamp(-35_000) },
        { stationId: 'unalan', lineId: 'M4', status: arrived ? 'STOPPED_AT' : 'INCOMING_AT', observedAt: timestamp(0) },
      ],
    } }));
  await page.goto('/');
  await expect(page.locator('#tracking-message')).toHaveText('Live tracking · 1 of 11 lines');
  await expect(page.locator('[data-lit]')).toHaveCount(3);
  const unalan = page.locator('[data-lamp-platform="M4/unalan"]');
  await expect(unalan).toHaveClass('station-lamp is-lit is-approaching');
  await page.getByRole('button', { name: 'Display settings' }).click();
  await page.getByRole('radio', { name: 'Metroboard view' }).check();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.locator('.is-lit[data-direction="neutral"]')).toHaveCount(3);
  await expect(unalan).toHaveClass('station-lamp is-lit is-approaching');
  await expect(page.locator('.is-lit[data-direction="forward"], .is-lit[data-direction="reverse"]')).toHaveCount(0);
  arrived = true;
  await page.clock.fastForward(12_000);
  await expect(page.locator('[data-lit]')).toHaveCount(2);
  await expect(unalan).toHaveClass('station-lamp is-lit');
  await expect(page.locator('[data-station="kadikoy"][data-lit]')).toBeVisible();
  unreachable = true;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('#tracking-message')).toHaveText('Train tracking delayed');
  await expect(page.locator('[data-lit]')).toHaveCount(0);
  unreachable = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('[data-lit]')).toHaveCount(2);
  await page.clock.fastForward(45_000);
  await expect(page.locator('#tracking-message')).toHaveText('Train tracking delayed');
  await expect(page.locator('[data-lit]')).toHaveCount(0);
});

test('Metroboard hands off directional lamps and keeps the simulation running across views', async ({ page }) => {
  const start = new Date('2026-11-11T05:19:55Z');
  await page.clock.install({ time: new Date(start.getTime() - 1000) });
  await page.clock.pauseAt(start);
  await page.goto('/');
  await page.clock.runFor(100);
  const settings = page.getByRole('button', { name: 'Display settings' });
  const chooseView = async name => {
    await settings.click();
    await page.getByRole('radio', { name }).check();
    await page.getByRole('button', { name: 'Close settings' }).click();
    await page.clock.runFor(100);
  };
  await settings.click();
  await page.getByRole('radio', { name: 'Metroboard view' }).check();
  await page.getByRole('button', { name: 'Start simulation' }).click();
  await page.clock.runFor(100);
  const lamp = key => page.locator(`[data-lamp-platform="${key}"]`);
  const leventForward = lamp('M6/levent/forward');
  const nispetiyeForward = lamp('M6/nispetiye/forward');
  const hisarustuReverse = lamp('M6/hisarustu/reverse');
  const etilerReverse = lamp('M6/etiler/reverse');
  await expect(leventForward).toHaveClass('station-lamp is-lit');
  await page.clock.fastForward(7000);
  await expect(page.locator('[data-lamp-platform^="M1A/dtm/"].is-lit:not(.is-approaching)')).toHaveCount(2);
  await page.clock.fastForward(18_000);
  await expect(leventForward).toHaveClass('station-lamp');
  await expect(nispetiyeForward).toHaveClass('station-lamp is-lit is-approaching');
  await expect(lamp('M6/nispetiye/reverse')).toHaveClass('station-lamp is-lit is-approaching');
  const levent = page.locator('[data-platform="M6/levent"] [data-direction="forward"]');
  const initialX = await levent.getAttribute('cx');
  await page.mouse.move(100, 100);
  await page.clock.runFor(200);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.clock.runFor(100);
  await page.locator('#map-viewport').press('ArrowLeft');
  await page.clock.runFor(100);
  const zoomedX = await levent.getAttribute('cx');
  expect(zoomedX).not.toBe(initialX);
  await chooseView('Geographic');
  await expect(lamp('M6/nispetiye')).toHaveClass('station-lamp is-lit is-approaching');
  await chooseView('Metroboard view');
  await expect(nispetiyeForward).toHaveClass('station-lamp is-lit is-approaching');
  await expect(page.locator('#tracking-message')).toHaveText('Simulation · 08:20 TRT');
  await expect(levent).toHaveAttribute('cx', zoomedX);

  await page.clock.fastForward(35_000);
  await expect(hisarustuReverse).toHaveClass('station-lamp is-lit');
  await page.clock.fastForward(65_000);
  await expect(leventForward).toHaveClass('station-lamp');
  await expect(nispetiyeForward).toHaveClass('station-lamp is-lit');
  await expect(hisarustuReverse).toHaveClass('station-lamp');
  await expect(etilerReverse).toHaveClass('station-lamp is-lit is-approaching');
  await page.clock.fastForward(70_000);
  await expect(hisarustuReverse).toHaveClass('station-lamp');
  await expect(etilerReverse).toHaveClass('station-lamp is-lit');
  await expect(nispetiyeForward).toHaveClass('station-lamp');
  await expect(lamp('M6/etiler/forward')).toHaveClass('station-lamp is-lit is-approaching');

  await settings.click();
  await page.getByRole('radio', { name: 'Solid', exact: true }).check();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.clock.fastForward(25_000);
  await expect(etilerReverse).toHaveClass('station-lamp');
  const nextReverse = lamp('M6/nispetiye/reverse');
  await expect(nextReverse).toHaveClass('station-lamp is-lit is-approaching');
  await expect(nextReverse).toHaveCSS('animation-name', 'none');
  await expect(nextReverse).toHaveCSS('opacity', '1');
  await page.reload();
  await settings.click();
  await expect(page.getByRole('radio', { name: 'Solid', exact: true })).toBeChecked();
});

test('map-only fills the screen, keeps settings, and labels active simulation', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Display settings' }).click();
  await page.getByRole('checkbox', { name: 'Map-only view' }).check();
  await page.getByRole('radio', { name: 'Dark' }).check();
  await page.getByLabel('Simulation time').selectOption('rush');
  await page.getByRole('button', { name: 'Start simulation' }).click();
  await expect(page.getByRole('banner')).toBeHidden();
  await expect(page.getByRole('contentinfo')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Service notices' })).toBeHidden();
  expect(await page.locator('.map-card').boundingBox()).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  await expect(page.locator('#map-mode-status')).toHaveText('Simulation · 08:20 TRT');
  await expect(page.locator('.is-approaching').first()).toBeVisible();
  await expect(page.locator('[data-lit]').first()).toBeVisible();
  await checkMap(page);
  const gear = page.getByRole('button', { name: 'Display settings' });
  await expect(gear).toBeVisible();
  await gear.click();
  await page.getByRole('checkbox', { name: 'Map-only view' }).uncheck();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.locator('#tracking-message')).toHaveText('Simulation · 08:20 TRT');
  await expect(page.locator('.is-approaching').first()).toBeVisible();
  await gear.click();
  await page.getByRole('checkbox', { name: 'Map-only view' }).check();
  await page.getByRole('button', { name: 'Stop simulation' }).click();
  await expect(page.locator('[data-lit], .is-approaching')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#board')).toHaveAttribute('data-map-only', '');
  await expect(page.locator('#map-mode-status')).toHaveText('Train tracking unavailable');
  await page.setViewportSize({ width: 390, height: 844 });
  await checkMap(page);
  expect(await page.locator('.map-card').boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  await expect(gear).toBeVisible();

});

test('map draws corrected paths, transfer types and key labels', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const m3 = page.locator('.track[data-route="M3"]');
  await expect(m3).toHaveCount(1);
  await expect(m3).toHaveAttribute('data-stops', /kirazli yenimahalle-m3 mahmutbey istoc ikitelli turgut-ozal/);
  await expect(page.locator('.track[data-route="M9"]')).toHaveAttribute('data-stops', /^atakoy yenibosna cobancesme /);
  await expect(page.locator('[data-station="yenibosna"]')).toHaveAttribute('data-interchange', 'metro');
  await expect(page.locator('[data-station="cobancesme"]')).toHaveAttribute('data-interchange', 'none');
  await expect(page.locator('[data-station="taksim"]')).toHaveAttribute('data-interchange', 'transit');
  await expect(page.locator('[data-station="sanayi"]')).toHaveAttribute('data-interchange', 'branch');
  const link = page.locator('[data-interchange-link="kayasehir kayasehir-merkez"]');
  expect(await link.evaluate(node => node.x2.baseVal.value - node.x1.baseVal.value)).toBeLessThan(35);
  for (const [id, name] of Object.entries({
    ataturk: 'Atatürk Havalimanı', 'istanbul-airport': 'İstanbul Havalimanı',
    mahmutbey: 'Mahmutbey', yenibosna: 'Yenibosna', cobancesme: 'Çobançeşme',
    taksim: 'Taksim', sanayi: 'Sanayi Mahallesi', yildiztepe: 'Yıldıztepe',
    'sancaktepe-hospital': 'Sancaktepe Şehir Hastanesi', 'kayasehir-merkez': 'Kayaşehir Merkez',
  })) await expect(page.locator('[data-station-label="' + id + '"]')).toHaveText(name);
});

test('transport layers can be combined and every rail path passes through its station centers', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  const settings = page.getByRole('button', { name: 'Display settings' });
  await settings.click();
  for (const name of ['Marmaray', 'Tram', 'Funicular & Tünel', 'Sirkeci local rail']) {
    await page.getByRole('checkbox', { name, exact: true }).check();
  }
  await page.getByLabel('Simulation time').selectOption('rush');
  await page.getByRole('button', { name: 'Start simulation' }).click();
  await expect(page.locator('[data-station]')).toHaveCount(280);
  await expect(page.locator('#line-count')).toHaveText('22 of 22');
  await expect(page.locator('[data-lamp-platform^="B1/"].is-lit').first()).toBeVisible();
  const offTrack = await page.locator('.track').evaluateAll(paths => paths.flatMap(path => {
    const points = [];
    const length = path.getTotalLength();
    for (let step = 0; step < length; step += .5) points.push(path.getPointAtLength(step));
    points.push(path.getPointAtLength(length));
    return path.dataset.stops.split(' ').filter(id => {
      const lens = document.querySelector('[data-platform="' + path.dataset.route + '/' + id + '"] .station-lens');
      return !points.some(point => Math.hypot(lens.cx.baseVal.value - point.x, lens.cy.baseVal.value - point.y) < 1.25);
    });
  }));
  expect(offTrack).toEqual([]);
  await settings.click();
  await page.getByRole('radio', { name: 'Metroboard view' }).check();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.locator('.engraved-track')).toHaveCount(43);
  await expect(page.locator('.engraved-track[data-route="T3"]')).toHaveCount(1);
  await expect(page.locator('[data-platform^="T3/"] .station-lens[data-direction="reverse"]')).toHaveCount(0);
  await expect(page.locator('[data-platform="M2/sanayi/shuttle"] .station-lens')).toHaveCount(2);
  await expect(page.locator('[data-bezel-platforms~="M2/sanayi"][data-bezel-platforms~="M2/sanayi/shuttle"]')).toHaveCount(1);
  await expect(page.locator('[data-platform="M1A/aksaray"] .station-lens')).toHaveCount(2);
  await expect(page.locator('[data-lamp-platform="M1A/aksaray/reverse"]')).toHaveAttribute('data-platform-aliases', 'M1B/aksaray/reverse');
  await expect(page.locator('[data-interchange-link="kayasehir kayasehir-merkez"]')).toHaveCount(1);
  await expect(page.locator('[data-lamp-platform^="B1/"].is-lit').first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('[data-station]')).toHaveCount(280);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await settings.click();
  await page.getByRole('checkbox', { name: 'Metro', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await expect(page.locator('.track[data-mode="metro"]')).toHaveCount(0);
  await expect(page.locator('.engraved-track[data-mode="marmaray"]')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('#line-count')).toHaveText('11 of 11');
  await expect(page.locator('.track[data-mode="metro"]')).toHaveCount(0);
  await expect(page.locator('.engraved-track[data-mode="funicular"]')).toHaveCount(8);
});

test('geographic zoom retains color on the platform lamp while it fades', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await expect(page.locator('.geographic-coast').first()).toBeAttached();
  const lens = page.locator('[data-platform="M4/kadikoy"] .station-lens');
  const initial = await lens.getAttribute('cx');
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(lens).not.toHaveAttribute('cx', initial);
  await page.getByRole('button', { name: 'Fit routes' }).click();
  await expect(lens).toHaveAttribute('cx', initial);
  await page.getByRole('button', { name: 'Display settings' }).click();
  await page.getByLabel('Simulation time').selectOption('rush');
  await page.getByRole('button', { name: 'Start simulation' }).click();
  const active = page.locator('.is-lit[data-lamp-platform]:not(.is-approaching)').first();
  await expect(active).toHaveCSS('opacity', '1');
  const id = await active.getAttribute('data-lamp-platform');
  const lamp = page.locator('[data-lamp-platform="' + id + '"]');
  const fill = await lamp.locator('.lamp-core').evaluate(node => getComputedStyle(node).fill);
  expect(fill).not.toBe('rgb(0, 0, 0)');
  await page.getByRole('button', { name: 'Display settings' }).click();
  await page.getByRole('button', { name: 'Stop simulation' }).click();
  await expect(lamp).toHaveCSS('opacity', '0');
  await expect(lamp.locator('.lamp-core')).toHaveCSS('fill', fill);
  await expect(page.locator('.is-lit')).toHaveCount(0);
});

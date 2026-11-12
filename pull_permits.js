// Look up town permit records for Westchester referrals on CitySquared (Municity), into data/permits.json.
//
// Run: node pull_permits.js [maxAgeDays]     (default 6: re-check a referral at most this often), then python3 build.py
//
// Seven municipalities show permit applications, permits and certificates of occupancy on their public
// CitySquared property page without a login. This opens that page in a browser, searches each referral's
// address the way a person would, opens the matching parcel and keeps what the page loads for it.
// Only referral addresses are looked up, one at a time with a pause between them.
// Needs Playwright with Chromium (npm install playwright && npx playwright install chromium).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const R = __dirname;
const MAX_AGE_DAYS = Number(process.argv[2] || 6);
const PAUSE_MS = 4000;
const LOOKBACK_DAYS = 730; // keep town records filed up to two years before the county letter
const MAX_RECS = 12; // per kind, newest first
const TENANTS = {
  'New Rochelle': 'NewRochelleCityNY',
  'North Castle': 'NorthCastleTownNY',
  'White Plains': 'WhitePlains',
  'Lewisboro': 'LewisboroTownNY',
  'Mount Kisco': 'MountKiscoVillageNY',
  'Dobbs Ferry': 'DobbsFerryVillageNY',
  'Bronxville': 'BronxvilleVillageNY',
};
const SITE = 'https://www.citysquared.com/#/app/map/';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const day = v => { const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})/); if (m) return m[1]; const d = new Date(v); return isNaN(d) ? '' : d.toISOString().slice(0, 10); };
const money = v => { const n = Number(String(v || '').replace(/[$,\s]/g, '')); return isFinite(n) && n > 0 ? Math.round(n) : 0; };
const pick = (o, keys) => { for (const k of keys) if (o[k] != null && clean(o[k])) return clean(o[k]); return ''; };

// "47 Dakin Ave, Mount Kisco, NY, 10549" -> {num:'47', street:'dakin'}
function parseAddr(a) {
  const m = clean(a).split(',')[0].match(/^(\d+[A-Za-z]?)(?:\s*-\s*\d+[A-Za-z]?)?\s+(.+)$/);
  if (!m) return null;
  const words = m[2].toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !/^(n|s|e|w|north|south|east|west|the)$/.test(w));
  return words.length ? { num: m[1].toLowerCase(), street: words[0], query: m[1] + ' ' + words[0] } : null;
}

function matches(addr, legal) {
  const l = clean(legal).toLowerCase();
  const m = l.match(/^(\d+[a-z]?)(?:\s*-\s*(\d+[a-z]?))?\s+(.*)$/);
  if (!m) return false;
  const lo = parseInt(m[1], 10), hi = m[2] ? parseInt(m[2], 10) : lo, n = parseInt(addr.num, 10);
  return n >= lo && n <= hi && m[3].includes(addr.street);
}

const dist = (a, b, c, d) => Math.hypot((a - c) * 111000, (b - d) * 84000);

function records(children, since) {
  const kinds = [
    ['A', children.Application, ['ApplicationNumber'], ['ApplicationDate', 'DateSubmitted'], ['PermitApplicationType', 'ApplicationType'], ['PermitApplicationStatus', 'Status']],
    ['P', children.Permit, ['PermitNumber', 'PermitNo', 'Number'], ['PermitDate', 'IssueDate', 'IssuedDate', 'CreatedDate'], ['PermitType', 'Type'], ['PermitStatus', 'Status']],
    ['C', children.Certificate, ['CertificateNumber', 'CertificateNo', 'Number'], ['CertificateDate', 'IssueDate', 'CreatedDate'], ['CertificateType', 'Type'], ['CertificateStatus', 'Status']],
  ];
  const out = [];
  for (const [k, list, num, date, type, status] of kinds) {
    const rows = (list || []).map(o => [k, pick(o, num), day(pick(o, date)), pick(o, type), pick(o, status),
      pick(o, ['Description', 'WorkDescription']).slice(0, 240), pick(o, ['Applicant', 'ContractorName', 'Contractor']),
      money(pick(o, ['ConstCost', 'TotalCost', 'EstimatedCost', 'BaseCost']))])
      .filter(r => r[2] && r[2] >= since)
      .sort((a, b) => b[2].localeCompare(a[2]))
      .slice(0, MAX_RECS);
    out.push(...rows);
  }
  return out;
}

async function openTenant(browser, tenant) {
  const page = await browser.newPage();
  await page.goto(SITE + tenant, { timeout: 90000 });
  await page.waitForTimeout(6000);
  return page;
}

async function searchBox(page) {
  const vis = [];
  for (const i of await page.$$('input')) if (await i.isVisible()) vis.push(i);
  if (!vis.length) throw new Error('search box not found');
  return vis[vis.length - 1]; // the first visible input is the municipality picker
}

async function lookup(page, j) {
  const addr = parseAddr(j.addr);
  if (!addr) return { s: 'no street number in the county address' };
  const box = await searchBox(page);
  await box.fill('');
  const searched = page.waitForResponse(r => /\/FilteredSearch$/.test(r.url()), { timeout: 45000 });
  await box.fill(addr.query);
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  const res = await (await searched).json();
  const seen = new Map();
  for (const group of Object.values(res)) for (const d of ((group || [])[0] || {}).Data || []) if (!seen.has(d.Parcel_ID)) seen.set(d.Parcel_ID, d);
  let cands = [...seen.values()].filter(d => matches(addr, d.LegalAddress));
  if (!cands.length) return { s: 'no parcel with this address on CitySquared' };
  if (j.lat && j.lng) cands.sort((a, b) => dist(a.Latitude, a.Longitude, j.lat, j.lng) - dist(b.Latitude, b.Longitude, j.lat, j.lng));
  const parcel = cands[0];
  await page.waitForTimeout(1500);
  const opened = page.waitForResponse(r => new RegExp('/Parcel/' + parcel.Parcel_ID + '/Children$').test(r.url()), { timeout: 45000 });
  await page.getByText(clean(parcel.PrintKey), { exact: true }).first().click();
  const children = await (await opened).json();
  if (process.env.DEBUG_KEYS) for (const k of ['Permit', 'Certificate']) if ((children[k] || [])[0]) console.log('   ', k, 'keys:', Object.keys(children[k][0]).filter(x => !/^ParcelOwner_/.test(x)).join(','));
  const since = new Date(Date.parse(j.date) - LOOKBACK_DAYS * 864e5).toISOString().slice(0, 10);
  return { s: 'ok', p: clean(parcel.PrintKey), a: clean(parcel.LegalAddress), r: records(children, since) };
}

(async () => {
  const data = JSON.parse(fs.readFileSync(path.join(R, 'data/data.json'), 'utf8'));
  const file = path.join(R, 'data/permits.json');
  const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const today = new Date().toISOString().slice(0, 10);
  const fresh = id => old[id] && old[id].c && (Date.parse(today) - Date.parse(old[id].c)) / 864e5 < MAX_AGE_DAYS;
  const only = process.env.TOWNS ? process.env.TOWNS.split(',') : null;
  const jobs = data.map(r => ({ id: r[0], town: r[3], addr: r[7], lat: r[8], lng: r[9], date: r[10] })).filter(j => TENANTS[j.town] && (!only || only.includes(j.town)));
  const todo = jobs.filter(j => !fresh(j.id));
  console.log(`${jobs.length} referrals in CitySquared towns, ${todo.length} to look up (others checked in the last ${MAX_AGE_DAYS} days)`);

  const out = {};
  for (const j of jobs) if (old[j.id]) out[j.id] = old[j.id]; // keep cached results; drop referrals no longer in the feed
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const counts = {};
  try {
    for (const town of Object.keys(TENANTS)) {
      const list = todo.filter(j => j.town === town);
      if (!list.length) continue;
      let page = await openTenant(ctx, TENANTS[town]);
      for (const j of list) {
        let got;
        try {
          got = await lookup(page, j);
        } catch (e) {
          got = { s: 'lookup failed: ' + e.message.split('\n')[0].slice(0, 120) };
          await page.close().catch(() => {});
          page = await openTenant(ctx, TENANTS[town]); // start the next lookup from a clean page
        }
        if (got.s === 'ok' || !old[j.id] || old[j.id].s !== 'ok') out[j.id] = { t: TENANTS[town], c: today, ...got };
        else out[j.id] = { ...old[j.id], c: old[j.id].c }; // keep the last good result if a re-check fails
        counts[got.s.split(':')[0]] = (counts[got.s.split(':')[0]] || 0) + 1;
        console.log(`  ${j.id} ${j.addr} -> ${got.s === 'ok' ? `${got.p}, ${got.r.length} records` : got.s}`);
        await sleep(PAUSE_MS);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    const sorted = Object.fromEntries(Object.keys(out).sort().map(k => [k, out[k]]));
    fs.writeFileSync(file, JSON.stringify(sorted));
  }
  const ok = Object.values(out).filter(v => v.s === 'ok');
  console.log(`Wrote data/permits.json: ${Object.keys(out).length} referrals, ${ok.length} matched to a parcel, ` +
    `${ok.filter(v => v.r.length).length} with town records. This run: ${JSON.stringify(counts)}`);
})();

# Construction Lead Machine: Westchester and NYC

Two pages, same idea: find private construction jobs at the earliest public moment, size each trade's slice, and show who to contact.

- `index.html`: Westchester County, from County Planning Board referrals (described below).
- `nyc.html`: New York City's five boroughs, from Department of Buildings filings (see "NYC" at the end).

## Westchester

A single-page lead tool built from Westchester County Planning Board referrals. Every town in the county must send bigger land-use cases (site plans with 5,000+ sq ft of floor area, or 10,000+ sq ft of land disturbance) to the County Planning Board, so the referral list is a county-wide feed of new construction projects, months before a building permit.

Open `index.html` in a browser. No server or build step needed to view it.

## What it does

- **Call list:** private projects with a real building (5,000+ sq ft or 5+ units), under 250,000 sq ft, filed in the last 30 days by default. Newest first, NEW tag for the last 14 days.
- **Trade picker:** GC, concrete, site work, HVAC, electrical, plumbing, roofing, windows and doors, painting. Every estimate, scope and email switches to the selected trade.
- **Project pages:** full filing description, county review comments, per-trade scope with quotes from the filing, project team found in public records, links to the filing (county PDF where attached), town contacts, and two outreach emails.
- **By town:** planning contacts and phone numbers per municipality.
- **Contact sheet:** copies the call list as CSV.

## Layout

```
index.html        built page (open this)
build.py          rebuilds index.html from src/ and data/
src/
  head.html       <head> and font links
  css.txt         styles
  body.html       page markup
  script.js       app logic (placeholders __DATA__, __EV__, __ATT__, __TEAM__, __CONTACTS__)
data/
  data.json       referral rows (see field order below)
  ev.json         zoning district and county review comments, keyed by county file id
  att.json        county file id -> [objectid, attachment id] for attached PDFs
  team.json       developer / architect / engineer found in public records (hand-researched)
  contacts.json   town building and planning phones, verified emails and pages
```

`data.json` row fields, in order: county file id, project name, reviewing board, municipality, approvals sought, floor area (sq ft), land disturbance (sq ft), address, latitude, longitude, county letter date, general land use, housing units, affordable units, commercial sq ft, description, stories, parking spaces, site acres, planning contact, contact title, contact agency.

## Refreshing the data

Source: Westchester County Department of Planning, Planning and Zoning Referrals
(`Westchester_County_Referrals_2_view` ArcGIS feature service; layer 0 = referrals, table 2 = county comments).

The feed is pulled for the last 12 months of county letter dates, keeping site plans, subdivisions, special permits and use variances with real scope. After replacing the files in `data/`, update `PULLED` and `TODAY` at the top of `src/script.js`, then run:

```
python3 build.py
```

## Estimates

Referrals carry no construction cost. Value = floor area x hard cost per sq ft (default $450, adjustable on the Call list tab). Each trade is a rule-of-thumb share of hard cost; site work has a floor of $12 per sq ft of disturbed land. Scope lines not stated in the filing are tagged "typical, not stated". These are for qualifying leads, not for bidding.

## NYC

`nyc.html` is built from two NYC Open Data datasets (Socrata API, no key needed):

- `w9ak-ipjd` DOB NOW: Build – Job Application Filings: the lead. Owner, architect or engineer, filing representative, size, units, filed cost, description, live status.
- `rbx6-tga4` DOB NOW: Build – Approved Permits: names the general contractor once one holds a permit.
- `t8hj-ruu2` DOB License Info: the business phone and email that general contractors and filing representatives registered with DOB. Owners, architects and engineers have no published contact.

Refresh (needs network access to `data.cityofnewyork.us`):

```
python3 pull_nyc.py        # last 180 days; pass a number for a different window
python3 build.py
```

`pull_nyc.py` keeps initial filings (`-I1`) for New Building and Alteration-CO jobs, plus plain Alterations with a filed cost of $500,000 or more, and writes `data/nyc.json`. Set `NYC_APP_TOKEN` to avoid rate limits. The page computes "days ago" from the real date and warns when the pull is more than 3 days old.

How the NYC page differs from Westchester:

- **Stage is real.** Filed, in plan review, approved, permit issued, signed off, from the DOB status.
- **The owner is in the record.** Touch 1 goes to the owner; Touch 2 goes to the architect or engineer, or to the GC if one is on a permit.
- **Value.** Alterations use the cost filed with DOB (often understated). New buildings have no filed cost, so they use floor area x cost per sq ft (default $500).
- **Units.** A plain alteration reports the whole building's units, so only units a job adds are counted.
- **Cuts.** Private owner and not withdrawn; 5,000+ sq ft, 5+ new units or $500K+ filed cost; under 250,000 sq ft and $50M; filed in the chosen window and not signed off. Borough and stage filters sit on top.
- **Cost tiers.** The base cost per sq ft is scaled 75% for 1 to 3 family houses and 115% for 7+ stories.
- **Since last visit.** The browser remembers the last visit date and marks jobs filed since.
- **Repeat players tab.** Owners, design firms and GCs with more than one job on the call list.

Source files: `src/nyc_body.html`, `src/nyc_script.js` (placeholder `__NYC__`); head and styles are shared with Westchester.

### Daily refresh and hosting

`.github/workflows/refresh.yml` pulls the NYC data every morning, rebuilds both pages and publishes them with GitHub Pages. It runs once the file is on `main` and Settings -> Pages -> Source is set to "GitHub Actions". A Pages site is public. Nothing is committed back to the repo, so `data/nyc.json` and `nyc.html` in git are only as fresh as the last manual pull.

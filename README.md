# Westchester Construction Lead Machine

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

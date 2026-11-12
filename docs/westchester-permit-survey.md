# Westchester permit and planning-record survey

Surveyed 12 Nov 2026. Covers the 12 municipalities that hold two-thirds of the county referrals, plus every other town found on the same permit platform. The aim is to find, for each town, where building permits and planning board records can be read, and whether a script can read them.

## Headline

**One vendor covers most of the county.** Municity (sold to towns as *CitySquared*) runs permitting for 15 Westchester municipalities. In 7 of them the public property search on citysquared.com shows each parcel's permit applications, permits and certificates of occupancy **without logging in**. Each record has a number, date, type, status, description and construction cost, and sometimes the applicant (often the architect).

Example: referral NRO-26-018 (1 Beech Road, New Rochelle) shows Planning Board application PB 25-2026 and building application 4677-2026, filed 15 Sep 2026 by Rick Yestadt AIA, for $900,000 of work.

Those 7 towns hold 53 of the 177 referrals, and 27 of the 93 that meet the call-list size cut (5,000+ sq ft or 5+ units).

## Top municipalities

"Referrals" is from the 12-month pull of 11 Nov 2026.

| Municipality | Referrals | Permit system | Permits public? | Planning board agendas / minutes | Notes |
|---|---|---|---|---|---|
| Yonkers | 25 | Municity ("City of Yonkers Connect") | **No.** Owner and parcel only | Not found (city site blocks cloud traffic) | Yonkers IDA posts agendas and board packets at yonkersida.com |
| North Castle | 18 | Municity | **Yes** | Not confirmed (town site blocks cloud traffic) | Test parcel showed 22 applications, 80 permits, 51 certificates |
| New Rochelle | 15 | Municity | **Yes**, with applicant and cost | Not found on city site (blocked); third-party meeting summaries exist | Also a Schneider "Beacon" property portal, behind Cloudflare bot protection |
| Greenburgh | 12 | None found online | No. "Building Record Search Requests" form | AgendaQuick (agendaquick.greenburghny.com) | Town posts **Active Applications** pages for the Planning Board, Town Board and ZBA, with case files |
| White Plains | 8 | Municity | **Yes** | CivicPlus AgendaCenter (/agendacenter) | 275 Main St showed 2026 Common Council site plan applications. "Open Permit Status Request" PDF form also exists |
| New Castle | 7 | None found online | No | eCode360 documents (ecode360.com/documents/pub/NE0395/Agendas/) | |
| Mount Vernon | 6 | Not confirmed | Unknown | CivicPlus AgendaCenter | City launched an AI help tool for the Buildings Department; no public search found |
| Port Chester | 6 | Accela Citizen Access | **Login required** (free account) | CivicClerk (portchesterny.portal.civicclerk.com) | Accela also has Planning and Zoning modules |
| Eastchester | 6 | None found online | No | Own pages (/how_do_i/find/agenda.php, minutes.php) | Runs a Laserfiche forms server (lfweb.eastchester.org) |
| North Salem | 5 | Not checked | Unknown | Granicus (northsalem.granicus.com) | |
| Briarcliff Manor | 5 | Not checked | Unknown | CivicPlus AgendaCenter | |
| Lewisboro | 5 | Municity | **Yes** | Not confirmed (town site blocks cloud traffic) | |

## Other Municity towns

| Municipality | Referrals | Permits public? |
|---|---|---|
| Mount Kisco | 4 | Yes |
| Dobbs Ferry | 2 | Yes |
| Bronxville | 1 | Yes |
| Yorktown | 4 | No (owner and parcel only) |
| Ossining Village | 3 | Unverified (test address did not match) |
| Mamaroneck Village | 3 | No data shown on test parcel |
| Bedford | 2 | No data shown on test parcel |
| Rye City | 1 | Inconclusive (parcel records open, but the test parcel had no permits) |
| Scarsdale, Pelham Village | 0 | Not tested |

## Sources that work across towns

- **Westchester County referrals.** Automated in `pull_westchester.py`.
- **Industrial Development Agency packets.** Yonkers IDA publishes agendas, minutes and board packets as PDFs. These carry project cost and developer for the biggest jobs.
- **Third-party meeting summaries.** Citizen Portal (citizenportal.ai / cp.soar.com) writes up planning board meetings, and GatherGov lists development news by municipality. Already used by hand for `team.json`. These are good for finding cases but should be checked against the town's own records.

## How the Municity lookup works

The site at `citysquared.com/#/app/map/<Tenant>` loads a single-page app that calls `services3.municity5.com/M5Services/M5Service.svc/Customer/<Tenant>/...`:

1. `FilteredSearch` (POST) with an address, owner name or section-block-lot returns matching parcels and their `Parcel_ID`.
2. `Parcel/<id>/Children` returns that parcel's `Application`, `Permit`, `Certificate` and other lists.

The list of tenants is public at `municity5.com/M5Services/M5Service.svc/Service/3018/Tenants`. Tenant names: NewRochelleCityNY, NorthCastleTownNY, WhitePlains, LewisboroTownNY, MountKiscoVillageNY, DobbsFerryVillageNY, BronxvilleVillageNY, Yonkers, YorktownTownNY, OssiningVillageNY, MamaroneckVillageNY, BedfordTownNY, RyeCity, ScarsdaleVillageNY, PelhamVillage.

**Update:** citysquared.com sits behind a security service that blocks automated browsers. The lookups in this survey only worked because the test scripts presented themselves as a normal browser, which is not a fair basis for a scheduled job. Automated lookups therefore need permission or a data feed from Municity or the towns. Until then, the page links each referral in these towns to CitySquared for a manual check. The towns choose which fields are public, and some (Yonkers, Yorktown) show none.

## Recommended next steps

1. **Municity permit data** for the 7 public towns: ask Municity or the towns for an export or permission for automated access. The page already accepts the data (`data/permits.json`).
2. **Port Chester.** Decide whether a free Accela account is acceptable for scripted lookups.
3. **Greenburgh Active Applications pages and the agenda platforms** (AgendaCenter, CivicClerk, Granicus, AgendaQuick, eCode360). These are where developer, architect and engineer names can be extracted from minutes.
4. **Yonkers.** Permits are not public, so use the Yonkers IDA packets and planning board minutes. A standing records (FOIL) request for the monthly permit log is the fallback.
5. **Websites that block cloud traffic** (Yonkers, North Castle, New Rochelle, Lewisboro). These need checking from a normal connection.

"""Pull NYC DOB NOW filings and permits from NYC Open Data into data/nyc.json.

Run: python3 pull_nyc.py [days]     (default 180 days back), then python3 build.py

Sources (Socrata API, no key needed; set NYC_APP_TOKEN to avoid rate limits):
  w9ak-ipjd  DOB NOW: Build - Job Application Filings
  rbx6-tga4  DOB NOW: Build - Approved Permits
"""
import json, os, sys, datetime, urllib.parse, urllib.request
from pathlib import Path

R = Path(__file__).parent
HOST = "https://data.cityofnewyork.us/resource/"
DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 180
ALT_MIN_COST = 500000  # plain alterations are only kept at or above this filed cost
MAJOR = ("New Building", "Alteration CO", "ALT-CO - New Building with Existing Elements to Remain")
FLAGS = ["foundation_work_type_", "structural_work_type_", "earth_work_work_type_", "support_of_excavation_work_type_",
         "mechanical_systems_work_type_", "boiler_equipment_work_type_", "sprinkler_work_type", "plumbing_work_type",
         "standpipe", "solar_work_type_", "green_roof_work_type_", "full_demolition_work_type_", "general_construction_work_type_"]


def get(dataset, **params):
    """Fetch every row for a query, paging 20,000 at a time."""
    out, offset = [], 0
    while True:
        q = dict(params, **{"$limit": 20000, "$offset": offset, "$order": ":id"})
        req = urllib.request.Request(HOST + dataset + ".json?" + urllib.parse.urlencode(q))
        if os.environ.get("NYC_APP_TOKEN"):
            req.add_header("X-App-Token", os.environ["NYC_APP_TOKEN"])
        with urllib.request.urlopen(req, timeout=180) as r:
            page = json.load(r)
        out += page
        if len(page) < 20000:
            return out
        offset += 20000


def num(v):
    try:
        return float(v or 0)
    except ValueError:
        return 0.0


def clean(v):
    return " ".join(str(v or "").split())


def name(*parts):
    return clean(" ".join(p for p in parts if p)).title()


def biz(v):
    v = clean(v)
    return "" if v.upper().strip(".") in ("", "PR", "N/A", "NA", "NOT APPLICABLE", "NONE", "OWNER", "INDIVIDUAL", "SELF", "N.A") else v


def main():
    today = datetime.date.today()
    since = (today - datetime.timedelta(days=DAYS)).isoformat()
    types = ",".join("'" + t + "'" for t in MAJOR)
    base = f"filing_date >= '{since}' AND job_filing_number like '%-I1'"
    rows = get("w9ak-ipjd", **{"$where": f"{base} AND job_type in ({types})"})
    rows += get("w9ak-ipjd", **{"$where": f"{base} AND job_type = 'Alteration' AND initial_cost::number >= {ALT_MIN_COST}"})
    permits = get("rbx6-tga4", **{
        "$select": "job_filing_number,work_type,issued_date,applicant_business_name,applicant_first_name,applicant_last_name",
        "$where": f"issued_date >= '{since}' AND permittee_s_license_type = 'GC' AND work_type in "
                  "('General Construction','Foundation','Structural','Earth Work','Support of Excavation')"})
    # One contractor per job: prefer the General Construction permit, then the earliest issued.
    gc = {}
    for p in sorted(permits, key=lambda p: (p["work_type"] != "General Construction", p.get("issued_date", ""))):
        job = p["job_filing_number"].split("-")[0]
        if job not in gc and clean(p.get("applicant_business_name")):
            gc[job] = [clean(p["applicant_business_name"]).title(), name(p.get("applicant_first_name"), p.get("applicant_last_name")),
                       p["work_type"], (p.get("issued_date") or "")[:10]]
    out, seen = [], set()
    for r in rows:
        job = r["job_filing_number"].split("-")[0]
        if job in seen or not r.get("filing_date"):
            continue
        seen.add(job)
        d = lambda k: (r.get(k) or "")[:10]
        out.append([
            job, clean(r.get("filing_status")), clean(r.get("house_no")), clean(r.get("street_name")).title(), r.get("borough", ""),
            r.get("job_type", ""), round(num(r.get("initial_cost"))), round(num(r.get("total_construction_floor_area"))),
            clean(r.get("building_type")), int(num(r.get("proposed_no_of_stories"))), int(num(r.get("proposed_dwelling_units"))),
            int(num(r.get("existing_dwelling_units"))), d("filing_date"), d("current_status_date"), d("approved_date"), d("first_permit_date"),
            biz(r.get("owner_s_business_name")), name(r.get("owner_first_name"), r.get("owner_last_name")), clean(r.get("owner_type")),
            clean(r.get("applicant_professional_title")), name(r.get("applicant_first_name"), r.get("applicant_last_name")),
            biz(r.get("applicant_business_name")),
            clean(", ".join(x for x in [clean(r.get("applicant_street_name")).title(), clean(r.get("city")).title(), clean(r.get("state")) + " " + clean(r.get("zip"))] if x.strip())),
            biz(r.get("filing_representative_business_name")), clean(r.get("job_description")), clean(r.get("nta")),
            round(num(r.get("latitude")), 5), round(num(r.get("longitude")), 5), clean(r.get("bin")), clean(r.get("bbl")),
            clean(r.get("postcode")), "".join("1" if str(r.get(f, "")).upper() == "YES" else "0" for f in FLAGS),
            gc.get(job) or 0,
        ])
    out.sort(key=lambda x: x[12], reverse=True)
    (R / "data/nyc.json").write_text(json.dumps({"pulled": today.isoformat(), "since": since, "altMinCost": ALT_MIN_COST, "rows": out},
                                                separators=(",", ":"), ensure_ascii=False))
    print(f"Wrote data/nyc.json: {len(out)} filings since {since}, {sum(1 for x in out if x[-1])} with a contractor on a permit")


if __name__ == "__main__":
    main()

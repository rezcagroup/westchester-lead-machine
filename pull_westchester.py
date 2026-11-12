"""Pull Westchester County Planning Board referrals from the county's ArcGIS feature service into data/.

Run: python3 pull_westchester.py [days]     (default 365 days back), then python3 build.py

Source: Westchester County Department of Planning, Planning and Zoning Referrals
  (ArcGIS feature service Westchester_County_Referrals_2_view, public, no key needed)
  layer 0  referrals (one row per county file id, with PDF attachments)
  table 2  county review comments, linked by parentglobalid

Writes data/data.json, data/ev.json and data/att.json, and stamps PULLED / TODAY in src/script.js.
data/team.json and data/contacts.json are hand-researched and are not touched.
"""
import json, re, sys, datetime, urllib.parse, urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

R = Path(__file__).parent
FS = "https://services.arcgis.com/XKEHpOulfycN9cGC/arcgis/rest/services/Westchester_County_Referrals_2_view/FeatureServer/"
DAYS = int(sys.argv[1]) if len(sys.argv) > 1 else 365
TZ = ZoneInfo("America/New_York")
KEEP = {"Pln", "SD", "SUP", "UV"}  # site plan, subdivision, special use permit, use variance
COMMENT_CHARS = 280  # the page shows comment excerpts and adds an ellipsis past 270
MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def call(path, **params):
    data = urllib.parse.urlencode(dict(params, f="json")).encode()
    with urllib.request.urlopen(urllib.request.Request(FS + path, data=data), timeout=180) as r:
        out = json.load(r)
    if "error" in out:
        raise RuntimeError(f"{path}: {out['error']}")
    return out


def query(layer, where, **params):
    """Every row matching where, paging by the service's record limit."""
    rows, offset = [], 0
    while True:
        page = call(f"{layer}/query", where=where, outFields="*", returnGeometry="false",
                    orderByFields="objectid", resultOffset=offset, resultRecordCount=2000, **params)
        rows += [f["attributes"] for f in page["features"]]
        if not page.get("exceededTransferLimit"):
            return rows
        offset += len(page["features"])


def domains(layer):
    """Coded-value domains for a layer: {field: {code: name}}."""
    return {f["name"]: {c["code"]: c["name"] for c in f["domain"]["codedValues"]}
            for f in call(str(layer))["fields"] if (f.get("domain") or {}).get("codedValues")}


def clean(v):
    return " ".join(str(v or "").split())


def day(ms):
    return datetime.datetime.fromtimestamp(ms / 1000, TZ).date().isoformat() if ms else ""


def chunks(xs, n):
    for i in range(0, len(xs), n):
        yield xs[i:i + n]


def main():
    today = datetime.datetime.now(TZ).date()
    since = today - datetime.timedelta(days=DAYS)
    dom = domains(0)
    action_part = {}  # single codes, so combinations the domain does not list ("Pln,ZO") still decode
    for code, nm in dom["Action"].items():
        if "," not in code:
            action_part[code] = nm

    def decode(field, v):
        return dom.get(field, {}).get(v, v) or ""

    def action(v):
        return ", ".join(action_part.get(p.strip(), p.strip()) for p in (v or "").split(",") if p.strip())

    rows = query(0, f"LetterDate >= DATE '{since.isoformat()}'")
    keep = []
    for a in rows:
        parts = {p.strip() for p in (a.get("Action") or "").split(",")}
        scope = max(a.get("SQFA") or 0, a.get("SQD") or 0, a.get("ResUnits") or 0, a.get("CommSQ") or 0)
        if a.get("refid") and a.get("LetterDate") and parts & KEEP and scope > 0:
            keep.append(a)
    keep.sort(key=lambda a: (a["LetterDate"], a["objectid"]), reverse=True)

    data = []
    for a in keep:
        try:
            lat, lng = round(float(a.get("LatY")), 4), round(float(a.get("LongX")), 4)
        except (TypeError, ValueError):
            lat, lng = 0, 0
        data.append([
            clean(a["refid"]), clean(a.get("ActName")), decode("AgType", a.get("AgType")), decode("Municipality", a.get("Municipality")),
            action(a.get("Action")), a.get("SQFA") or 0, a.get("SQD") or 0, re.sub(r",\s*USA$", "", clean(a.get("Address"))),
            lat, lng, day(a["LetterDate"]), decode("GLU", a.get("GLU")), a.get("ResUnits") or 0, a.get("AFFHUnits") or 0,
            a.get("CommSQ") or 0, clean(a.get("Description")) or clean(a.get("RefRevDesc")), a.get("Stories") or 0,
            a.get("Parking") or 0, a.get("SiteAcres") or a.get("SiteSize") or 0,
            clean(a.get("Recipient")), clean(a.get("RecTitle")), clean(a.get("RecAgency")),
        ])

    # County review comments, oldest first, keyed back to the county file id.
    by_gid = {a["globalid"].strip("{}").lower(): a["refid"] for a in keep}
    cmt_dom = domains(2).get("CommentCategory", {})
    comments = {}
    for ids in chunks(list(by_gid), 100):
        for c in query(2, "parentglobalid IN (" + ",".join(f"'{g}'" for g in ids) + ")"):
            ref = by_gid.get(str(c.get("parentglobalid") or "").strip("{}").lower())
            text = clean(c.get("AddtlComm"))
            if ref and text:
                code = c.get("CommentCategory") or c.get("CommentTitle") or ""
                title = clean(c.get("CommentTitle2")) or cmt_dom.get(code, code)
                comments.setdefault(ref, []).append((c["objectid"], [code, title, text[:COMMENT_CHARS]]))
    ev = {a["refid"]: {"z": clean(a.get("Zone")), "cm": [c for _, c in sorted(comments.get(a["refid"], []))]} for a in keep}

    # County letter or plans attached to the file: prefer the referral letter, then any PDF.
    by_oid = {a["objectid"]: a["refid"] for a in keep}
    att = {}
    for oids in chunks(list(by_oid), 200):
        res = call("0/queryAttachments", objectIds=",".join(map(str, oids)))
        for g in res.get("attachmentGroups", []):
            pdfs = [i for i in g["attachmentInfos"] if "pdf" in (i.get("contentType") or "") or i["name"].lower().endswith(".pdf")]
            pdfs.sort(key=lambda i: ((i.get("keywords") or "").lower() != "refletter", i["id"]))
            if pdfs:
                att[by_oid[g["parentObjectId"]]] = [g["parentObjectId"], pdfs[0]["id"]]

    dump = lambda name, obj: (R / "data" / name).write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False))
    dump("data.json", data)
    dump("ev.json", ev)
    dump("att.json", att)

    js = R / "src/script.js"
    s = js.read_text()
    s = re.sub(r'const PULLED = "[^"]*";', f'const PULLED = "{today.day} {MON[today.month - 1]} {today.year}";', s, count=1)
    s = re.sub(r"const TODAY = Date\.UTC\([^)]*\);", f"const TODAY = Date.UTC({today.year},{today.month - 1},{today.day});", s, count=1)
    js.write_text(s)

    towns = {r[3] for r in data}
    print(f"Read {len(rows)} referrals since {since}; kept {len(data)} across {len(towns)} municipalities, "
          f"{len(att)} with a county PDF, {sum(1 for e in ev.values() if e['cm'])} with county comments. "
          f"Stamped src/script.js as pulled {today}.")
    missing = sorted(towns - set(json.loads((R / "data/contacts.json").read_text())))
    if missing:
        print("No town contacts in data/contacts.json for:", ", ".join(missing))


if __name__ == "__main__":
    main()

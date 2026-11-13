"""Assemble index.html (Westchester) and nyc.html (five boroughs) from src/ and data/. Run: python3 build.py"""
import json, re
from pathlib import Path
R = Path(__file__).parent


def page(out, title, body, script, data):
    js = (R/"src"/script).read_text()
    for key, f in data:
        src = R/"data"/f
        js = js.replace(key, (src.read_text() if src.exists() else "{}").replace("</", "<\\/"))
    body_html = (R/"src"/body).read_text()
    if "__TOWNS__" in body_html:  # Westchester header and source note: fill from the data, not typed-in numbers
        towns = len({r[3] for r in json.loads((R/"data/data.json").read_text())})
        pulled = re.search(r'const PULLED = "([^"]*)";', js).group(1)
        body_html = body_html.replace("__TOWNS__", str(towns)).replace("__PULLED__", pulled)
    head = (R/"src/head.html").read_text().replace("Westchester Construction Lead Machine", title)
    html = head + (R/"src/css.txt").read_text() + "\n</head>\n" + body_html + "<script>\n" + js + "</script>\n</body>\n</html>\n"
    (R/out).write_text(html)
    print("Built", out, len(html), "bytes")


page("index.html", "Westchester Construction Lead Machine", "body.html", "script.js",
     [("__DATA__", "data.json"), ("__CONTACTS__", "contacts.json"), ("__ATT__", "att.json"), ("__TEAM__", "team.json"), ("__EV__", "ev.json"), ("__PERMITS__", "permits.json")])
page("nyc.html", "NYC Construction Lead Machine", "nyc_body.html", "nyc_script.js", [("__NYC__", "nyc.json")])

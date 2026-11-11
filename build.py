"""Assemble index.html (Westchester) and nyc.html (five boroughs) from src/ and data/. Run: python3 build.py"""
from pathlib import Path
R = Path(__file__).parent


def page(out, title, body, script, data):
    js = (R/"src"/script).read_text()
    for key, f in data:
        js = js.replace(key, (R/"data"/f).read_text().replace("</", "<\\/"))
    head = (R/"src/head.html").read_text().replace("Westchester Construction Lead Machine", title)
    html = head + (R/"src/css.txt").read_text() + "\n</head>\n" + (R/"src"/body).read_text() + "<script>\n" + js + "</script>\n</body>\n</html>\n"
    (R/out).write_text(html)
    print("Built", out, len(html), "bytes")


page("index.html", "Westchester Construction Lead Machine", "body.html", "script.js",
     [("__DATA__", "data.json"), ("__CONTACTS__", "contacts.json"), ("__ATT__", "att.json"), ("__TEAM__", "team.json"), ("__EV__", "ev.json")])
page("nyc.html", "NYC Construction Lead Machine", "nyc_body.html", "nyc_script.js", [("__NYC__", "nyc.json")])

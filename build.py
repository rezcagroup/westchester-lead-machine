"""Assemble index.html from src/ and data/. Run: python3 build.py"""
from pathlib import Path
R = Path(__file__).parent
js = (R/"src/script.js").read_text()
for key, f in [("__DATA__","data.json"),("__CONTACTS__","contacts.json"),("__ATT__","att.json"),("__TEAM__","team.json"),("__EV__","ev.json")]:
    js = js.replace(key, (R/"data"/f).read_text())
html = (R/"src/head.html").read_text() + (R/"src/css.txt").read_text() + "\n</head>\n" + (R/"src/body.html").read_text() + "<script>\n" + js + "</script>\n</body>\n</html>\n"
(R/"index.html").write_text(html)
print("Built index.html", len(html), "bytes")

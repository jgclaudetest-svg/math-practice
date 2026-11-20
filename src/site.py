#!/usr/bin/env python3
"""Build the standalone practice site (plain web pages, no frame) from the built pages.

Usage: python3 site.py            writes ./site/*.html, ./site/index.html and ./site/src/
Each standalone page saves practice in the browser's own storage for this site, which an iPhone keeps
between visits. (Inside a framed host, Safari wipes that storage whenever it restarts.)
"""
import json, pathlib, re, shutil, sys

here = pathlib.Path(__file__).resolve().parent
kit = here / "kit"
out = here / "site"
out.mkdir(exist_ok=True)

PAGES = [  # (output name, built source, one-line description)
    ("trig-values", here / "fifteen-values.html", "Flash cards and a timed table for sin, cos and tan at the six key angles."),
    ("unit-circle", kit / "unit-circle.html", "Find angles on the circle, read coordinates, and fill a blank circle from memory."),
    ("fractions", kit / "fractions.html", "Short sets on fraction and algebra steps, with a mixed check."),
    ("graphs", kit / "graphs.html", "Name each of the six trig graphs, plot key points, and learn the facts for each."),
    ("identities", kit / "identities.html", "Recall the key identities and rebuild each one from the ones before it."),
    ("half-angle", kit / "half-angle.html", "Work half-angle problems one step at a time, then sprint."),
    ("friday-check", kit / "friday-check.html", "For a parent: quiz cards with answers, and the end-of-week checks."),
]

url_file = kit / "send-url.txt"
SEND_URL = url_file.read_text().strip() if url_file.exists() else ""
if SEND_URL and not re.fullmatch(r"https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec|http://127\.0\.0\.1:\d+/exec", SEND_URL):
    sys.exit("send-url.txt does not look like a web app /exec link")

RESET = ":root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}"
OLD_NOTE = "The shared record is not available in this view. This report covers this device only."
NEW_NOTE = "This report covers practice on this device only. It stays here between visits unless the browser\\'s website data is cleared."
FOOT = ('<p style="margin:0;padding:0 16px 40px;text-align:center;font:500 14px/1.4 Inter,system-ui,sans-serif">'
        '<a href="./" style="color:inherit;opacity:.72">All practice pages</a></p>')


def head(title):
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            '<meta name="robots" content="noindex">\n'
            '<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
            f'<meta name="apple-mobile-web-app-title" content="{title}">\n'
            f'<title>{title}</title>\n<style>{RESET}</style>\n')


titles = []
for name, src, blurb in PAGES:
    html = src.read_text()
    m = re.search(r"<title>(.*?)</title>\s*", html, re.S)
    if not m:
        sys.exit(f"{src.name}: no <title>")
    title = m.group(1).strip()
    html = html[:m.start()] + html[m.end():]
    html = re.sub(r'<meta name="claude:[^>]*>\s*', "", html)
    link = re.search(r'<link rel="stylesheet"[^>]*>\s*', html)
    fonts = ""
    if link:
        fonts = link.group(0).strip() + "\n"
        html = html[:link.start()] + html[link.end():]
    html = html.replace("__SEND_URL__", SEND_URL)
    if html.count(OLD_NOTE) != 1:
        sys.exit(f"{src.name}: expected the device-only note exactly once, found {html.count(OLD_NOTE)}")
    html = html.replace(OLD_NOTE, NEW_NOTE)
    doc = head(title) + fonts + "</head>\n<body>\n" + html.rstrip() + "\n" + FOOT + "\n</body>\n</html>\n"
    (out / f"{name}.html").write_text(doc)
    titles.append((name, title, blurb))
    print(f"{name}.html  {len(doc.encode())} bytes  {title!r}")

# The homepage: the page links plus the practice numbers, read from the practice log for anyone who opens it.
SHEET_URL = "https://docs.google.com/spreadsheets/d/1OYzfO7FvsNIWos3e-a8ufGJmVo6hZluOlGRcvO0wV98/edit"
links = json.dumps([{"href": f"{n}.html", "title": t, "blurb": b} for n, t, b in titles], ensure_ascii=False)
home = ((kit / "home.src.html").read_text().replace("/*KIT_CSS*/", (kit / "kit.css").read_text())
        .replace("__SEND_URL__", SEND_URL).replace("__SHEET_URL__", SHEET_URL).replace("/*LINKS*/[]", links))
m = re.search(r"<title>(.*?)</title>\s*", home, re.S)
home_title = m.group(1).strip()
home = home[:m.start()] + home[m.end():]
(out / "index.html").write_text(head(home_title) + "</head>\n<body>\n" + home.rstrip() + "\n</body>\n</html>\n")
print("index.html", (out / "index.html").stat().st_size, "bytes")

# The old parent link now just opens the homepage.
(out / "parent.html").write_text(head("Math Practice") + '<meta http-equiv="refresh" content="0; url=./">\n'
    '<script>location.replace("./")</script>\n</head>\n<body>\n<p style="padding:16px"><a href="./">Open the practice homepage</a></p>\n</body>\n</html>\n')

# Keep the sources next to the built pages so the site can be rebuilt later.
src = out / "src"
src.mkdir(exist_ok=True)
for f in [kit / "kit.css", kit / "kit.js", kit / "build.py", here / "site.py", here / "fifteen-values.html"] + ([url_file] if url_file.exists() else []) + [kit / "home.src.html"] + sorted(kit.glob("*.page.html")):
    if f.name == "demo.page.html":
        continue
    shutil.copy2(f, src / f.name)
print("src:", ", ".join(sorted(p.name for p in src.iterdir())))

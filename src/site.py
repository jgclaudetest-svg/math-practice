#!/usr/bin/env python3
"""Build the standalone practice site (plain web pages, no frame) from the built pages.

Usage: python3 site.py            writes ./site/*.html, ./site/index.html and ./site/src/
Each standalone page saves practice in the browser's own storage for this site, which an iPhone keeps
between visits. (Inside a framed host, Safari wipes that storage whenever it restarts.)
"""
import pathlib, re, shutil, sys

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
    if "__SEND_URL__" in html:
        html = html.replace("__SEND_URL__", "")
    if html.count(OLD_NOTE) != 1:
        sys.exit(f"{src.name}: expected the device-only note exactly once, found {html.count(OLD_NOTE)}")
    html = html.replace(OLD_NOTE, NEW_NOTE)
    doc = head(title) + fonts + "</head>\n<body>\n" + html.rstrip() + "\n" + FOOT + "\n</body>\n</html>\n"
    (out / f"{name}.html").write_text(doc)
    titles.append((name, title, blurb))
    print(f"{name}.html  {len(doc.encode())} bytes  {title!r}")

cards = "\n".join(
    f'    <li><a href="{n}.html"><span class="t">{t}</span><span class="d">{b}</span></a></li>' for n, t, b in titles)
index = head("Math Practice") + '''<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;700&display=swap">
<style>
  :root { --bg:#EDF1F7; --surface:#FFFFFF; --ink:#14223A; --muted:#55627A; --line:#CBD5E3; --accent:#2B50C8; }
  @media (prefers-color-scheme: dark) { :root { color-scheme:dark; --bg:#0F1626; --surface:#18223A; --ink:#EEF2FA; --muted:#A3B0C8; --line:#2C3A58; --accent:#9DB4FF; } }
  body { background:var(--bg); color:var(--ink); font:16px/1.5 Inter,system-ui,sans-serif; }
  main { max-width:640px; margin:0 auto; padding:36px max(16px, env(safe-area-inset-right, 0px)) 56px max(16px, env(safe-area-inset-left, 0px)); }
  h1 { font:700 34px/1.1 "Space Grotesk",system-ui,sans-serif; margin:0 0 8px; letter-spacing:-.01em; }
  p { margin:0 0 24px; color:var(--muted); }
  ul { list-style:none; margin:0; padding:0; display:grid; gap:12px; }
  a { display:block; padding:16px 18px; background:var(--surface); border:1px solid var(--line); border-radius:12px; color:inherit; text-decoration:none; }
  a:hover, a:focus-visible { border-color:var(--accent); outline:none; }
  .t { display:block; font:700 19px/1.25 "Space Grotesk",system-ui,sans-serif; color:var(--accent); }
  .d { display:block; margin-top:4px; color:var(--muted); font-size:15px; }
  .note { margin:26px 0 0; font-size:14px; }
</style>
</head>
<body>
<main>
  <h1>Math Practice</h1>
  <p>Seven short practice pages. Each one keeps its own record on this device, under its Report tab.</p>
  <ul>
''' + cards + '''
  </ul>
  <p class="note">Practice is saved in this browser only. Use the same device and browser each day so the record stays in one place.</p>
</main>
</body>
</html>
'''
(out / "index.html").write_text(index)
print("index.html", len(index.encode()), "bytes")

# Keep the sources next to the built pages so the site can be rebuilt later.
src = out / "src"
src.mkdir(exist_ok=True)
for f in [kit / "kit.css", kit / "kit.js", kit / "build.py", here / "site.py", here / "fifteen-values.html"] + sorted(kit.glob("*.page.html")):
    if f.name == "demo.page.html":
        continue
    shutil.copy2(f, src / f.name)
print("src:", ", ".join(sorted(p.name for p in src.iterdir())))

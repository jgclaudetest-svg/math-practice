#!/usr/bin/env python3
"""Build one artifact page from the shared kit.

Usage: python3 build.py <slug>
Reads  <slug>.page.html  (a <title>, an optional <style>, markup, then ONE <script> that uses Kit)
Writes <slug>.html       (the file to publish) and <slug>.check.js (kit + page script, for node --check)
"""
import re, subprocess, sys, pathlib

here = pathlib.Path(__file__).resolve().parent
slug = sys.argv[1]
page = (here / f"{slug}.page.html").read_text()
css = (here / "kit.css").read_text()
js = (here / "kit.js").read_text()

# The "Finish session" link target. Put the deployed web app URL in send-url.txt; without it the feature stays off.
url_file = here / "send-url.txt"
send_url = url_file.read_text().strip() if url_file.exists() else ""
if send_url and not re.fullmatch(r"https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec|http://127\.0\.0\.1:\d+/exec", send_url):
    sys.exit("send-url.txt does not look like a web app /exec link")
js = js.replace("__SEND_URL__", send_url)

m = re.search(r"<title>(.*?)</title>\s*", page, re.S)
if not m:
    sys.exit("page file needs a <title>")
title = m.group(1).strip()
body = page[:m.start()] + page[m.end():]
if body.count("<script>") != 1 or body.count("</script>") != 1:
    sys.exit("page file needs exactly one <script>...</script> block")
for bad in ("!doctype", "html", "head", "body"):
    if re.search(rf"<{bad}[\s>]", body, re.I):
        sys.exit(f"page file must not contain <{bad}>")

head = (
    '<meta name="claude:viewport-fit-sides" content="cover">\n'
    f"<title>{title}</title>\n"
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Noto+Sans+Math&family=Space+Grotesk:wght@500;700&display=swap">\n'
    f"<style>\n{css}</style>\n"
)
out = head + body.replace("<script>", f"<script>\n{js}</script>\n<script>", 1)
(here / f"{slug}.html").write_text(out)

script = re.search(r"<script>(.*)</script>", body, re.S).group(1)
(here / f"{slug}.check.js").write_text(js + "\n" + script)
r = subprocess.run(["node", "--check", str(here / f"{slug}.check.js")], capture_output=True, text=True)
tags = {t: (out.count(f"<{t}"), out.count(f"</{t}>")) for t in ("div", "section", "table", "button", "svg")}
print(f"{slug}.html  {len(out.encode())} bytes  title={title!r}")
print("tag balance", tags)
print("SYNTAX_OK" if r.returncode == 0 else "SYNTAX_ERROR\n" + r.stderr)
sys.exit(r.returncode)

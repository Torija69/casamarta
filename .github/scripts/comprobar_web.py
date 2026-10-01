#!/usr/bin/env python3
"""Comprobaciones básicas de una web estática (sin dependencias).

1. Sintaxis de todos los .js/.mjs del proyecto (node --check).
2. Sintaxis de los <script> en línea de cada HTML.
3. Que existan los ficheros locales enlazados con src= o href= en los HTML.

Uso: python3 comprobar_web.py [carpeta]   (por defecto, la actual)
Sale con código 1 si encuentra algún error.
"""
import os, re, subprocess, sys, tempfile
from urllib.parse import unquote

RAIZ = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
EXCLUIR = {"node_modules", ".git", "data", "tests", "_site", "dist"}
errores = []

def ficheros(ext):
    for base, dirs, files in os.walk(RAIZ):
        dirs[:] = [d for d in dirs if d not in EXCLUIR and not d.startswith(".")]
        for f in files:
            if f.lower().endswith(ext):
                yield os.path.join(base, f)

def rel(p):
    return os.path.relpath(p, RAIZ)

def node_check(path, origen):
    r = subprocess.run(["node", "--check", path], capture_output=True, text=True)
    if r.returncode != 0:
        msg = (r.stderr.strip().splitlines() or ["error"])
        errores.append(f"JS {origen}: " + " | ".join(l for l in msg if l.strip())[:400])

# 1. ficheros JS
n_js = 0
for p in list(ficheros(".js")) + list(ficheros(".mjs")):
    node_check(p, rel(p)); n_js += 1

# 2 y 3. HTML
n_html = n_inline = n_refs = 0
SCRIPT = re.compile(r"<script\b([^>]*)>(.*?)</script>", re.S | re.I)
REF = re.compile(r"""\b(?:src|href)\s*=\s*["']([^"']+)["']""", re.I)
for p in ficheros(".html"):
    n_html += 1
    s = open(p, encoding="utf-8", errors="replace").read()
    for attrs, code in SCRIPT.findall(s):
        if "src=" in attrs.lower() or not code.strip():
            continue
        tipo = re.search(r"type\s*=\s*[\"']?([^\"'\s>]+)", attrs, re.I)
        tipo = tipo.group(1).lower() if tipo else ""
        if tipo and tipo not in ("module", "text/javascript", "application/javascript"):
            continue
        ext = ".mjs" if tipo == "module" else ".js"
        with tempfile.NamedTemporaryFile("w", suffix=ext, delete=False, encoding="utf-8") as t:
            t.write(code)
        node_check(t.name, f"{rel(p)} (script en línea)")
        os.unlink(t.name); n_inline += 1
    sin_scripts = SCRIPT.sub(lambda m: "<script" + m.group(1) + "></script>", s)
    for ref in REF.findall(sin_scripts):
        if re.match(r"^(https?:|//|#|mailto:|tel:|data:|javascript:|about:)", ref, re.I):
            continue
        if any(x in ref for x in ("${", "{{", "+")):
            continue
        limpio = unquote(ref.split("#")[0].split("?")[0])
        if not limpio:
            continue
        destino = os.path.normpath(os.path.join(RAIZ if limpio.startswith("/") else os.path.dirname(p), limpio.lstrip("/")))
        n_refs += 1
        if not os.path.exists(destino):
            errores.append(f"Enlace roto en {rel(p)}: {ref}")

print(f"Comprobados: {n_js} ficheros JS, {n_html} HTML, {n_inline} scripts en línea, {n_refs} enlaces locales")
for e in errores:
    print("ERROR", e)
print("OK" if not errores else f"{len(errores)} errores")
sys.exit(1 if errores else 0)

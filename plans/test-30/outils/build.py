"""Assemble les 30 programmes : Markdown complets (dépôt) + HTML pour le PDF."""
import json, os, re, html, sys
D = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(D, 'src')
OUT_MD = sys.argv[1]
OUT_HTML = os.path.join(D, 'test-30.html')
cal = json.load(open(os.path.join(D, 'calendriers.json')))
PH = {'preparation': 'Préparation', 'fondation': 'Fondation', 'developpement': 'Développement', 'specifique': 'Spécifique',
      'affutage': 'Affûtage', 'course': '**Course**'}


def cal_md(pid):
    r = cal[pid]
    lines = ['**Calendrier** (volume en minutes ; * = plafonné par ce que les séances peuvent contenir)', '',
             '| Sem. | Lundi | Phase | Type | Volume | Sortie longue | Qualité |', '|---|---|---|---|---|---|---|']
    for w in r['weeks']:
        sl = w.get('sl')
        sl_txt = f"{sl} min" if sl and sl >= 60 else ('—' if w['phase'] != 'course' else '')
        typ = w['type']
        if w['w'] == 1 and w['phase'] != 'course':
            typ += ', calibrage muscu'
        vol = f"{w['vol']}{'*' if w.get('bloque') else ''}"
        q = w.get('qualite', '')
        if w['type'] == 'allégée' and q:
            q += ', moins de fractions'
        if w['phase'] == 'course':
            q = 'course'
        lines.append(f"| W{w['w']} | {w['lundi']} | {PH[w['phase']]} | {typ} | {vol} | {sl_txt} | {q} |")
    return '\n'.join(lines)


def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', t)
    t = re.sub(r'(?<![\w*])\*([^*]+)\*(?![\w*])', r'<i>\1</i>', t)
    t = t.replace('⚠', '<span class="w">⚠</span>').replace('✔', '<span class="ok">✔</span>')
    return t


def md2html(md):
    out, i, L = [], 0, md.split('\n')
    while i < len(L):
        l = L[i]
        if not l.strip():
            i += 1; continue
        m = re.match(r'^(#{1,3}) (.*)', l)
        if m:
            n = len(m.group(1))
            out.append(f'<h{n}>{inline(m.group(2))}</h{n}>'); i += 1; continue
        if l.startswith('|'):
            rows = []
            while i < len(L) and L[i].startswith('|'):
                rows.append(L[i]); i += 1
            cells = [[c.strip() for c in r.strip().strip('|').split('|')] for r in rows]
            head, body = cells[0], [c for c in cells[2:]]
            cls = ' class="cal"' if head and head[0] == 'Sem.' else (' class="pp"' if head[:3] == ['', 'Profil', 'Proposition'] else '')
            t = [f'<table{cls}><thead><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in head) + '</tr></thead><tbody>']
            for r in body:
                t.append('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>')
            t.append('</tbody></table>')
            out.append(''.join(t)); continue
        if l.startswith('- '):
            items = []
            while i < len(L) and L[i].startswith('- '):
                items.append(L[i][2:]); i += 1
            out.append('<ul>' + ''.join(f'<li>{inline(x)}</li>' for x in items) + '</ul>'); continue
        m = re.match(r'^\d+\. (.*)', l)
        if m:
            items = []
            while i < len(L) and re.match(r'^\d+\. ', L[i]):
                items.append(re.sub(r'^\d+\. ', '', L[i])); i += 1
            out.append('<ol>' + ''.join(f'<li>{inline(x)}</li>' for x in items) + '</ol>'); continue
        para = []
        while i < len(L) and L[i].strip() and not L[i].startswith(('|', '#', '- ')) and not re.match(r'^\d+\. ', L[i]):
            para.append(inline(L[i])); i += 1
        cls = ' class="coach"' if para and para[0].startswith('<b>Avis de coach</b>') else ''
        out.append(f'<p{cls}>' + '<br>'.join(para) + '</p>')
    return '\n'.join(out)


os.makedirs(OUT_MD, exist_ok=True)
parts = []
for name in ['00_intro'] + [f'P{i:02d}' for i in range(1, 31)] + ['99_bilan']:
    md = open(os.path.join(SRC, name + '.md')).read()
    if '{{CAL}}' in md:
        md = md.replace('{{CAL}}', cal_md(name))
    dest = {'00_intro': 'README.md', '99_bilan': 'BILAN.md'}.get(name, name + '.md')
    open(os.path.join(OUT_MD, dest), 'w').write(md)
    parts.append(f'<section class="{"p" if name.startswith("P") else name[3:]}">{md2html(md)}</section>')

CSS = """
@page { size: A4; margin: 14mm 13mm 14mm 13mm; }
:root { --ink:#1d1d1f; --muted:#6e6e73; --line:#d9d9de; --accent:#c4552b; --soft:#faf3ef; --ok:#2e7d4f; }
* { box-sizing: border-box; }
body { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: var(--ink); background:#fff;
       font-size: 8.6pt; line-height: 1.38; margin: 0; }
h1 { font-size: 19pt; margin: 0 0 4mm; letter-spacing: -0.02em; }
h2 { font-size: 13pt; margin: 0 0 2mm; padding-bottom: 1.5mm; border-bottom: 2px solid var(--accent); letter-spacing: -0.01em; }
h3 { font-size: 10pt; margin: 4mm 0 1.5mm; color: var(--accent); }
section { page-break-before: always; }
section.intro { page-break-before: auto; }
p { margin: 1.5mm 0; }
ul, ol { margin: 1mm 0 2mm; padding-left: 5mm; }
li { margin: 0.6mm 0; }
table { width: 100%; border-collapse: collapse; margin: 1.5mm 0 2.5mm; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th, td { border: 0.5pt solid var(--line); padding: 1.1mm 1.6mm; text-align: left; vertical-align: top; }
th { background: #f2f2f4; font-weight: 600; }
table.pp td:first-child { width: 12%; background: #f7f7f9; }
table.pp td { width: 44%; }
table.pp th { background: var(--soft); }
table.cal { font-size: 7.4pt; }
table.cal td, table.cal th { padding: 0.6mm 1.4mm; }
p.coach { background: var(--soft); border-left: 3px solid var(--accent); padding: 2mm 3mm; margin-top: 3mm; }
code { font-family: Menlo, monospace; font-size: 7.8pt; background: #f2f2f4; padding: 0 1mm; border-radius: 2px; }
.w { color: var(--accent); font-weight: 700; }
.ok { color: var(--ok); }
i { color: var(--muted); }
"""
page = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>MIND — Test 30 profils</title>
<style>{CSS}</style></head><body>{''.join(parts)}</body></html>"""
open(OUT_HTML, 'w').write(page)
print('ok', OUT_HTML)

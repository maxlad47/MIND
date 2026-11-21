import re, sys, os
D = sys.argv[1]
for q in sys.argv[2:]:
    t = open(os.path.join(D, q + '.md')).read().split('\n')
    print('=' * 8, t[0][3:], '|', t[2].strip('*'))
    for l in t:
        if l.startswith('| **Course**') or l.startswith('| **Muscu**') or l.startswith('| **Semaine**'):
            c = l.split('|'); print('  P:', c[2].strip()[:200]); print('  →', c[3].strip()[:260])
    w = [l.split('|') for l in t if re.match(r'^\| W\d', l)]
    if w: print('  CAL', ' '.join(f"{x[1].strip()}:{x[5].strip()}/{x[6].strip()}/{x[7].strip()[:12]}" for x in w)[:1100])
    for l in t:
        if re.match(r'^\| (Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche) ', l): print('  ', l[:110])
        elif re.match(r'^\| (EF|Seuil|VMA|Sortie|Côtes|Fartlek|Allure)', l): print('  S', l[:150])
        elif l.startswith('Total'): print('  ', l[:160])
        elif re.match(r'^\| \*\*(FB|Haut|Bas|Push|Pull|Jambes)', l): print('  M', l[:330])
        elif l.startswith('| Pecs'): i = t.index(l); print('  G', t[i + 2])
        elif l.startswith('- **'): print('  R', l[:200])

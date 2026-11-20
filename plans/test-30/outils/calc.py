"""Aide au calcul des plans papier (outil de développement, pas le moteur de l'appli).
Applique REGLES.md v6 pour la partie chiffrée : allures (A1), niveau (N), volume (N3, U2),
phases (C13, C16), calendrier (C14, S5, S5b, C6, C11, S8, S3). Les conventions H* sont des choix
provisoires (règle absente), listés dans plans/test-30/README.md."""
import json, os, math, sys
from datetime import date, timedelta

D = os.path.dirname(os.path.abspath(__file__))
W1 = date(2026, 11, 23)
COURSES = {
    '10km': dict(dist=10.0, seuil=12, min=8, max=12, pct=(0.30, 0.40, 0.30), aff=1, sl=(75, 90), rec=1),
    'semi': dict(dist=21.0975, seuil=14, min=10, max=14, pct=(0.30, 0.35, 0.35), aff=None, sl=(105, 120), rec=2),
    'marathon': dict(dist=42.195, seuil=20, min=16, max=20, pct=(0.35, 0.30, 0.35), aff=2, sl=(165, 180), rec=3),
}
QUALITE = {  # C15 : première famille = défaut quand une seule qualité
    '10km': {'preparation': ['côtes'], 'fondation': ['côtes', 'fartlek structuré'], 'developpement': ['VMA longue', 'VMA courte'],
             'specifique': ['allure 10 km', 'VMA longue'], 'affutage': ['allure 10 km raccourcie']},
    'semi': {'preparation': ['côtes'], 'fondation': ['côtes', 'seuil'], 'developpement': ['seuil', 'VMA longue'],
             'specifique': ['allure semi', 'seuil'], 'affutage': ['allure semi raccourcie']},
    'marathon': {'preparation': ['côtes'], 'fondation': ['côtes', 'seuil'], 'developpement': ['seuil', 'VMA longue'],
                 'specifique': ['allure marathon', 'seuil'], 'affutage': ['allure marathon raccourcie']},
}
ROTATION_C8 = ['VMA courte', 'VMA longue', 'seuil', 'côtes']  # H6 (rotation déterministe V2, ordre du tableau V)


def mmss(s):
    s = round(s)
    return f"{s // 60}'{s % 60:02d}"


def hms(s):
    s = round(s)
    h, r = divmod(s, 3600)
    return f"{h} h {r // 60:02d}'{r % 60:02d}" if h else f"{r // 60}'{r % 60:02d}"


def riegel(t, d1, d2, e=1.06):
    return t * (d2 / d1) ** e


def allures(t10):
    a = {}
    a['VMA courte (3 km)'] = riegel(t10, 10, 3) / 3
    a['VMA longue (5 km)'] = riegel(t10, 10, 5) / 5
    a['allure 10 km'] = t10 / 10
    a['seuil (15 km)'] = riegel(t10, 10, 15) / 15
    a['allure semi'] = riegel(t10, 10, 21.0975) / 21.0975
    tm = riegel(t10, 10, 42.195, 1.08)
    a['allure marathon'] = tm / 42.195
    a['EF interne'] = tm / 42.195 + 60
    return a, riegel(t10, 10, 21.0975), tm


NIVEAUX = ['debutant', 'intermediaire', 'confirme', 'avance', 'expert']


def niveau(t10):
    m = t10 / 60
    if m >= 60: return 'debutant'
    if m >= 50: return 'intermediaire'
    if m >= 42: return 'confirme'
    if m >= 36: return 'avance'
    return 'expert'


def calcul(p, hypothese_t10=None):
    r = {'id': p['id'], 'notes': [], 'gaps': []}
    obj = p['objectif_course']
    # chrono de référence
    t10 = None
    if p['chrono']:
        c = p['chrono']
        t10 = c['temps_s'] if c['distance'] == 10 else riegel(c['temps_s'], 5, 10)
        r['t10'] = t10
        r['t10_txt'] = mmss(t10) + (' (équivalent du 5 km, N1)' if c['distance'] == 5 else '')
    elif hypothese_t10:
        t10 = hypothese_t10
        r['t10'] = t10
        r['t10_txt'] = f"aucun ; hypothèse de test 6 min en W1 → {mmss(t10)} (T3)"
    if t10:
        nv = niveau(t10)
        if not p['regulier_6_mois'] and nv != 'debutant':
            nv = NIVEAUX[NIVEAUX.index(nv) - 1]
            r['notes'].append('N2 : un niveau en dessous')
        r['niveau'] = nv
        a, ts, tm = allures(t10)
        r['allures'] = {k: mmss(v) for k, v in a.items()}
        r['t_semi'] = hms(ts)
        r['t_marathon'] = hms(tm)
        r['ef_pace'] = a['EF interne']
    else:
        r['niveau'] = 'debutant (N7)'
        r['ef_pace'] = None
    # volume de départ
    if p['volume_unite'] == 'km':
        if r['ef_pace']:
            v0 = p['volume'] * r['ef_pace'] / 60
        else:
            v0 = p['volume'] * 7.5  # H : 7'30/km faute de chrono (U2 impossible)
            r['gaps'].append('km déclarés sans chrono : U2 impossible (7\'30"/km supposé)')
    else:
        v0 = p['volume']
    r['v0'] = round(v0)
    pls = p.get('plus_longue_sortie')
    sl0 = None
    if pls:
        sl0 = pls['valeur'] * (r['ef_pace'] or 450) / 60 if pls['unite'] == 'km' else pls['valeur']
        sl0 = round(sl0)
    r['pls_min'] = sl0
    r['sl0'] = sl0 if sl0 and sl0 >= 60 else None
    return r


def plan_course(p, r, n_sorties, n_qual, tj, tsl, prep_qual=1):
    """Calendrier d'une prépa course. n = semaines avant la semaine de course."""
    obj = p['objectif_course']
    C = COURSES[obj]
    n = p['semaines_avant_course']
    if n > C['seuil']:
        prep, plan = n - C['seuil'], C['seuil']
    else:
        prep, plan = 0, n
    f = round(plan * C['pct'][0]); s = round(plan * C['pct'][2]); d = plan - f - s
    aff = C['aff'] if C['aff'] else (2 if s >= 4 else 1)  # H2 : semi, affûtage 2 sem. si spécifique ≥ 4 sem.
    aff = min(aff, s)
    phases = ['preparation'] * prep + ['fondation'] * f + ['developpement'] * d + ['specifique'] * (s - aff) + ['affutage'] * aff
    r['phases'] = dict(preparation=prep, fondation=f, developpement=d, specifique=s, affutage=aff, plan=plan)
    # sortie longue max (C14)
    bas, haut = C['sl']
    slmax = max(bas, r['sl0'] or 0)
    slmax = min(slmax, haut, tsl)
    r['slmax'] = slmax
    q = min(tj, 55, max(25, r['v0'] / max(1, n_sorties)))  # H3 : qualité ≈ 55 min de contenu (échauffement + corps + retour), au plus le temps du jour
    n_ef = n_sorties - 1 - n_qual
    pic = slmax + (n_sorties - 1) * tj
    r['pic'] = pic
    weeks = []
    first_aff = n - aff + 1
    last_norm = None
    sl_last = r['sl0']
    fin_dev = prep + f + d
    for w in range(1, n + 1):
        ph = phases[w - 1]
        if ph == 'affutage':
            typ = 'affûtage'
        elif w % 4 == 0 and w != first_aff - 1:
            typ = 'allégée'
        else:
            typ = 'normale'
        row = dict(w=w, lundi=(W1 + timedelta(weeks=w - 1)).strftime('%d/%m'), phase=ph, type=typ)
        if w == 1:
            vol = r['v0']
        elif typ == 'normale':
            target_end = fin_dev if w <= fin_dev else n - aff
            left = sum(1 for k in range(w, target_end + 1) if phases[k - 1] != 'affutage' and not (k % 4 == 0 and k != first_aff - 1))
            remaining = pic - last_norm
            inc = remaining / left if left and remaining > 0 else 0
            cap = 0.05 if ph == 'preparation' else 0.10
            inc = min(inc, cap * last_norm)
            vol = last_norm + inc
        elif typ == 'allégée':
            vol = 0.6 * last_norm
        else:  # affûtage
            k = w - first_aff
            if aff == 1:
                vol = 0.6 * last_norm
            else:
                vol = (0.7 if k == 0 else 0.5) * last_norm
        # sortie longue
        if typ == 'normale':
            cap_others = (q * n_qual) + n_ef * tj
            if w == 1 and r['sl0']:
                sl = min(r['sl0'], tsl, slmax)
            elif sl_last:
                sl = min(slmax, sl_last + 15, max(sl_last + min(15, max(0, vol - (last_norm or vol))), vol - cap_others))
                sl = max(sl, min(sl_last, slmax))
            else:
                rem = vol - q * n_qual - n_ef * tj
                sl = rem if rem > tj else (vol - q * n_qual) / (n_ef + 1)
                sl = min(sl, tsl, slmax)
            if vol > sl + cap_others + 0.5:
                row['bloque'] = f"volume plafonné : {round(vol)} visé, {round(sl + cap_others)} possible"
                vol = sl + cap_others
            last_norm = vol
            if sl >= 60:
                sl_last = sl
            row['sl'] = round(sl)
        elif typ == 'allégée':
            row['sl'] = round(0.6 * (sl_last or 0)) if sl_last else None
        else:
            k = w - first_aff
            fac = 0.6 if aff == 1 else (0.7 if k == 0 else 0.5)
            row['sl'] = round(fac * (sl_last or 0)) if sl_last else None
        row['vol'] = round(vol)
        if ph in QUALITE[obj]:
            fam = QUALITE[obj][ph]
            nq = prep_qual if ph == 'preparation' else n_qual
            row['qualite'] = ' + '.join(fam[:nq]) if nq else 'EF seulement'
        weeks.append(row)
    # semaine de course
    rec = dict(w=n + 1, lundi=(W1 + timedelta(weeks=n)).strftime('%d/%m'), phase='course', type='récupération 1')
    if obj == 'marathon':
        rec['vol'] = 'course + EF ≤ 30'
    else:
        rec['vol'] = f"{round(0.5 * last_norm)} (course comprise)"
    weeks.append(rec)
    r['weeks'] = weeks
    return r


if __name__ == '__main__':
    profils = {p['id']: p for p in json.load(open(os.path.join(D, 'profils.json')))}
    for pid in sys.argv[1:] or profils:
        p = profils[pid]
        r = calcul(p)
        print(json.dumps(r, ensure_ascii=False))

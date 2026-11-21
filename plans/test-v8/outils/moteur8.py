"""Application de REGLES.md v8 aux profils de test (outil de développement, PAS le moteur de l'appli).
Chaque décision note les codes de règles appliqués (U8)."""
import json, math, os
from datetime import date, timedelta

ROOT = os.environ.get('MIND_ROOT', os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')))
EXOS = json.load(open(os.path.join(ROOT, 'data/exercices.json')))
EQUIP = EXOS['equipements']
EX = EXOS['exercices']
EXI = {e['id']: e for e in EX}
W1 = date(2026, 11, 23)
JOURS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
JL = {'lun': 'Lundi', 'mar': 'Mardi', 'mer': 'Mercredi', 'jeu': 'Jeudi', 'ven': 'Vendredi', 'sam': 'Samedi', 'dim': 'Dimanche'}
GROUPES = ['pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'quadriceps', 'ischios', 'fessiers', 'mollets', 'abdos']
GL = {'pectoraux': 'Pecs', 'dos': 'Dos', 'epaules': 'Épaules', 'biceps': 'Biceps', 'triceps': 'Triceps', 'quadriceps': 'Quadri',
      'ischios': 'Ischios', 'fessiers': 'Fessiers', 'mollets': 'Mollets', 'abdos': 'Abdos'}
JAMBES = ['quadriceps', 'ischios', 'fessiers']
COURSES = {
    '10km': dict(nom='10 km', dist=10.0, seuil=12, min=8, pct=(0.30, 0.40), aff=1, sl=(75, 90), court=4, csorties=2, cvol=60, ctsl=60),
    'semi': dict(nom='semi', dist=21.0975, seuil=14, min=10, pct=(0.30, 0.35), aff=1, sl=(105, 120), court=6, csorties=2, cvol=90, ctsl=90),
    'marathon': dict(nom='marathon', dist=42.195, seuil=20, min=16, pct=(0.35, 0.30), aff=2, sl=(165, 180), court=8, csorties=3, cvol=180, ctsl=150),
}
C15 = {
    '10km': {'preparation': ['côtes'], 'fondation': ['côtes', 'fartlek'], 'developpement': ['VMA longue', 'VMA courte'],
             'specifique': ['allure 10 km', 'VMA longue'], 'affutage': ['allure 10 km']},
    'semi': {'preparation': ['côtes'], 'fondation': ['côtes', 'seuil'], 'developpement': ['seuil', 'VMA longue'],
             'specifique': ['allure semi', 'seuil'], 'affutage': ['allure semi']},
    'marathon': {'preparation': ['côtes'], 'fondation': ['côtes', 'seuil'], 'developpement': ['seuil', 'allure marathon'],
                 'specifique': ['allure marathon', 'seuil'], 'affutage': ['allure marathon']},
}
ROT = {'garder_forme': ['fartlek', 'côtes', 'seuil', 'VMA longue'], 'courir_plus': ['fartlek', 'côtes', 'seuil', 'VMA longue'],
       'courir_plus_vite': ['VMA courte', 'seuil', 'VMA longue', 'côtes']}
V7 = {'VMA courte': (6, 12), 'VMA longue': (10, 24), 'seuil': (15, 30), 'allure 10 km': (15, 25), 'allure semi': (20, 40),
      'allure marathon': (20, 45), 'côtes': (4, 10), 'fartlek': (6, 12)}
SERIE = {'force': 4.5, 'force_esthetique': 3.0, 'hypertrophie': 2.5, 'tonification': 1.75}
REPS = {'force': '3-5', 'force_esthetique': '6-8', 'hypertrophie': '8-12', 'tonification': '12-20'}
RPE_F = {'force': (7, 9), 'force_esthetique': (6, 9), 'hypertrophie': (6, 8)}
M22T = {1: ((4, 6), (2, 3)), 2: ((8, 10), (4, 6)), 3: ((12, 16), (6, 8))}
M22DEB = {1: 2, 2: 3, 3: 4}  # M22 v8 : secondaire, débutant en muscu
PREP_ROT = ['côtes', 'fartlek', 'seuil']  # C13 v8
E12MAX = {'debutant': 6, 'intermediaire': 7}  # 8 au-delà
NIV = ['debutant', 'intermediaire', 'confirme', 'avance', 'expert']
NIVL = {'debutant': 'débutant', 'intermediaire': 'intermédiaire', 'confirme': 'confirmé', 'avance': 'avancé', 'expert': 'expert'}
ZONE = {'haut': ['pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'abdos'], 'push': ['pectoraux', 'epaules', 'triceps', 'abdos'],
        'pull': ['dos', 'biceps', 'epaules', 'abdos'], 'jambes': ['quadriceps', 'ischios', 'fessiers', 'mollets', 'abdos'],
        'fb': GROUPES}
CHAINE = {'haut': ['developpe_couche_barre', 'developpe_couche_halteres', 'pompes'],
          'pull': ['tractions', 'tractions_assistees', 'rowing_barre', 'rowing_haltere_un_bras', 'rowing_inverse'],
          'jambes': ['squat_barre', 'goblet_squat', 'fentes_bulgares_halteres', 'fentes_bulgares_poids_du_corps']}


def mmss(s):
    s = round(s)
    return f"{s // 60}'{s % 60:02d}"


def hms(s):
    s = round(s); h, r = divmod(s, 3600)
    return f"{h} h {r // 60:02d}" if h else f"{r // 60}'{r % 60:02d}"


def riegel(t, d1, d2, e=1.06):
    return t * (d2 / d1) ** e


class Plan:
    def __init__(self, p):
        self.p = p
        self.msg = []  # (code, texte, type) type: bloq / conseil / prop / info
        self.prop = {}

    def m(self, code, txt, typ='info'):
        self.msg.append((code, txt, typ))


# ---------------------------------------------------------------- profil (E, J5)
def profil(P):
    p = P.p
    jours = list(p['jours'])
    nj = len(jours)
    obj = p['objectif_course']
    muscu_obj = p['objectif_muscu']
    seule = obj == 'pas_de_course' and p.get('sous_objectif') == 'muscu_seule'
    # E1
    if p.get('nb_sorties', 0) != 0 and not seule:
        if p.get('jour_sl') not in jours:
            d = 'dim' if 'dim' in jours else ('sam' if 'sam' in jours else jours[-1])
            if p.get('jour_sl'):
                P.m('E1', f"jour de sortie longue {JL[p['jour_sl']].lower()} hors des jours choisis → {JL[d].lower()} (formulaire)")
            p['jour_sl'] = d
    # J5
    s, mu = p.get('nb_sorties'), p.get('nb_muscu')
    if muscu_obj == 'aucun':
        mu = 0
    if seule:
        s = 0
    prio = p['prioritaire']
    if s == 'jnsp' or mu == 'jnsp':
        if prio == 'course':
            ps = [1, 2, 3, 3, 4, 4, 5][nj - 1]
            pm = [1, 1, 1, 1, 1, 2, 2][nj - 1] if muscu_obj != 'aucun' else 0
        else:
            pm = [1, 2, 2, 3, 3, 4, 4][nj - 1] if muscu_obj != 'aucun' else 0
            mini = COURSES[obj]['csorties'] if obj in COURSES else (0 if seule else 1)
            ps = max(mini, nj - (mu if isinstance(mu, int) else pm))
        if s == 'jnsp':
            s = ps; P.m('J5', f"« je ne sais pas » → {s} sortie(s) proposée(s)")
        if mu == 'jnsp':
            mu = pm; P.m('J5', f"« je ne sais pas » → {mu} séance(s) de muscu proposée(s)")
    # E4
    if s > nj:
        P.m('E4', f"{s} sorties pour {nj} jours : le formulaire bloque à {nj} (J4)", 'bloq'); s = nj
    if mu > nj:
        P.m('E4', f"{mu} séances de muscu pour {nj} jours : le formulaire bloque à {nj}", 'bloq'); mu = nj
    if s + mu > 2 * nj:
        nm = 2 * nj - s
        P.m('E4', f"{s} sorties + {mu} muscu pour {nj} jours : le formulaire bloque la muscu à {nm}", 'bloq'); mu = nm
    p['s'], p['mu'] = s, mu
    doubles = max(0, s + mu - nj)
    p['doubles'] = doubles
    # E3 capacité
    tj, tsl = p['tj'], p.get('tsl') or p['tj']
    p['tsl_user'] = tsl
    if obj in COURSES and s >= 1:
        tsl = min(tsl, COURSES[obj]['sl'][1])  # E3 / S3 : au plus la sortie longue max de la course
    p['tsl'] = tsl
    p['tm'] = p.get('tm') or tj
    recalc(P)


def recalc(P):
    """Jours doublés et capacité (E3), recalculés après chaque contrôle du profil."""
    p = P.p; s = p['s']
    p['doubles'] = max(0, s + p['mu'] - len(p['jours']))
    tsl = p['tsl']
    if getattr(P, 'niv', None) == 'debutant' and p['objectif_course'] in COURSES:
        tsl = min(tsl, max(COURSES[p['objectif_course']]['sl'][0], getattr(P, 'sl0', None) or 0))  # C14 v8
    extra = (p.get('tq', p['tj']) - p['tj']) if s >= 2 else 0  # E10 : jour de qualité à 45 min
    p['capacite'] = (tsl + (s - 1) * p['tj'] + extra) if s >= 1 else 0


def nmin_sorties(p):
    obj = p['objectif_course']
    return COURSES[obj]['csorties'] if obj in COURSES else 1


def controles(P):
    """E10, E12, E13, E14, M16c / M23 (v8). Propositions supposées acceptées (README)."""
    p = P.p; s, mu = p['s'], p['mu']; objm = p['objectif_muscu']
    # E14 : muscu en séances courtes
    if mu >= 3 and p['tm'] < 45:
        P.m('E14', f"{mu} séances de muscu de {p['tm']} min → {mu - 1} séances de 45 min proposées (acceptées)", 'prop')
        mu -= 1; p['tm'] = 45
    # M16c / M23 : force au poids du corps ou en moins de 45 min
    if objm in ('force', 'force_esthetique') and mu and (p['equipement'] == 'poids_du_corps' or p['tm'] < (60 if objm == 'force' else 45)):
        why = 'au poids du corps' if p['equipement'] == 'poids_du_corps' else f"en {p['tm']} min"
        P.m('M23', f"{'force' if objm == 'force' else 'force + esthétique'} {why} : un principal seul ne fait pas une séance → hypertrophie proposée (acceptée)", 'prop')
        p['objectif_muscu'] = 'hypertrophie'
    # E12 : charge totale
    lvl = (P.niv or 'debutant') if s > 0 else p['niveau_muscu']
    mx = E12MAX.get(lvl, 8)
    if s + mu > mx:
        s0, mu0 = s, mu
        order = ['mu', 's'] if p['prioritaire'] == 'course' else ['s', 'mu']
        for k in order:
            while s + mu > mx:
                if k == 'mu' and mu > 1: mu -= 1
                elif k == 's' and s > max(nmin_sorties(p), 1): s -= 1
                else: break
        P.m('E12', f"{s0 + mu0} séances par semaine > {mx} conseillées ({NIVL.get(lvl, lvl)}) → {s} sortie(s) + {mu} muscu proposées (acceptées)", 'prop')
    # E13 : un prioritaire par séance
    prio = p.get('prioritaires', [])
    if mu and len(prio) > mu:
        P.m('E13', f"{len(prio)} muscles prioritaires pour {mu} séance(s) : le formulaire garde les {mu} premiers ({', '.join(GL[g].lower() for g in prio[:mu])})", 'bloq')
        p['prioritaires'] = prio[:mu]
    p['s'], p['mu'] = s, mu
    recalc(P)


def repos(P):
    """P5 v8 : jour de repos gardé, quitte à doubler un jour."""
    p = P.p; s, mu = p['s'], p['mu']
    if len(p['jours']) == 7 and s + mu >= 7 and not p.get('refus_repos') and s + mu <= 12:
        ref = p.get('jour_sl') if s else 'dim'
        j = JOURS[(JOURS.index(ref) - 1) % 7]
        p['jours'] = [x for x in p['jours'] if x != j]
        P.m('P5', f"7 jours sur 7 : {JL[j].lower()} gardé en repos, un jour doublé de plus (J6)")
        recalc(P)


# ---------------------------------------------------------------- niveau, allures, volume (N, A, U2)
def niveau(P):
    p = P.p
    t10 = None
    if p.get('chrono'):
        c = p['chrono']
        t10 = c['t'] if c['d'] == 10 else riegel(c['t'], 5, 10)
        P.prop['chrono'] = mmss(t10) + (' (5 km converti, N1)' if c['d'] == 5 else '')
    elif p['s'] > 0:
        dist = p.get('hyp_test_m', 1100)
        vma = dist / 1000 * 10
        t10 = 10 / (0.85 * vma) * 3600
        P.prop['chrono'] = f"aucun → test 6 min en W1 (N7) ; hypothèse : {dist} m, VMA {vma:.1f} → {mmss(t10)} (T3)"
        P.m('N7', "sans chrono : semaine 1 en EF seulement + test 6 min ; la table N s'applique dès le résultat")
    P.t10 = t10
    if t10:
        m = t10 / 60
        nv = 'debutant' if m >= 60 else 'intermediaire' if m >= 50 else 'confirme' if m >= 42 else 'avance' if m >= 36 else 'expert'
        if not p['regulier'] and nv != 'debutant':
            nv = NIV[NIV.index(nv) - 1]; P.m('N2', "pas régulier depuis 6 mois → un niveau en dessous")
        P.niv = nv
        tm = riegel(t10, 10, 42.195, 1.08)
        P.al = {'VMA courte': riegel(t10, 10, 3) / 3, 'VMA longue': riegel(t10, 10, 5) / 5, 'allure 10 km': t10 / 10,
                'seuil': riegel(t10, 10, 15) / 15, 'allure semi': riegel(t10, 10, 21.0975) / 21.0975,
                'allure marathon': tm / 42.195}
        P.ef = tm / 42.195 + 60
        P.tsemi, P.tmara = riegel(t10, 10, 21.0975), tm
    else:
        P.niv, P.al, P.ef = None, {}, None
    controles(P)
    # volume (N3, E2, E3)
    if p['s'] == 0:
        P.v0 = 0; P.sl0 = None; return
    if p['vol_unite'] == 'km':
        if not p.get('chrono'):
            P.m('E2', "volume en km sans chrono : le formulaire demande des minutes ; 7'30/km supposé", 'bloq')
            v = p['vol'] * 7.5
        else:
            v = p['vol'] * P.ef / 60
    else:
        v = p['vol']
    v = round(v)
    P.vdecl = v
    pls = p.get('pls')
    sl0 = None
    if pls:
        sl0 = round(pls['v'] * P.ef / 60) if pls['u'] == 'km' and P.ef else (pls['v'] if pls['u'] == 'min' else round(pls['v'] * 7.5))
        if sl0 > p['tsl']:
            P.m('N3b', f"plus longue sortie récente {sl0} min > temps de sortie longue choisi ({p['tsl']} min) → {p['tsl']} min")
            sl0 = p['tsl']
    P.sl0 = sl0 if sl0 and sl0 >= 60 else None
    recalc(P)
    # E11 : répartition des sorties
    s = p['s']; nj = len(p['jours'])
    if s >= 2 and v / s < 25:
        ns = max(nmin_sorties(p), min(s, v // 30))
        if ns < s:
            P.m('E11', f"{s} sorties de {round(v / s)} min en moyenne → {ns} sortie(s) de {round(v / ns)} min proposées (acceptées)", 'prop')
            p['s'] = ns
    elif s == 1 and v > 90 and nj >= 2 and 2 + p['mu'] <= 2 * nj:
        P.m('E11', f"sortie unique de {v} min → 2 sorties proposées (acceptées)", 'prop')
        p['s'] = 2
    # E10 : qualité trop courte (volume ≥ 120 min, sinon V7 la limite déjà)
    if P.niv and P.niv != 'debutant' and p['tj'] < 45 and p['s'] >= 2 and v >= 120:
        if p['objectif_course'] == 'marathon':
            P.m('E10', f"marathon avec {p['tj']} min par sortie en semaine → 45 min pour toutes les sorties de semaine proposées (acceptées)", 'prop')
            p['tm'] = p.get('tm') or p['tj']; p['tj'] = 45
        else:
            P.m('E10', f"qualités en {p['tj']} min pour un coureur {NIVL[P.niv]} → 45 min le jour de la qualité proposées (acceptées)", 'prop')
            p['tq'] = 45
    recalc(P)
    cap = p['capacite']
    if v > cap:
        P.m('E3', f"tu déclares {v} min, tes séances en contiennent {cap} → départ à {cap} min (ou plus de temps / une sortie de plus)", 'conseil')
        v = cap
    if P.niv == 'debutant' and v > 240:
        P.m('E9', "plus de 4 h par semaine en niveau débutant : confirmation demandée", 'conseil')
    if p['s'] and v / p['s'] > 120:
        P.m('E9', "plus de 2 h en moyenne par sortie : confirmation demandée", 'conseil')
    P.v0 = v


def intenses(P, v, phase):
    """N8 : nombre de qualités et famille douce."""
    p = P.p
    if P.niv is None:
        return 0, False
    table = {'debutant': 1, 'intermediaire': 2 if p['regulier'] else 1, 'confirme': 2, 'avance': 2, 'expert': 2}[P.niv]
    n = table
    if p['s'] <= 3: n = min(n, 1)
    if v < 150: n = min(n, 1)
    if phase == 'preparation' or p['prioritaire'] == 'muscu': n = min(n, 1)
    if p['s'] == 1: n = 0
    if phase == 'c8' and p.get('sous_objectif') in ('garder_forme', 'courir_plus'): n = min(n, 1)  # C8 v8 (aussi après un refus C9)
    n = min(n, max(0, p['s'] - 1))
    douce = v < 90
    return n, (table == 2 and n == 1 and p['s'] <= 3)


# ---------------------------------------------------------------- séances de qualité (V7)
def qualite(P, fam, frac, typ, tj, debutant, vsem=999):
    """frac = position dans la phase (0 → 1). Retourne dict(texte, duree, rapide)."""
    lo, hi = V7[fam]
    if debutant:
        hi = (lo + hi) / 2
    if typ == 'affutage':
        work = lo
    else:
        work = lo + (hi - lo) * frac
        if typ == 'allegee':
            work *= 0.6
    wu, cd = (10, 5) if (tj <= 30 or vsem < 120) else (15, 10)
    al = P.al

    def build(work):
        if fam == 'VMA courte':
            if debutant:
                n = max(4, round(work / 0.5)); t = f"{n} × 30″ vite / 30″ trot"; fast = n * 0.5; rec = n * 0.5
            else:
                rt = al['VMA courte'] * 0.4 / 60; n = max(4, round(work / rt)); fast = n * rt; rec = n * rt
                t = f"{n} × 400 m en {mmss(rt * 60)}, récup même durée trot"
        elif fam == 'VMA longue':
            d = 800 if (debutant or al['VMA longue'] > 360) else 1000
            for dd in ([1000, 800, 600] if d == 1000 else [800, 600]):  # V7 v8 : au moins 3 fractions, sinon plus courtes
                d = dd
                if round(work / (al['VMA longue'] * dd / 1000 / 60)) >= 3:
                    break
            rt = al['VMA longue'] * d / 1000 / 60; n = max(2, round(work / rt)); fast = n * rt; rec = (n - 1) * rt / 2
            t = f"{n} × {d} m en {mmss(rt * 60)}, récup {mmss(rt * 30)} trot"
        elif fam == 'seuil':
            nb = 2 if work <= 20 else 3; b = max(5, round(work / nb)); fast = nb * b; rec = (nb - 1) * 2
            t = f"{nb} × {b}' à {mmss(al['seuil'])}/km, récup 2' trot"
        elif fam == 'allure 10 km':
            rt = al['allure 10 km'] / 60; n = max(2, round(work / rt)); fast = n * rt; rec = (n - 1) * 2
            t = f"{n} × 1000 m en {mmss(rt * 60)}, récup 2' trot"
        elif fam in ('allure semi', 'allure marathon'):
            nb = max(1, round(work / (10 if fam == 'allure semi' else 15))); b = round(work / nb); fast = nb * b; rec = (nb - 1) * 2
            t = f"{nb} × {b}' à {mmss(al[fam])}/km" + (", récup 2' trot" if nb > 1 else "")
        elif fam == 'côtes':
            if work >= 6:
                n = round(work); fast = n; rec = n * 2; t = f"{n} × 1' en côte, récup descente trottée"
            else:
                n = max(6, round(work / 0.5)); fast = n * 0.5; rec = n * 1.5; t = f"{n} × 30″ en côte, récup descente trottée"
        else:  # fartlek
            n = max(4, round(work)); fast = n; rec = n; t = f"{n} × (1' vite / 1' souple)"
        return t, fast, rec

    t, fast, rec = build(work)
    lim = min(tj, max(25, 0.4 * vsem))
    while wu + fast + rec + cd > lim and work > 1:
        work -= 1; t, fast, rec = build(work)
    if work < lo * 0.6 and typ != 'allegee':
        # D4 : séance trop courte → fartlek court
        t, fast, rec = build(work)
    dur = wu + fast + rec + cd
    gam = ' + gammes' if fam not in ('allure marathon',) else ''
    return dict(fam=fam, texte=f"{wu} min EF{gam} ; **{t}** ; {cd} min retour au calme", duree=round(dur), rapide=round(fast), work=work)


# ---------------------------------------------------------------- calendrier course (C)
def phases_course(P):
    p = P.p; C = COURSES[p['objectif_course']]
    n = p['semaines']
    if n > C['seuil']:
        prep, plan = n - C['seuil'], C['seuil']
    else:
        prep, plan = 0, n
    aff = C['aff']
    f = round(plan * C['pct'][0]); s = round(plan * (1 - C['pct'][0] - C['pct'][1]))
    s = max(s, aff + 1) if plan >= aff + 2 else s
    d = plan - f - s
    if d < 0:
        f += d; d = 0
    P.court = plan < C['min']
    if plan < C['min']:
        P.m('C4', f"{plan} semaines < {C['min']} conseillées : phases compressées (affûtage gardé, au moins 1 semaine spécifique), hausse +5 %/sem. au plus", 'conseil')
    ph = ['preparation'] * prep + ['fondation'] * f + ['developpement'] * d + ['specifique'] * (s - aff) + ['affutage'] * aff
    P.phases = dict(preparation=prep, fondation=f, developpement=d, specifique=s - aff, affutage=aff)
    return ph


def calendrier(P, mode):
    """mode: course / finir / c8. Simule semaine par semaine volume, SL, EF, qualités."""
    p = P.p; s = p['s']; tj, tsl = p['tj'], p['tsl']
    tq = p.get('tq', tj)  # E10
    obj = p['objectif_course']
    P.p7doux = s >= 2 and not any(gap(j, p['jour_sl']) >= 2 for j in p['jours'] if j != p['jour_sl'])  # P7 v8
    if mode in ('course', 'finir'):
        C = COURSES[obj]
        n = p['semaines']
        if mode == 'course':
            ph = phases_course(P)
        else:
            aff = C['aff']; ph = ['specifique'] * (n - aff) + ['affutage'] * aff
            P.phases = dict(preparation=0, fondation=0, developpement=0, specifique=n - aff, affutage=aff)
        bas, haut = C['sl']
        cible = min(max(bas, P.sl0 or 0), haut, tsl)
        if P.niv == 'debutant':
            tsl = min(tsl, cible)  # C14 v8 : débutant, pas de hausse au-delà de la cible
    else:
        n = 8; ph = ['c8'] * n
        cible = min(tsl, max(90, P.sl0 or 0)) if p.get('sous_objectif') == 'courir_plus' else (P.sl0 or 0)  # C8 v8
        tsl = min(tsl, max(90, P.sl0 or 0))
    P.slcible = cible
    first_aff = (ph.index('affutage') + 1) if 'affutage' in ph else 999
    # types de semaine (S5, S5b)
    types = []
    for w in range(1, n + 1):
        if ph[w - 1] == 'affutage': types.append('affûtage')
        elif w % 4 == 0 and w != first_aff - 1: types.append('allégée')
        else: types.append('normale')
    # index dans la phase (V7)
    pos = {}
    for k in set(ph):
        idx = [w for w in range(1, n + 1) if ph[w - 1] == k and types[w - 1] == 'normale']
        for i, w in enumerate(idx):
            pos[w] = i / (len(idx) - 1) if len(idx) > 1 else 0.5
    deb = P.niv == 'debutant'
    weeks = []
    last = None  # dernière semaine normale : dict
    fin_dev = max([w for w in range(1, n + 1) if ph[w - 1] in ('preparation', 'fondation', 'developpement')] or [0])
    plafond = p.get('plafond') or p['capacite']
    nn = 0  # C15 v8 : compteur des semaines normales (débutant)
    for w in range(1, n + 1):
        phase, typ = ph[w - 1], types[w - 1]
        row = dict(w=w, lundi=(W1 + timedelta(weeks=w - 1)).strftime('%d/%m'), phase=phase, type=typ)
        # volume visé
        if w == 1:
            V = P.v0
        elif typ == 'normale':
            if mode == 'course' and w <= fin_dev:
                left = sum(1 for k in range(w, fin_dev + 1) if types[k - 1] == 'normale')
                V = last['V'] + (row_pic - last['V']) / left if left and row_pic > last['V'] else last['V']
                cap = 0.05 if (phase == 'preparation' or P.court or deb) else 0.10  # C14 v8 : débutant +5 %
                V = min(V, last['V'] * (1 + cap))
            elif mode == 'c8' and p.get('sous_objectif') == 'courir_plus':
                V = min(last['V'] * (1.05 if deb else 1.10), plafond)  # C8 v8 : débutant +5 %
            elif mode == 'finir':
                V = last['V'] + min(15, max(0, cible - last['SL']), 0.10 * last['V'])
            elif mode == 'c8':
                V = max(last['V'], min(P.v0, last['V'] * 1.10))  # C8 stable : retour au volume déclaré (S1, S8)
            else:
                V = last['V']
        elif typ == 'allégée':
            V = 0.6 * last['V']
        else:
            k = w - first_aff
            V = (0.6 if C['aff'] == 1 else (0.7 if k == 0 else 0.5)) * last['V']
        # qualités
        vref = V
        if mode == 'c8':
            fams = [ROT[p['sous_objectif']][(w - 1) % 4]] if p.get('sous_objectif') in ROT else []
            nq, prop2 = intenses(P, vref, 'c8')
        else:
            nq, prop2 = intenses(P, vref, phase)
            fams = C15[obj]['affutage' if phase == 'affutage' else phase]
            if phase == 'preparation':
                fams = [PREP_ROT[(w - 1) % 3]]  # C13 v8 : rotation
            if mode == 'finir':
                fams = C15[obj]['affutage']; nq = min(nq, 1)
            if deb and mode == 'course' and typ == 'normale' and phase in ('fondation', 'developpement', 'specifique') and nq:
                nn += 1
                if nn % 2 == 0:
                    fams = ['fartlek']  # C15 v8 : débutant, fartlek une semaine normale sur deux
        if P.niv is None or (w == 1 and not p.get('chrono')):
            nq = 0
        if vref < 90 and nq:
            fams = ['côtes'] if fams[0] == 'côtes' else ['fartlek']
        if P.p7doux and nq:
            fams = [('fartlek' if (deb or vref < 90) else 'seuil') if f in ('VMA courte', 'VMA longue', 'côtes', 'allure 10 km') else f for f in fams]  # P7 v8
        qs = []
        for i in range(nq):
            fam = fams[min(i, len(fams) - 1)] if i < len(fams) else fams[-1]
            if i == 1 and fam == qs[0]['fam']:
                fam = 'seuil' if fam != 'seuil' else 'VMA longue'
            qtyp = 'affutage' if typ == 'affûtage' else ('allegee' if typ == 'allégée' else 'normale')
            qs.append(qualite(P, fam, pos.get(w, 0.0), qtyp, tq, deb, vref))
        Q = sum(q['duree'] for q in qs)
        n_ef = s - 1 - len(qs) if s >= 2 else 0
        # sortie longue + EF (C14 répartition)
        if s == 1:
            sl = min(V, tsl); efs = []
        elif w == 1 or last is None:
            rest = V - Q
            if P.sl0:
                sl = min(P.sl0, rest, cible if mode != 'c8' else tsl); e = (rest - sl) / n_ef if n_ef else 0
                e = min(e, tj); efs = [e] * n_ef
            else:
                e = rest / (n_ef + 1.5)
                e = min(e, tj); sl = min(rest - e * n_ef, tsl); efs = [e] * n_ef
        elif typ == 'normale' and last['SL'] < 60 and not P.sl0 and n_ef >= 0:
            rest = V - Q
            cmin = COURSES[obj]['ctsl'] if mode in ('course', 'finir') else 0
            if cmin and n_ef:  # C14 v8 : la hausse va d'abord à la future sortie longue
                gain = max(0, rest - (last['SL'] + sum(last['EF'])))
                sl = min(last['SL'] + gain, last['SL'] + 15, tsl, rest - 20 * n_ef)
                e = min((rest - sl) / n_ef, tj, sl); efs = [e] * n_ef
            else:
                e = min(rest / (n_ef + 1.5), tj); efs = [e] * n_ef
                sl = min(rest - e * n_ef, tsl)
            if sl < e:
                sl = e
        elif typ == 'normale':
            sl = last['SL']; efs = list(last['EF']) + [last['EF'][-1] if last['EF'] else 0] * (n_ef - len(last['EF']))
            efs = efs[:n_ef]
            r = V - Q - (sl + sum(efs))
            if r > 0:
                room_sl = max(0, min(sl + 15, max(cible, sl) if mode != 'c8' else tsl, tsl) - sl) if sl >= 60 or mode != 'c8' else max(0, min(tsl, sl + 15) - sl)
                cmin = COURSES[obj]['ctsl'] if mode in ('course', 'finir') else 0
                a = min(r if sl < cmin else r / 2, room_sl)  # C14 v8 : sortie longue d'abord sous le minimum C9
                capef = min(tj, sl + a) if sl >= 60 else tj
                room_ef = sum(max(0, capef - e) for e in efs)
                b = min(r - a, room_ef)
                extra = r - a - b
                a2 = min(extra, room_sl - a); a += a2
                if extra - a2 > 0 and mode in ('course', 'finir'):
                    haut = min(COURSES[obj]['sl'][1], tsl)
                    a3 = min(extra - a2, max(0, min(sl + 15, haut) - (sl + a))); a += a3
                lost = r - a - b
                sl += a
                if efs and b > 0:
                    for _ in range(100):
                        if b <= 0.01: break
                        free = [i for i, e in enumerate(efs) if e < capef - 0.01]
                        if not free: break
                        add = b / len(free)
                        for i in free:
                            d = min(add, capef - efs[i]); efs[i] += d; b -= d
                if lost > 1:
                    row['perdu'] = round(lost)
                    V -= lost
            if False and mode == 'finir' and efs and sl < cible:
                mv = min(15, cible - sl, sum(max(0, e - 30) for e in efs))
                sl += mv
                for i in range(len(efs)):
                    d = min(mv, max(0, efs[i] - 30)); efs[i] -= d; mv -= d
            if r < 0:
                cut = -r
                for i in range(len(efs)):
                    d = min(cut, efs[i] - 30 if efs[i] > 30 else 0); efs[i] -= d; cut -= d
                over = Q + sl + sum(efs) - last['V'] * 1.10
                if over > 0 and len(qs) > 1:  # C14 v8 : la 2e qualité saute plutôt que la sortie longue
                    qs = qs[:1]; Q = qs[0]['duree']; n_ef += 1
                    rest = last['V'] * 1.10 - Q - sl
                    efs = [max(0, min(tj, sl, rest / n_ef))] * n_ef
                elif over > 0:
                    sl -= over
        elif typ == 'allégée':
            sl = 0.6 * last['SL']; efs = [0.6 * e for e in last['EF']][:n_ef]; efs += [efs[-1] if efs else 0] * (n_ef - len(efs))
        else:
            k = w - first_aff; fac = 0.6 if C['aff'] == 1 else (0.7 if k == 0 else 0.5)
            sl = fac * last['SL']; efs = [fac * e for e in last['EF']][:n_ef]; efs += [efs[-1] if efs else 0] * (n_ef - len(efs))
        V = Q + sl + sum(efs)
        row.update(V=V, SL=sl, EF=efs, Q=qs, nq=len(qs), prop2=prop2)
        if typ == 'normale':
            last = row
        if w == 1 and mode == 'course':
            pass
        weeks.append(row)
        if w == 1:
            # pic (C14) : SL cible + EF au temps du jour + qualités à leur durée de fin de développement
            if mode == 'course':
                nq_pic, _ = intenses(P, 10 ** 6 if P.v0 >= 150 else P.v0, 'developpement')
                fam_dev = C15[obj]['developpement']
                qpic = sum(qualite(P, fam_dev[min(i, 1)], 1.0, 'normale', tq, deb)['duree'] for i in range(nq_pic))
                row_pic = cible + max(0, s - 1 - nq_pic) * tj + qpic if s >= 2 else cible
                capv = max(1.6 * P.v0, P.v0 + 60)
                if row_pic > capv:
                    P.m('C14', f"pic ({round(row_pic)} min) plafonné à {round(capv)} min (départ × 1,6 ou départ + 60 min)")
                    row_pic = capv
                P.pic = round(row_pic)
                if row_pic <= P.v0:
                    P.m('C14', f"pic ({round(row_pic)} min) ≤ départ ({P.v0} min) : volume maintenu, progression par le contenu des qualités (V7)")
                    row_pic = P.v0
            else:
                row_pic = P.v0
    # tests (T4) : dernière semaine normale de fondation
    if mode == 'course':
        fond = [w for w in range(1, n + 1) if ph[w - 1] == 'fondation' and types[w - 1] == 'normale']
        if fond and weeks[fond[-1] - 1]['Q']:
            weeks[fond[-1] - 1]['test'] = True
    if mode == 'c8' and p.get('sous_objectif') == 'courir_plus_vite' and weeks[7]['type'] != 'normale':
        pass
    P.weeks = weeks
    P.mode = mode
    # semaine de course (C11)
    if mode in ('course', 'finir'):
        lastn = max((w for w in weeks if w['type'] == 'normale'), key=lambda w: w['w'])
        rec = 'course + EF ≤ 30 min' if obj == 'marathon' else f"{round(0.5 * lastn['V'])} (course comprise)"
        P.course_week = dict(w=n + 1, lundi=(W1 + timedelta(weeks=n)).strftime('%d/%m'), vol=rec)
    if P.p7doux and any(w['nq'] for w in weeks):
        P.m('P7', "écart J+2 avec la sortie longue impossible avec ces jours → pas de VMA, de côtes ni d'allure 10 km à côté de la sortie longue : seuil (ou fartlek), sortie longue facile")
    if mode == 'c8' and s == 1 and p.get('sous_objectif') == 'courir_plus_vite':
        P.m('C8', "une sortie par semaine reste facile : 2 sorties minimum pour progresser en vitesse")
    if mode == 'c8' and p.get('sous_objectif') != 'courir_plus':
        vmin = min(w['V'] for w in weeks if w['type'] == 'normale')
        if vmin < P.v0 - 5:
            P.m('C14', f"la qualité remplace une sortie facile : volume {P.v0} → {round(vmin)} min au plus bas (la sortie longue reprend la différence, +15 min par semaine au plus)")
    if mode == 'finir':
        P.m('C5', f"sortie longue la plus longue de ce plan : {round(max(w['SL'] for w in weeks))} min")
    parts = [w['SL'] / w['V'] for w in weeks if w['type'] == 'normale' and w['V'] and w['SL'] >= 60]
    if parts and max(parts) > 0.55:
        P.m('J8', f"sortie longue jusqu'à {round(100 * max(parts))} % du volume (> 55 %) → une sortie de plus est proposée", 'prop')
    perdu = sum(w.get('perdu', 0) for w in weeks)
    if perdu > 15:
        P.m('J8', f"{perdu} min de hausse perdues faute de place dans les séances → une sortie de plus est proposée", 'prop')
    if mode == 'course':
        dev_end = [w for w in weeks if w['phase'] in ('developpement', 'fondation', 'preparation')]
        if dev_end and max(w['SL'] for w in weeks) < cible - 1:
            P.m('J8', f"sortie longue cible ({cible} min) non atteinte → sortie de plus proposée", 'prop')
        if cible < COURSES[obj]['sl'][0]:
            P.m('C14', f"sortie longue cible plafonnée à {cible} min par le temps choisi (bas de fourchette {COURSES[obj]['sl'][0]} min)", 'conseil')


# ---------------------------------------------------------------- placement (P)
def gap(a, b):
    d = abs(JOURS.index(a) - JOURS.index(b))
    return min(d, 7 - d)


def veille(j):
    return JOURS[(JOURS.index(j) + 1) % 7]


def placement(P, week):
    p = P.p; jours = p['jours']; s = p['s']
    pl = {j: {'course': None, 'muscu': None} for j in jours}
    longue = None
    if s >= 1:
        longue = p['jour_sl']
        pl[longue]['course'] = 'SL'
    nq = week['nq']
    qdays = []
    from itertools import combinations
    free0 = [j for j in jours if not pl[j]['course']]
    best = None
    for combo in (combinations(free0, nq) if nq else []):
        ok = all(gap(j, longue) >= 2 for j in combo) if longue else True
        ok = ok and all(gap(a, b) >= 2 for a, b in combinations(combo, 2))
        if not ok: continue
        sc = min(min((JOURS.index(longue) - JOURS.index(j)) % 7, (JOURS.index(j) - JOURS.index(longue)) % 7) for j in combo) if longue else 3
        key = (sc, [-JOURS.index(j) for j in combo])
        if best is None or key > best[0]:
            best = (key, combo)
    if best:
        qdays = list(best[1])
    elif nq:
        cands = [j for j in free0 if not longue or gap(j, longue) >= 1]
        for j in cands:
            if len(qdays) == nq: break
            if all(gap(j, q) >= 2 for q in qdays): qdays.append(j)
        for j in free0:
            if len(qdays) == nq: break
            if j not in qdays: qdays.append(j)
        P.m('P7', "écart J+2 avec la sortie longue (ou 48 h entre qualités) impossible avec ces jours → " + ', '.join(JL[q].lower() for q in qdays) + " (conseil)", 'conseil')
    for i, q in enumerate(qdays):
        pl[q]['course'] = f'Q{i + 1}'
    n_ef = s - 1 - nq if s >= 1 else 0
    efdays = []
    for _ in range(n_ef):
        free = [j for j in jours if not pl[j]['course']]
        hard = [x for x in [longue] + qdays if x]
        if not free:
            break
        sc = [(1 if j in (p.get('jours_doubles') or []) else 0, min([gap(j, h) for h in hard] or [3]), -JOURS.index(j), j) for j in free]  # P11 : jour doublé choisi → course
        sc.sort(reverse=True)
        j = sc[0][-1]; efdays.append(j); pl[j]['course'] = 'EF'
    # muscu (P13)
    mu = p['mu']
    sessions = organisation(P)
    free = [j for j in jours if not pl[j]['course']]
    dbl_order = efdays + qdays + ([longue] if longue else [])
    mdays = free[:mu]
    extra = mu - len(mdays)
    dbl = []
    hardnext0 = set(qdays + ([longue] if longue else []))
    lok = lambda j: veille(j) not in hardnext0 and j != longue
    if extra > 0:
        has_legs = any(x['type'] == 'jambes' for x in sessions)
        if has_legs and not any(lok(d) for d in mdays):
            pref = [d for d in qdays + efdays if lok(d)]
            dbl_order = pref + [d for d in dbl_order if d not in pref]
        if p.get('jours_doubles'):
            ch = [d for d in p['jours_doubles'] if d in jours and pl[d]['course']]
            dbl = sorted((ch + [d for d in dbl_order if d not in ch])[:extra], key=JOURS.index)
            P.m('J6', "jour(s) doublé(s) choisi(s) par l'utilisateur : " + ', '.join(JL[d].lower() for d in dbl))
        else:
            dbl = sorted(dbl_order[:extra], key=JOURS.index)
            P.m('J6', "jour(s) doublé(s) supposé(s) choisi(s) par l'utilisateur : " + ', '.join(JL[d].lower() for d in dbl))
        mdays = sorted(mdays + dbl, key=JOURS.index)
    hardnext = set(qdays + ([longue] if longue else []))

    def lourd_ok(j):
        return veille(j) not in hardnext and j != longue
    # assigner les séances aux jours : jambes d'abord sur un jour permis
    assign = {}
    order = sorted(range(len(sessions)), key=lambda i: 0 if sessions[i]['type'] in ('jambes',) else 1)
    days_left = list(mdays)
    for i in order:
        st = sessions[i]
        if st['type'] == 'jambes':
            okd = [d for d in days_left if lourd_ok(d)]
            legs_done = [assign[k] for k in assign if sessions[k]['type'] == 'jambes']
            if legs_done and len(okd) > 1:  # P13 v8 : séances jambes le plus espacées possible
                okd.sort(key=lambda d: (-min(gap(d, x) for x in legs_done), JOURS.index(d)))
            d = okd[0] if okd else days_left[0]
            if not okd:
                st['force_leger'] = True
                P.m('P13', "aucun jour ne respecte P2 pour la séance jambes → jambes en léger cette semaine", 'conseil')
        else:
            d = None
            for dd in days_left:
                d = dd; break
        days_left.remove(d); assign[i] = d
    for i, d in assign.items():
        sessions[i]['jour'] = d
        sessions[i]['lourd_ok'] = lourd_ok(d) and not sessions[i].get('force_leger')
        pl[d]['muscu'] = i
    sessions.sort(key=lambda x: JOURS.index(x['jour']))
    rest = [j for j in JOURS if j not in jours or (not pl[j]['course'] and pl[j]['muscu'] is None)]
    if not rest:
        if p.get('refus_repos'):
            nb = s + mu
            P.m('P5', "refus du jour de repos accepté (confirmation)" + (" — conseil fort : plus de 7 séances" if nb > 7 else ""), 'conseil')
        else:
            P.m('P5', "aucun jour de repos : à confirmer", 'conseil')
    return pl, sessions, longue, qdays, efdays


# ---------------------------------------------------------------- muscu (M)
def organisation(P):
    p = P.p; mu = p['mu']
    if mu == 0:
        return []
    org = p.get('organisation', 'je_ne_sais_pas')
    jl = jambes_legeres(P)
    valid = {1: ['full_body'], 2: ['full_body', 'haut_bas'], 3: ['full_body', 'haut_jambes_fb', 'ppj', 'pph'],
             4: ['haut_bas', 'ppjfb'], 5: ['ppj'], 6: ['ppj'], 7: ['ppj']}[mu]
    if mu == 3:
        default = 'full_body' if jl else 'haut_jambes_fb'
    else:
        default = valid[0]
    if org == 'je_ne_sais_pas' or org is None:
        org = default
    elif org == 'pph' and any(g in p.get('prioritaires', []) for g in JAMBES):
        P.m('E5', "push / pull / haut (sans jambes) impossible avec un muscle des jambes prioritaire → " + {'full_body': 'full body', 'haut_jambes_fb': 'haut / jambes / full body'}.get(default, default), 'bloq')
        org = default
    elif org not in valid:
        LAB = {'full_body': 'full body', 'haut_bas': 'haut / bas', 'ppj': 'push / pull / jambes', 'pph': 'push / pull / haut', 'haut_jambes_fb': 'haut / jambes / full body', 'ppjfb': 'push / pull / jambes / full body'}
        P.m('E5', f"organisation « {LAB.get(org, org)} » impossible pour {mu} séance(s) : le formulaire ne la propose pas → {LAB.get(default, default)}", 'bloq')
        org = default
    P.org = org
    seq = {'full_body': [('fb', 'haut'), ('fb', 'jambes'), ('fb', 'pull'), ('fb', 'haut')],
           'haut_bas': [('haut', 'haut'), ('jambes', 'jambes')] * 2,
           'haut_jambes_fb': [('haut', 'haut'), ('jambes', 'jambes'), ('fb', 'pull')],
           'ppj': [('push', 'haut'), ('pull', 'pull'), ('jambes', 'jambes')] * 3,
           'pph': [('push', 'haut'), ('pull', 'pull'), ('haut', 'haut')],
           'ppjfb': [('push', 'haut'), ('pull', 'pull'), ('jambes', 'jambes'), ('fb', 'haut')]}[org]
    out = []
    for i in range(mu):
        zone, typ = seq[i % len(seq)]
        out.append(dict(zone=zone, type=typ if zone != 'jambes' else 'jambes', nom=nom_seance(zone, i, org)))
    for o in out:
        if o['zone'] == 'jambes': o['type'] = 'jambes'
    return out


def nom_seance(zone, i, org):
    return {'fb': f'FB{i + 1}', 'haut': 'Haut', 'jambes': 'Jambes' if org in ('ppj', 'haut_jambes_fb', 'ppjfb') else 'Bas',
            'push': 'Push', 'pull': 'Pull'}[zone]


def jambes_legeres(P):
    p = P.p
    if p['objectif_muscu'] == 'tonification':
        return False
    return bool(p.get('renfo')) and not any(g in p.get('prioritaires', []) for g in JAMBES)


def dispo(P, e):
    p = P.p
    if e['materiel'] not in EQUIP[p['equipement']]:
        return False
    if e['id'] == 'tractions' and p.get('tractions', 0) < 1:
        return False
    if e['id'] == 'tractions_assistees' and p.get('tractions', 0) >= 1 and e['materiel'] in EQUIP[p['equipement']]:
        return False
    if e['muscle_principal'] in p.get('exclus', []):
        return False
    return True


def muscu(P, sessions, week_no):
    p = P.p; mu = p['mu']; objm = p['objectif_muscu']
    if not sessions:
        return
    st = SERIE[objm]; T = min(p.get('tm') or p['tj'], 75)  # M23 v8 : 75 min au plus
    if (p.get('tm') or p['tj']) > 75:
        P.m('M23', f"séance de muscu limitée à 75 min (temps choisi : {p.get('tm') or p['tj']} min)")
    prio = p.get('prioritaires', []); excl = p.get('exclus', [])
    k = min(mu, 3)
    (pmin, pmax), (smin, smax) = M22T[k]
    if p['niveau_muscu'] == 'debutant':
        smin = smax = M22DEB[k]  # M22 v8
    tgt = {g: ((pmin, pmax) if g in prio else (0, 0) if g in excl else (smin, smax)) for g in GROUPES}
    cnt = {g: 0 for g in GROUPES}
    used = set()
    jl = jambes_legeres(P)
    if objm in RPE_F:
        lo, hi = RPE_F[objm]; bw = ((week_no - 1) % 4) + 1
        rpe = '~7 (calibrage)' if week_no == 1 else str(round(lo + (hi - lo) * (min(bw, 3) - 1) / 2))
    else:
        rpe = None
    # M11
    for g in GROUPES:
        if g in excl: continue
        if not any(dispo(P, e) and e['muscle_principal'] == g for e in EX):  # M8 v8 : spécifique en dernier recours
            P.m('M11', f"{GL[g].lower()} : aucun exercice possible avec ce matériel", 'conseil')
    cles = ['dos', 'abdos'] + JAMBES
    if p['objectif_course'] in COURSES and any(g in excl for g in cles):
        P.m('M11', "exclusion d'un groupe clé pour un coureur (" + ', '.join(GL[g].lower() for g in excl if g in cles) + ") : déconseillé ; version légère proposée (1 exercice, 2 séries, RPE ≤ 6) ; hypothèse : l'exclusion est maintenue", 'conseil')
    renfo = bool(p.get('renfo'))
    renfo_list = [e for e in EX if e.get('contexte') == 'renfo_coureur' and dispo(P, e)]
    # principal (M6)
    for s in sessions:
        typ = s['type']
        order = {'jambes': ['jambes', 'pull', 'haut'], 'pull': ['pull', 'haut', 'jambes'], 'haut': ['haut', 'pull', 'jambes']}[typ]
        if s['zone'] == 'push': order = ['haut', 'pull', 'jambes']
        if s['zone'] == 'pull': order = ['pull', 'haut', 'jambes']
        no_legs = jl or not s.get('lourd_ok', True)
        if objm == 'tonification':
            no_legs = not s.get('lourd_ok', True)
        chosen = None
        for t in order:
            zone_m = {'haut': ['pectoraux', 'epaules'], 'pull': ['dos'], 'jambes': JAMBES}[t]
            cand = []
            for g in prio:
                if g in zone_m:
                    cand += [e['id'] for e in EX if e['muscle_principal'] == g and e['principal_possible'] and e['niveau_usage'] == 'classique']
            cand += CHAINE[t]
            for cid in cand:
                e = EXI[cid]
                if dispo(P, e):
                    chosen = e; break
            if chosen: break
        s['ex'] = []
        if chosen is None:
            P.m('M6', f"séance {s['nom']} : aucun principal possible", 'conseil')
        else:
            legs = chosen['zone'] == 'bas' and chosen['type'] == 'polyarticulaire'
            if chosen['id'] == 'tractions':
                n = p.get('tractions', 0)
                ser = 4; reps = '4 × max' if n < 5 else ('4 × 5 (+1 rep si RPE < 7)' if n < 12 else '4 × 5 lesté +2,5 kg (M6b)')
                txt_reps = reps
            else:
                ser = 5 if objm == 'force' else (3 if T <= 30 else 4)
                rr = REPS[objm]
                if objm == 'force' and chosen['materiel'] in ('halteres', 'machine'): rr = '4-6 (M16c)'
                txt_reps = f"{ser} × {rr}"
            leger_p = legs and no_legs and objm != 'tonification'
            item = dict(id=chosen['id'], nom=chosen['nom'] + (' (en léger)' if leger_p else ''), role='principal', ser=ser, reps=txt_reps, g=chosen['muscle_principal'],
                        rpe=('≤ 6' if leger_p else rpe) if chosen['id'] != 'tractions' else None, leger=leger_p)
            s['ex'].append(item); cnt[chosen['muscle_principal']] += ser; used.add(chosen['id'])
            s['principal'] = chosen
            if objm in ('force', 'force_esthetique') and p['niveau_muscu'] != 'debutant' and not leger_p and chosen['id'] not in ('tractions', 'tractions_assistees') and chosen['materiel'] != 'poids_du_corps':
                s['ex'].append(dict(id=chosen['id'] + '_bo', nom='back-off', role='back-off (M21)', ser=2, reps=f"2 × +2 reps à −10 %", g=chosen['muscle_principal'], rpe=rpe, leger=False))
                cnt[chosen['muscle_principal']] += 2
    # remplissage (M22, M23, M32, M8)
    def duree(s):
        d = 5 + sum(x['ser'] * (1.5 if x['role'] == 'renfo' else st) for x in s['ex'])
        return d
    nren = {}
    if renfo and renfo_list:
        for i, s in enumerate(sessions):
            nren[i] = 2 if T >= 45 and len(sessions) <= 2 else 1
    for it in range(60):
        progress = False
        for i, s in enumerate(sessions):
            zone = ZONE[s['zone']]
            budget = T - duree(s) - nren.get(i, 0) * 3
            if budget < st * 2:
                continue
            # muscle le plus en retard sur sa cible (prioritaires d'abord)
            cands = []
            for g in zone:
                lo_, hi_ = tgt[g]
                if hi_ == 0 or cnt[g] >= hi_: continue
                if g not in prio and cnt[g] >= lo_: continue
                deficit = (lo_ if cnt[g] < lo_ else hi_) - cnt[g]
                cands.append(((2 if g in prio else 1) if cnt[g] < lo_ else 0, deficit, -GROUPES.index(g), g))
            if not cands:
                continue
            cands.sort(reverse=True)
            for _, deficit, _, g in cands:
                pr = s.get('principal')
                fams_s = [EXI[x['id']]['famille'] for x in s['ex'] if x['id'] in EXI]
                n_assist = sum(1 for x in s['ex'] if x['role'] == 'assistance')

                def fam_ok(e):  # M32 v8 : pas deux exercices de la même famille, sauf l'assistance du principal
                    if pr and e['famille'] == pr['famille']:
                        return n_assist == 0
                    return e['famille'] not in fams_s
                pool = [e for e in EX if e['muscle_principal'] == g and dispo(P, e) and e['id'] not in used and fam_ok(e)]
                cl = [e for e in pool if e['niveau_usage'] == 'classique']
                comp = False
                if not cl:
                    cl = [e for e in pool if e['niveau_usage'] == 'complementaire']; comp = True
                if not cl:
                    cl = [e for e in pool if e['niveau_usage'] == 'specifique']; comp = 'spe'  # M8 v8 : dernier recours
                if not cl:
                    continue
                fam = [e for e in cl if pr and e['famille'] == pr['famille']]
                e = (fam or sorted(cl, key=lambda e: 0 if e['type'] == 'polyarticulaire' else 1))[0]
                role = 'assistance' if (pr and e['famille'] == pr['famille']) else ('poly' if e['type'] == 'polyarticulaire' else 'iso')
                maxs = 4 if g in prio else 3
                ser = 3 if role == 'assistance' else (min(maxs, max(2, tgt[g][0] - cnt[g])) if tgt[g][0] - cnt[g] > 0 else 2)
                ser = min(ser, tgt[g][1] - cnt[g], int(budget // st))
                if ser < 2:
                    continue
                legs = e['zone'] == 'bas' and e['type'] == 'polyarticulaire'
                leger = legs and (jl or not s.get('lourd_ok', True)) and objm != 'tonification'
                r = None
                if objm == 'hypertrophie' and e['type'] == 'polyarticulaire':
                    r = rpe
                if leger:
                    r = '≤ 6'
                s['ex'].append(dict(id=e['id'], nom=e['nom'] + (' (spécifique, M8)' if comp == 'spe' else ' (complémentaire, M8)' if comp else ''), role=role, ser=ser,
                                    reps=f"{ser} × {REPS[objm] if e['mesure'] == 'reps' else '30-45 s'}", g=g, rpe=r, leger=leger))
                used.add(e['id']); cnt[g] += ser; progress = True
                break
        if not progress:
            break
    # renfo (M12)
    if renfo and renfo_list:
        pool = [e for e in renfo_list if e['id'] not in used]
        for i, s in enumerate(sessions):
            for _ in range(nren.get(i, 0)):
                ok = [e for e in pool if cnt[e['muscle_principal']] + 2 <= max(tgt[e['muscle_principal']][1], 2)]
                if not ok: break
                ok.sort(key=lambda e: (cnt[e['muscle_principal']] - tgt[e['muscle_principal']][0], pool.index(e)))
                e = ok[0]; pool.remove(e)
                s['ex'].append(dict(id=e['id'], nom=e['nom'], role='renfo', ser=2, reps='2 × 10-12' if e['mesure'] == 'reps' else '2 × 30-45 s',
                                    g=e['muscle_principal'], rpe=None, leger=False))
                cnt[e['muscle_principal']] += 2
    for s in sessions:
        while duree(s) > T + 0.5 and len(s['ex']) > 1:
            bo = [x for x in s['ex'] if x['role'] == 'back-off (M21)']
            victim = bo[0] if bo else [x for x in s['ex'] if x['role'] != 'principal'][-1]
            s['ex'].remove(victim); cnt[victim['g']] -= victim['ser']
            if not s.get('d5'):
                P.m('D5', f"séance {s['nom']} trop longue pour {T} min → back-off puis derniers exercices retirés"); s['d5'] = True
        s['duree'] = round(duree(s)); s['series'] = sum(x['ser'] for x in s['ex'])
    P.cnt = cnt; P.tgt = tgt
    manque = [g for g in prio if cnt[g] < tgt[g][0]]
    if manque:
        P.m('M13', "minimum prioritaire non atteint (" + ', '.join(f"{GL[g].lower()} {cnt[g]}/{tgt[g][0]}" for g in manque) + ") → moins de prioritaires ou une séance de plus", 'conseil')
    sous = [g for g in GROUPES if g not in prio and g not in excl and cnt[g] < tgt[g][0]]
    if sous:
        P.m('M22', "secondaires sous leur cible : " + ', '.join(f"{GL[g].lower()} {cnt[g]}" for g in sous), 'conseil')
    if jl:
        P.m('M12', "renfo coureur sans jambes prioritaires → polyarticulaires jambes en léger (RPE ≤ 6)")


# ---------------------------------------------------------------- C9, C5, mode
def decider_mode(P):
    p = P.p; obj = p['objectif_course']
    if p['s'] == 0:
        return 'aucun'
    if obj not in COURSES:
        return 'c8'
    C = COURSES[obj]
    n = p['semaines']
    prep = max(0, n - C['seuil'])
    vfin = P.v0 * (1.05 ** max(0, prep - prep // 4)) if prep else P.v0 * 1.21
    vfin = min(vfin, p['capacite'])
    tsl_user = p.get('tsl_user', p['tsl'])
    if p['s'] < C['csorties'] or vfin < C['cvol'] or p['capacite'] < C['cvol'] or tsl_user < C['ctsl']:
        why = []
        if p['s'] < C['csorties']: why.append(f"{p['s']} sortie(s) < {C['csorties']}")
        if vfin < C['cvol']: why.append(f"volume {round(vfin)} min < {C['cvol']}" + (" (fin de préparation)" if prep else ""))
        if p['capacite'] < C['cvol']: why.append(f"capacité {p['capacite']} min < {C['cvol']}")
        if tsl_user < C['ctsl']: why.append(f"temps de sortie longue {tsl_user} min < {C['ctsl']}")
        P.m('C9', f"refus {C['nom']} : " + ', '.join(why) + f". Portes de sortie : passer à {C['csorties']} sorties / plus de temps, une distance plus courte, ou « courir plus » jusqu'au minimum", 'bloq')
        p['sous_objectif'] = 'courir_plus'
        P.refus = True
        return 'c8'
    if prep:
        P.m('C9' if obj == 'marathon' and P.v0 < C['cvol'] else 'C13', f"préparation de {prep} semaines (+5 %/sem. max, 1 qualité)" + (f" ; C9 contrôlé en fin de préparation : ≈ {round(vfin)} min ✔" if P.v0 < C['cvol'] else ''))
    if n < C['court']:
        lab = 'plan court' if P.niv in ('confirme', 'avance', 'expert') else 'plan « finir »'
        P.m('C5', f"délai très court ({n} sem. < {C['court']}) → {lab} proposé (ou distance plus courte) ; hypothèse : accepté", 'prop')
        return 'finir'
    return 'course'


def run(p):
    P = Plan(dict(p)); P.refus = False; P.pic = None; P.org = None; P.court = False
    P.p['jours'] = list(p['jours']); P.p['prioritaires'] = list(p.get('prioritaires', []))
    P.jours_user = list(p['jours']); P.tm_user = p.get('tm') or p['tj']
    profil(P)
    niveau(P)
    repos(P)
    mode = decider_mode(P)
    P.weeks = []
    P.mode = mode
    nmsg = len(P.msg)
    if mode in ('course', 'finir', 'c8'):
        calendrier(P, mode)
    if mode == 'course':
        C = COURSES[p['objectif_course']]
        slmax = max(w['SL'] for w in P.weeks)
        if slmax < C['ctsl'] - 1:  # C9 v8 : sortie longue atteignable
            del P.msg[nmsg:]
            P.m('C9', f"refus {C['nom']} : la sortie longue n'atteint que {round(slmax)} min avant la course (minimum {C['ctsl']} min). Portes de sortie : une course plus lointaine, plus de volume de départ, une distance plus courte, ou « courir plus » (C8)", 'bloq')
            P.p['sous_objectif'] = 'courir_plus'; P.refus = True; P.pic = None
            mode = 'c8'; P.mode = mode
            calendrier(P, mode)
    # semaine détaillée
    if mode == 'aucun':
        wk = dict(w=2, phase='—', type='normale', nq=0, Q=[], SL=0, EF=[], V=0)
        P.weeks = [wk]
    elif mode == 'c8':
        wk = P.weeks[5]
    elif mode == 'finir':
        cands = [w for w in P.weeks if w['type'] == 'normale' and w['w'] > 1]
        wk = cands[-1] if cands else P.weeks[0]
    else:
        for ph in ('developpement', 'specifique', 'fondation', 'preparation'):
            cands = [w for w in P.weeks if w['phase'] == ph and w['type'] == 'normale' and w['w'] > 1]
            if cands:
                wk = cands[len(cands) // 2]; break
        else:
            wk = P.weeks[0]
    P.wk = wk
    pl, sessions, longue, qdays, efdays = placement(P, wk)
    muscu(P, sessions, wk['w'])
    P.pl, P.sessions, P.longue, P.qdays, P.efdays = pl, sessions, longue, qdays, efdays
    return P

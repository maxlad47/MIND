import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import moteur7 as M
from moteur7 import JL, GL, GROUPES, NIVL, mmss, hms, COURSES

OBJ = {'10km': '10 km', 'semi': 'Semi', 'marathon': 'Marathon', 'pas_de_course': 'Pas de course'}
SOUS = {'garder_forme': 'garder la forme', 'courir_plus': 'courir plus', 'courir_plus_vite': 'courir plus vite', 'muscu_seule': 'muscu seule'}
OBJM = {'force': 'force', 'force_esthetique': 'force + esthétique', 'hypertrophie': 'hypertrophie', 'tonification': 'tonification', 'aucun': 'pas de muscu'}
EQ = {'salle': 'salle', 'maison_halteres': 'maison avec haltères', 'poids_du_corps': 'poids du corps'}
ORG = {'full_body': 'full body', 'haut_bas': 'haut / bas', 'ppj': 'push / pull / jambes', 'pph': 'push / pull / haut', 'haut_jambes_fb': 'haut / jambes / full body',
       'ppjfb': 'push / pull / jambes / full body', 'je_ne_sais_pas': '« je ne sais pas »', None: '—'}
PH = {'preparation': 'Préparation', 'fondation': 'Fondation', 'developpement': 'Développement', 'specifique': 'Spécifique', 'affutage': 'Affûtage', 'c8': '—'}
TYPM = {'bloq': 'bloquant', 'conseil': 'conseil', 'prop': 'proposé', 'info': ''}


def jl(lst):
    return ', '.join(JL[j].lower() for j in lst)


def km_ef(P, minutes, cap, sl=False):
    if not P.ef or minutes <= 0:
        return f"{round(minutes)} min", round(minutes)
    k = minutes * 60 / P.ef
    kk = math.ceil(k) if sl else round(k)
    if kk * P.ef / 60 > cap + 0.5:
        kk = math.floor(k)
    kk = max(1, kk)
    return f"{kk} km", round(kk * P.ef / 60)


def rendu(P, avis):
    p = P.p; s, mu = p['s'], p['mu']; o = []
    obj = p['objectif_course']
    titre = OBJ[obj] + (f" dans {p['semaines']} sem." if obj in COURSES else f" ({SOUS.get(p.get('sous_objectif'), '')})")
    titre += f", {s} sortie{'s' if s > 1 else ''}" if s else ", aucune course"
    titre += f", {OBJM[p['objectif_muscu']]}" + (f" × {mu}" if mu else '')
    o.append(f"## {p['id']} — {titre}\n")
    o.append(f"*{p['cas'][0].upper() + p['cas'][1:]}.*\n")
    # profil
    ch = p.get('chrono')
    chs = f"{ch['d']} km en {mmss(ch['t'])}" if ch else 'aucun chrono'
    vol = f"{p['vol']} {p['vol_unite']}/sem." if p['vol'] else '0'
    pls = f", plus longue sortie {p['pls']['v']} {p['pls']['u']}" if p.get('pls') else ''
    ns = p['nb_sorties'] if p['nb_sorties'] != 'jnsp' else '« je ne sais pas »'
    pc = f"{OBJ[obj]}" + (f" dans {p['semaines']} semaines" if obj in COURSES else f", « {SOUS.get(p.get('sous_objectif'), '')} »") + \
         f". {chs}, {'régulier' if p['regulier'] else 'pas régulier'}. Sorties : {ns}, {vol}{pls}."
    nm = p['nb_muscu'] if p['nb_muscu'] != 'jnsp' else '« je ne sais pas »'
    pm = f"{OBJM[p['objectif_muscu']].capitalize()}" + (f", {nm} séance(s), {NIVL.get(p['niveau_muscu'], p['niveau_muscu'])}, {EQ[p['equipement']]}, {ORG.get(p.get('organisation'), p.get('organisation'))}" if p['objectif_muscu'] != 'aucun' else '') + '.'
    if p.get('prioritaires') and p['objectif_muscu'] != 'aucun': pm += ' Prioritaires : ' + ', '.join(GL[g].lower() for g in p['prioritaires']) + '.'
    if p.get('exclus') and p['objectif_muscu'] != 'aucun': pm += ' Exclus : ' + ', '.join(GL[g].lower() for g in p['exclus']) + '.'
    pm += f" Renfo coureur {'coché' if p.get('renfo') else 'décoché'}." + (f" {p.get('tractions', 0)} traction(s) stricte(s)." if p['objectif_muscu'] != 'aucun' else '')
    sem = f"{jl(p['jours']).capitalize()}. {p['tj']} min par jour" + (f", {p['tsl']} min pour la sortie longue ({JL[p['jour_sl']].lower()})" if s else '') + f". {p['prioritaire'].capitalize()} prioritaire."
    # proposition
    if P.mode == 'aucun':
        prc = "Muscu seule (E7) : aucune règle de course."
    else:
        bits = []
        if P.refus: bits.append("**Refus C9** → plan « courir plus » (C8)")
        elif P.mode == 'finir': bits.append("Plan **« finir »** (C5)")
        elif P.mode == 'c8': bits.append(f"C8 « {SOUS[p['sous_objectif']]} »")
        bits.append(f"niveau {NIVL[P.niv] if P.niv else '—'}")
        nqs = sorted(set(w['nq'] for w in P.weeks if w['type'] == 'normale'))
        bits.append(f"qualités / sem. : {'-'.join(str(x) for x in nqs)} (N8)")
        bits.append(f"départ **{P.v0} min**")
        if P.sl0: bits.append(f"sortie longue de départ {P.sl0} min")
        if P.mode in ('course', 'finir'): bits.append(f"sortie longue cible {P.slcible} min")
        if P.pic: bits.append(f"pic {P.pic} min")
        if P.mode == 'course':
            ph = P.phases; bits.append('phases ' + ' / '.join(str(ph[k]) for k in ('preparation', 'fondation', 'developpement', 'specifique', 'affutage') if ph[k] or k != 'preparation') + (' (prépa / fond. / dév. / spé. / aff.)' if ph['preparation'] else ' (fond. / dév. / spé. / aff.)'))
        prc = '. '.join(b[0].upper() + b[1:] for b in bits) + '.'
    if mu:
        prm = f"{mu} séance(s), {ORG.get(P.org, P.org)} (M26). {M.REPS[p['objectif_muscu']]} reps, ~{int(M.SERIE[p['objectif_muscu']]) if M.SERIE[p['objectif_muscu']] == int(M.SERIE[p['objectif_muscu']]) else str(M.SERIE[p['objectif_muscu']]).replace('.', ',')} min par série (M23)."
        if M.jambes_legeres(P): prm += " Jambes en léger, RPE ≤ 6 (M12)."
    else:
        prm = "Pas de séance de muscu." + (" Renfo coureur : 2 exercices après 2 EF (M12)." if p.get('renfo') and s else '')
    prs = f"{s} course(s) + {mu} muscu sur {len(p['jours'])} jours" + (f" → {p['doubles']} jour(s) doublé(s) (J6)." if p['doubles'] else '.')
    o.append('| | Profil | Proposition |\n|---|---|---|')
    o.append(f"| **Course** | {pc} | {prc} |")
    o.append(f"| **Muscu** | {pm} | {prm} |")
    o.append(f"| **Semaine** | {sem} | {prs} |\n")
    if P.al:
        o.append("**Allures** (A1) : " + ' · '.join(f"{k} {mmss(v)}" for k, v in P.al.items() if k in ('VMA courte', 'VMA longue', 'allure 10 km', 'seuil', 'allure semi', 'allure marathon')) + f" · EF interne {mmss(P.ef)}.\n")
    # calendrier
    if P.mode in ('course', 'finir', 'c8'):
        o.append("**Calendrier** (minutes ; SL = sortie longue)\n")
        o.append('| Sem. | Lundi | Phase | Type | Volume | SL | Qualité(s) |\n|---|---|---|---|---|---|---|')
        for w in P.weeks:
            q = ' + '.join(x['fam'] for x in w['Q']) or ('EF + test 6 min' if (w['w'] == 1 and not p.get('chrono')) else '—')
            if w.get('test'): q = 'test 5 km (T4)'
            typ = w['type'] + (', calibrage muscu' if w['w'] == 1 and mu else '')
            sl = f"{round(w['SL'])}" if w['SL'] >= 60 else '—'
            o.append(f"| W{w['w']} | {w['lundi']} | {PH[w['phase']]} | {typ} | {round(w['V'])}{'*' if w.get('perdu') else ''} | {sl} | {q} |")
        if P.mode in ('course', 'finir'):
            o.append(f"| W{P.course_week['w']} | {P.course_week['lundi']} | **Course** | récupération 1 | {P.course_week['vol']} | | |")
        o.append('')
    # semaine détaillée
    wk = P.wk
    o.append(f"### Semaine détaillée : W{wk['w']}" + (f" ({PH.get(wk['phase'], '').lower()}, {wk['type']})" if P.mode != 'aucun' else '') + '\n')
    sess_by_day = {x['jour']: x for x in P.sessions}
    rows = []
    course_rows = []
    qi = 0
    efi = 0
    for j in M.JOURS:
        if j not in p['jours']:
            continue
        c = P.pl[j]['course']; ctxt = ''
        if c == 'SL':
            txt, dur = km_ef(P, wk['SL'], p['tsl'], sl=True)
            lab = 'Sortie longue' if wk['SL'] >= 60 else 'Sortie la plus longue (EF, U9)'
            var = {'fondation': 'facile', 'developpement': 'progressive', 'specifique': 'facile', 'preparation': 'facile', 'c8': 'facile', 'affutage': 'facile'}.get(wk['phase'], 'facile')
            ctxt = f"**{lab} {txt}**"
            course_rows.append((lab, f"{txt} {var}", dur, '4-5' if wk['SL'] >= 60 else '3-4'))
        elif c and c.startswith('Q'):
            q = wk['Q'][int(c[1]) - 1]
            ctxt = f"**{q['fam'][0].upper() + q['fam'][1:]}**"
            rpe = {'VMA courte': '8-9', 'VMA longue': '8', 'seuil': '7', 'allure 10 km': '8', 'allure semi': '7', 'allure marathon': '6', 'côtes': '8-9', 'fartlek': '7'}[q['fam']]
            course_rows.append((q['fam'][0].upper() + q['fam'][1:], q['texte'], q['duree'], rpe))
        elif c == 'EF':
            m_ = wk['EF'][efi] if efi < len(wk['EF']) else 0; efi += 1
            txt, dur = km_ef(P, m_, p['tj'])
            ctxt = f"**EF {txt}**"
            course_rows.append(('EF', txt + (' + 2 exercices de renfo (M12)' if (p.get('renfo') and mu == 0 and efi <= 2) else ''), dur, '3-4'))
        mt = ''
        if j in sess_by_day:
            ss = sess_by_day[j]; mt = f"**{ss['nom']}**" + (' (jambes en léger)' if ss['zone'] in ('jambes', 'fb') and not ss.get('lourd_ok', True) and ss['zone'] == 'jambes' else '')
        if not ctxt and not mt:
            ctxt = 'repos'
        rows.append(f"| {JL[j]} | {ctxt} | {mt} |")
    o.append('| Jour | Course | Muscu |\n|---|---|---|')
    o += rows
    o.append('')
    if course_rows:
        o.append('| Séance | Contenu | Durée | RPE |\n|---|---|---|---|')
        tot = 0; fast = sum(q['rapide'] for q in wk['Q'])
        for a, b, d, r in course_rows:
            o.append(f"| {a} | {b} | ≈ {d} min | {r} |"); tot += d
        o.append('')
        o.append(f"Total ≈ {tot} min ; {fast} min rapides → **{round(100 - 100 * fast / tot) if tot else 100} % facile** (S4 {'✔' if tot and fast / tot <= 0.2 else '✘'})."
                 + (f" Sortie longue = {round(100 * wk['SL'] / tot)} % du volume" + (' → conseil S3.' if wk['SL'] / tot > 0.5 else ' ✔.') if wk['SL'] >= 60 and tot else '') + '\n')
    if P.sessions:
        o.append('| Séance | Exercices (séries ; RPE visé) | Durée |\n|---|---|---|')
        for ss in P.sessions:
            parts = []
            for x in ss['ex']:
                lab = x['nom'] if x['role'] != 'back-off (M21)' else 'back-off'
                if x['role'] == 'principal': lab = f"**{lab}** principal {x['reps']}"
                elif x['role'] == 'renfo': lab = f"{lab} (renfo) {x['ser']}"
                elif x['role'] == 'back-off (M21)': lab = f"back-off {x['ser']}"
                else: lab = f"{lab} {x['ser']}"
                if x.get('rpe') and x['role'] != 'back-off (M21)': lab += f" (RPE {x['rpe']})"
                parts.append(lab)
            o.append(f"| **{ss['nom']}** {JL[ss['jour']].lower()} | {' · '.join(parts)} | {ss['series']} séries ≈ {ss['duree']} min |")
        o.append('')
        heads = [g for g in GROUPES]
        o.append('| ' + ' | '.join(GL[g] + (' (P)' if g in p.get('prioritaires', []) else ' (X)' if g in p.get('exclus', []) else '') for g in heads) + ' |')
        o.append('|' + '---|' * len(heads))
        o.append('| ' + ' | '.join(str(P.cnt[g]) for g in heads) + ' |')
        k = min(mu, 3); (a, b), (c, d) = M.M22T[k]
        o.append(f"\nCible M22 ({mu} séance(s)) : prioritaire {a}-{b}, secondaire {c}-{d}.\n")
    # règles
    if P.msg:
        o.append('**Ce que les règles ont décidé ou signalé**')
        for code, txt, typ in P.msg:
            t = TYPM[typ]
            o.append(f"- **{code}**{' (' + t + ')' if t else ''} : {txt}")
        o.append('')
    o.append(f"**Avis de coach** — {avis.get(p['id'], '{{AVIS}}')}\n")
    return '\n'.join(o)


if __name__ == '__main__':
    D = os.path.dirname(os.path.abspath(__file__))
    profils = json.load(open(os.path.join(D, 'profils50.json')))
    avis = json.load(open(os.path.join(D, 'avis.json'))) if os.path.exists(os.path.join(D, 'avis.json')) else {}
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for p in profils:
        P = M.run(p)
        open(os.path.join(out, p['id'] + '.md'), 'w').write(rendu(P, avis))
    print('ok')

import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from calc import calcul, plan_course, mmss
D = os.path.dirname(os.path.abspath(__file__))
profils = {p['id']: p for p in json.load(open(os.path.join(D, 'profils.json')))}
# id: (sorties retenues, qualités, temps du jour, temps SL, hypothèse chrono 10 km si aucun)
DEC = {
 'P02': (4, 2, 90, 180, None), 'P03': (3, 1, 60, 90, None), 'P05': (3, 1, 45, 180, None), 'P06': (4, 1, 30, 180, None),
 'P07': (4, 2, 90, 60, 58*60+49), 'P08': (3, 1, 60, 180, None), 'P09': (2, 1, 60, 90, None), 'P10': (4, 1, 45, 150, None),
 'P13': (2, 1, 60, 180, None), 'P14': (1, 0, 45, 90, None), 'P15': (2, 1, 90, 180, None), 'P20': (1, 0, 60, 150, None),
 'P21': (4, 2, 60, 180, None), 'P22': (2, 1, 30, 60, 64*60+10), 'P23': (4, 2, 60, 180, None), 'P25': (5, 2, 90, 150, None),
 'P26': (3, 1, 30, 90, None), 'P27': (3, 1, 45, 120, None), 'P28': (5, 2, 60, 180, None), 'P29': (3, 1, 60, 90, None),
 'P17': (2, 1, 45, 90, None),
}
out = {}
for pid in (sys.argv[1:] or DEC):
    ns, nq, tj, tsl, hyp = DEC[pid]
    p = profils[pid]
    r = calcul(p, hyp)
    r = plan_course(p, r, ns, nq, tj, tsl)
    out[pid] = r
    print(f"== {pid} {p['objectif_course']} n={p['semaines_avant_course']} niveau={r['niveau']} t10={r.get('t10_txt')} v0={r['v0']} sl0={r['sl0']} slmax={r['slmax']} pic={r['pic']} phases={r['phases']}")
    print('   allures', r.get('allures'))
    for w in r['weeks']:
        print('  ', w)
json.dump(out, open(os.path.join(D, 'calendriers.json'), 'w'), ensure_ascii=False, indent=1)

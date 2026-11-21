"""Profils du test v8 : A, B, C (AVANCEMENT §12) et R01-R50, construits pour couvrir tous les cas.
Aucune donnée réelle identifiable : A, B, C sont anonymes, R01-R50 sont fictifs."""
import json, os

J = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']
BASE = dict(sous_objectif=None, semaines=None, chrono=None, regulier=True, hyp_test_m=None, nb_sorties=3, vol_unite='min', vol=150, pls=None,
            objectif_muscu='aucun', nb_muscu=0, niveau_muscu='intermediaire', equipement='salle', organisation='je_ne_sais_pas',
            prioritaires=[], exclus=[], renfo=True, tractions=0, jours=['mar', 'jeu', 'dim'], jour_sl='dim', tj=60, tsl=90,
            prioritaire='course', refus_repos=False)


def P(id, cas, **k):
    d = dict(BASE); d.update(k); d['id'] = id; d['cas'] = cas
    if d['objectif_muscu'] == 'aucun':
        d['nb_muscu'] = 0
    return d


def t(m, s=0):
    return m * 60 + s


# ------------------------------------------------------------------ A, B, C
ABC = [
    P('A', "profil A (10 km prioritaire, hypertrophie 3 séances)", objectif_course='10km', semaines=14, chrono=dict(d=10, t=t(42)),
      nb_sorties=3, vol_unite='km', vol=30, pls=dict(v=15, u='km'), objectif_muscu='hypertrophie', nb_muscu=3, niveau_muscu='confirme',
      tractions=8, jours=['lun', 'mer', 'ven', 'sam', 'dim'], jours_doubles=['lun'], tj=60, tsl=90),
    P('B', "profil B (10 km débutant, jambes et dos prioritaires)", objectif_course='10km', semaines=14, chrono=dict(d=10, t=t(60)),
      nb_sorties=2, vol_unite='km', vol=15, pls=dict(v=10, u='km'), objectif_muscu='hypertrophie', nb_muscu=2, niveau_muscu='debutant',
      prioritaires=['quadriceps', 'ischios', 'fessiers', 'dos'], tractions=2, jours=['lun', 'mer', 'sam', 'dim'], tj=60, tsl=90),
    P('C', "profil C (marathon, tonification 3 séances)", objectif_course='marathon', semaines=27, chrono=dict(d=10, t=t(44)),
      nb_sorties=3, vol_unite='min', vol=180, pls=dict(v=8, u='km'), objectif_muscu='tonification', nb_muscu=3, niveau_muscu='confirme',
      jours=['lun', 'mar', 'jeu', 'ven', 'sam', 'dim'], tj=60, tm=45, tsl=180),
]

# ------------------------------------------------------------------ R01-R50
R = [
    # --- 10 km (R01-R10) : délais, niveaux, sorties
    P('R01', "10 km, délai normal, débutant, 3 sorties, sans muscu", objectif_course='10km', semaines=10, chrono=dict(d=10, t=t(64)),
      nb_sorties=3, vol=100, pls=dict(v=40, u='min'), jours=['lun', 'mer', 'sam'], jour_sl='sam', tj=45, tsl=60),
    P('R02', "10 km, délai normal, intermédiaire, 3 sorties, tonification 1", objectif_course='10km', semaines=11, chrono=dict(d=10, t=t(54, 30)),
      nb_sorties=3, vol_unite='km', vol=22, pls=dict(v=9, u='km'), objectif_muscu='tonification', nb_muscu=1, jours=['mar', 'jeu', 'sam', 'dim'], tj=45, tsl=90),
    P('R03', "10 km, délai normal, confirmé, 4 sorties, force 2", objectif_course='10km', semaines=12, chrono=dict(d=10, t=t(45, 10)),
      nb_sorties=4, vol_unite='km', vol=38, pls=dict(v=14, u='km'), objectif_muscu='force', nb_muscu=2, niveau_muscu='confirme', tractions=6,
      jours=['lun', 'mar', 'jeu', 'ven', 'dim'], tj=60, tsl=90),
    P('R04', "10 km, délai normal, expert, 5 sorties, sans muscu", objectif_course='10km', semaines=10, chrono=dict(d=10, t=t(33, 40)),
      nb_sorties=5, vol_unite='km', vol=75, pls=dict(v=20, u='km'), jours=['lun', 'mar', 'mer', 'jeu', 'sam', 'dim'], tj=90, tsl=90),
    P('R05', "10 km dans 3 semaines (C5 « finir »), intermédiaire", objectif_course='10km', semaines=3, chrono=dict(d=10, t=t(56)),
      nb_sorties=3, vol=130, pls=dict(v=55, u='min'), objectif_muscu='hypertrophie', nb_muscu=1, jours=['mar', 'jeu', 'dim'], tj=45, tsl=90),
    P('R06', "10 km dans 6 semaines (C4 compressé), avancé", objectif_course='10km', semaines=6, chrono=dict(d=10, t=t(39)),
      nb_sorties=4, vol_unite='km', vol=45, pls=dict(v=15, u='km'), jours=['lun', 'mer', 'ven', 'dim'], tj=60, tsl=90),
    P('R07', "10 km dans 26 semaines (C13 préparation), débutant sans chrono", objectif_course='10km', semaines=26, chrono=None, hyp_test_m=1050,
      nb_sorties=3, vol=75, objectif_muscu='tonification', nb_muscu=2, niveau_muscu='debutant', jours=['lun', 'mer', 'ven', 'dim'], tj=45, tsl=60),
    P('R08', "10 km avec 2 sorties sur deux jours qui se suivent (P7)", objectif_course='10km', semaines=12, chrono=dict(d=5, t=t(23, 30)),
      nb_sorties=2, vol=120, pls=dict(v=65, u='min'), objectif_muscu='hypertrophie', nb_muscu=2, jours=['sam', 'dim'], tj=60, tsl=90),
    P('R09', "10 km avec 1 sortie (C9 : refus)", objectif_course='10km', semaines=12, chrono=dict(d=10, t=t(50, 30)),
      nb_sorties=1, vol=60, pls=dict(v=60, u='min'), objectif_muscu='hypertrophie', nb_muscu=3, jours=['lun', 'mer', 'ven', 'dim'], tj=60, tsl=60),
    P('R10', "10 km, très petit volume (40 min/sem.) : C9 volume", objectif_course='10km', semaines=9, chrono=dict(d=10, t=t(58)),
      nb_sorties=2, vol=40, jours=['mer', 'dim'], tj=30, tsl=60),
    # --- semi (R11-R19)
    P('R11', "semi, délai normal, intermédiaire régulier, 4 sorties (2 qualités possibles)", objectif_course='semi', semaines=12, chrono=dict(d=10, t=t(51)),
      nb_sorties=4, vol=210, pls=dict(v=85, u='min'), objectif_muscu='tonification', nb_muscu=1, jours=['lun', 'mar', 'jeu', 'sam', 'dim'], tj=60, tsl=120),
    P('R12', "semi, délai normal, confirmé, 3 sorties, hypertrophie 2", objectif_course='semi', semaines=13, chrono=dict(d=10, t=t(46)),
      nb_sorties=3, vol_unite='km', vol=35, pls=dict(v=16, u='km'), objectif_muscu='hypertrophie', nb_muscu=2, tractions=10,
      jours=['lun', 'mer', 'ven', 'dim'], tj=60, tsl=120),
    P('R13', "semi, débutant pas régulier, 3 sorties, 30 min par jour", objectif_course='semi', semaines=14, chrono=dict(d=10, t=t(66)), regulier=False,
      nb_sorties=3, vol=120, pls=dict(v=60, u='min'), jours=['mar', 'jeu', 'dim'], tj=30, tsl=120),
    P('R14', "semi dans 5 semaines (C5), avancé (« plan court »)", objectif_course='semi', semaines=5, chrono=dict(d=10, t=t(38, 30)),
      nb_sorties=4, vol=240, pls=dict(v=90, u='min'), objectif_muscu='force_esthetique', nb_muscu=1, jours=['lun', 'mer', 'ven', 'dim'], tj=60, tsl=120),
    P('R15', "semi dans 30 semaines (C13 longue préparation), confirmé, 4 sorties", objectif_course='semi', semaines=30, chrono=dict(d=5, t=t(21, 10)),
      nb_sorties=4, vol=200, pls=dict(v=80, u='min'), objectif_muscu='hypertrophie', nb_muscu=2, jours=['lun', 'mar', 'jeu', 'sam', 'dim'], tj=45, tsl=120),
    P('R16', "semi avec 2 sorties, 45 min par jour et 1 h 30 de sortie longue", objectif_course='semi', semaines=12, chrono=dict(d=10, t=t(49)),
      nb_sorties=2, vol=110, pls=dict(v=70, u='min'), objectif_muscu='tonification', nb_muscu=2, jours=['mer', 'sam', 'dim'], jour_sl='sam', tj=45, tsl=90),
    P('R17', "semi avec sortie longue limitée à 1 h (C9 : refus)", objectif_course='semi', semaines=12, chrono=dict(d=10, t=t(48)),
      nb_sorties=3, vol=150, objectif_muscu='hypertrophie', nb_muscu=2, jours=['lun', 'mer', 'ven', 'dim'], tj=45, tsl=60),
    P('R18', "semi, expert, 6 sorties, 7 jours sur 7, musculation 1", objectif_course='semi', semaines=10, chrono=dict(d=10, t=t(34, 30)),
      nb_sorties=6, vol_unite='km', vol=90, pls=dict(v=24, u='km'), objectif_muscu='force', nb_muscu=1, niveau_muscu='confirme', tractions=12,
      jours=J, tj=90, tsl=120),
    P('R19', "semi, volume déclaré trop grand pour le temps (E3)", objectif_course='semi', semaines=11, chrono=dict(d=10, t=t(52)),
      nb_sorties=3, vol=330, pls=dict(v=100, u='min'), jours=['mar', 'jeu', 'dim'], tj=45, tsl=120),
    # --- marathon (R20-R28)
    P('R20', "marathon, délai normal, confirmé, 4 sorties", objectif_course='marathon', semaines=18, chrono=dict(d=10, t=t(43)),
      nb_sorties=4, vol=270, pls=dict(v=110, u='min'), objectif_muscu='tonification', nb_muscu=1, jours=['mar', 'mer', 'ven', 'dim'], tj=60, tsl=180),
    P('R21', "marathon, avancé, 5 sorties, hypertrophie 2", objectif_course='marathon', semaines=16, chrono=dict(d=10, t=t(37, 30)),
      nb_sorties=5, vol_unite='km', vol=65, pls=dict(v=26, u='km'), objectif_muscu='hypertrophie', nb_muscu=2, tractions=6,
      jours=['lun', 'mar', 'mer', 'jeu', 'sam', 'dim'], tj=60, tsl=180),
    P('R22', "marathon, intermédiaire, 3 sorties, première fois", objectif_course='marathon', semaines=20, chrono=dict(d=10, t=t(55)),
      nb_sorties=3, vol=200, pls=dict(v=90, u='min'), jours=['mar', 'jeu', 'dim'], tj=60, tsl=180),
    P('R23', "marathon dans 6 semaines (C5), confirmé", objectif_course='marathon', semaines=6, chrono=dict(d=10, t=t(44, 30)),
      nb_sorties=4, vol=260, pls=dict(v=120, u='min'), jours=['mar', 'jeu', 'sam', 'dim'], tj=60, tsl=180),
    P('R24', "marathon dans 32 semaines (C13), débutant", objectif_course='marathon', semaines=32, chrono=dict(d=10, t=t(61)),
      nb_sorties=4, vol=180, pls=dict(v=70, u='min'), objectif_muscu='tonification', nb_muscu=2, niveau_muscu='debutant',
      jours=['lun', 'mer', 'jeu', 'sam', 'dim'], tj=60, tsl=180),
    P('R25', "marathon avec 2 sorties (C9 : refus)", objectif_course='marathon', semaines=20, chrono=dict(d=10, t=t(47)),
      nb_sorties=2, vol=180, pls=dict(v=100, u='min'), objectif_muscu='force', nb_muscu=2, jours=['mer', 'sam', 'dim'], tj=90, tsl=150),
    P('R26', "marathon avec 30 min en semaine (E10)", objectif_course='marathon', semaines=20, chrono=dict(d=10, t=t(41)),
      nb_sorties=3, vol=220, pls=dict(v=120, u='min'), objectif_muscu='hypertrophie', nb_muscu=2, jours=['mar', 'jeu', 'dim'], tj=30, tsl=180),
    P('R27', "marathon depuis un petit volume (140 min) : C9 en fin de préparation", objectif_course='marathon', semaines=24, chrono=dict(d=10, t=t(46)),
      nb_sorties=4, vol=140, pls=dict(v=65, u='min'), jours=['lun', 'mer', 'ven', 'dim'], tj=60, tsl=180),
    P('R28', "marathon, expert, 6 sorties, refus du repos, force 2", objectif_course='marathon', semaines=16, chrono=dict(d=10, t=t(32, 50)),
      nb_sorties=6, vol_unite='km', vol=110, pls=dict(v=30, u='km'), objectif_muscu='force', nb_muscu=2, niveau_muscu='confirme', tractions=12,
      jours=J, tj=90, tsl=180, refus_repos=True),
    # --- pas de course : garder la forme (R29-R33)
    P('R29', "garder la forme, débutant, 2 sorties, tonification 2", objectif_course='pas_de_course', sous_objectif='garder_forme', chrono=dict(d=10, t=t(65)),
      nb_sorties=2, vol=60, objectif_muscu='tonification', nb_muscu=2, niveau_muscu='debutant', jours=['lun', 'mer', 'sam'], jour_sl='sam', tj=45, tsl=60),
    P('R30', "garder la forme, confirmé, 4 sorties, hypertrophie 3", objectif_course='pas_de_course', sous_objectif='garder_forme', chrono=dict(d=5, t=t(22)),
      nb_sorties=4, vol=200, pls=dict(v=75, u='min'), objectif_muscu='hypertrophie', nb_muscu=3, niveau_muscu='confirme', tractions=10,
      jours=['lun', 'mar', 'jeu', 'ven', 'dim'], tj=60, tsl=90),
    P('R31', "garder la forme, 1 sortie, muscu prioritaire 3 séances", objectif_course='pas_de_course', sous_objectif='garder_forme', chrono=dict(d=10, t=t(50)),
      nb_sorties=1, vol=50, objectif_muscu='hypertrophie', nb_muscu=3, prioritaire='muscu', prioritaires=['pectoraux', 'dos'],
      jours=['lun', 'mer', 'ven', 'dim'], tj=60, tsl=60),
    P('R32', "garder la forme, 3 sorties très courtes (E11)", objectif_course='pas_de_course', sous_objectif='garder_forme', chrono=dict(d=10, t=t(57)),
      nb_sorties=3, vol=60, objectif_muscu='tonification', nb_muscu=2, jours=['lun', 'mer', 'ven', 'dim'], tj=30, tsl=60),
    P('R33', "garder la forme, sans chrono, « je ne sais pas » partout", objectif_course='pas_de_course', sous_objectif='garder_forme', chrono=None, hyp_test_m=1250,
      nb_sorties='jnsp', vol=90, objectif_muscu='hypertrophie', nb_muscu='jnsp', jours=['lun', 'mer', 'jeu', 'sam', 'dim'], tj=45, tsl=60),
    # --- courir plus (R34-R38)
    P('R34', "courir plus, débutant, 3 sorties, sans muscu", objectif_course='pas_de_course', sous_objectif='courir_plus', chrono=dict(d=10, t=t(63)),
      nb_sorties=3, vol=90, pls=dict(v=40, u='min'), jours=['mar', 'jeu', 'dim'], tj=45, tsl=90, plafond=150),
    P('R35', "courir plus, intermédiaire, 4 sorties, hypertrophie 2", objectif_course='pas_de_course', sous_objectif='courir_plus', chrono=dict(d=10, t=t(53)),
      nb_sorties=4, vol=150, pls=dict(v=60, u='min'), objectif_muscu='hypertrophie', nb_muscu=2, jours=['lun', 'mar', 'jeu', 'sam', 'dim'], tj=60, tsl=120),
    P('R36', "courir plus avec une sortie unique de 1 h 45 (E11)", objectif_course='pas_de_course', sous_objectif='courir_plus', chrono=dict(d=10, t=t(47)),
      nb_sorties=1, vol=105, pls=dict(v=105, u='min'), objectif_muscu='tonification', nb_muscu=1, jours=['mer', 'dim'], tj=60, tsl=120),
    P('R37', "courir plus, débutant, 4 sorties + force 3 (E12 charge totale)", objectif_course='pas_de_course', sous_objectif='courir_plus', chrono=dict(d=10, t=t(62)),
      nb_sorties=4, vol=150, objectif_muscu='force', nb_muscu=3, niveau_muscu='intermediaire', jours=['lun', 'mar', 'mer', 'jeu', 'ven', 'dim'], tj=60, tsl=90),
    P('R38', "courir plus, avancé, plafond de volume fixé (E6)", objectif_course='pas_de_course', sous_objectif='courir_plus', chrono=dict(d=10, t=t(40)),
      nb_sorties=4, vol=200, pls=dict(v=80, u='min'), jours=['mar', 'mer', 'ven', 'dim'], tj=60, tsl=120, plafond=240),
    # --- courir plus vite (R39-R43)
    P('R39', "courir plus vite, intermédiaire, 3 sorties", objectif_course='pas_de_course', sous_objectif='courir_plus_vite', chrono=dict(d=5, t=t(26)),
      nb_sorties=3, vol=140, pls=dict(v=60, u='min'), objectif_muscu='hypertrophie', nb_muscu=2, jours=['lun', 'mer', 'ven', 'dim'], tj=60, tsl=90),
    P('R40', "courir plus vite, expert, 5 sorties (2 qualités)", objectif_course='pas_de_course', sous_objectif='courir_plus_vite', chrono=dict(d=10, t=t(35, 20)),
      nb_sorties=5, vol=330, pls=dict(v=100, u='min'), jours=['lun', 'mar', 'mer', 'jeu', 'sam', 'dim'], tj=90, tsl=120),
    P('R41', "courir plus vite avec 1 sortie (C8 : sortie facile)", objectif_course='pas_de_course', sous_objectif='courir_plus_vite', chrono=dict(d=10, t=t(52)),
      nb_sorties=1, vol=45, objectif_muscu='force_esthetique', nb_muscu=2, jours=['mar', 'jeu', 'sam'], jour_sl='sam', tj=60, tsl=60),
    P('R42', "courir plus vite, débutant, 30 min par jour", objectif_course='pas_de_course', sous_objectif='courir_plus_vite', chrono=dict(d=10, t=t(61)),
      nb_sorties=3, vol=90, jours=['lun', 'mer', 'sam'], jour_sl='sam', tj=30, tsl=60),
    P('R43', "courir plus vite, confirmé, 4 sorties, force + esthétique 2", objectif_course='pas_de_course', sous_objectif='courir_plus_vite', chrono=dict(d=10, t=t(44)),
      nb_sorties=4, vol=210, pls=dict(v=80, u='min'), objectif_muscu='force_esthetique', nb_muscu=2, tractions=6,
      jours=['lun', 'mar', 'jeu', 'ven', 'dim'], tj=60, tsl=90),
    # --- muscu seule (R44-R47)
    P('R44', "muscu seule, débutant, 3 séances, salle", objectif_course='pas_de_course', sous_objectif='muscu_seule', nb_sorties=0, vol=0,
      objectif_muscu='hypertrophie', nb_muscu=3, niveau_muscu='debutant', renfo=False, jours=['lun', 'mer', 'ven'], tj=60),
    P('R45', "muscu seule, confirmé, force 4 séances, 45 min", objectif_course='pas_de_course', sous_objectif='muscu_seule', nb_sorties=0, vol=0,
      objectif_muscu='force', nb_muscu=4, niveau_muscu='confirme', renfo=False, tractions=12, jours=['lun', 'mar', 'jeu', 'ven'], tj=45),
    P('R46', "muscu seule, 6 séances, push / pull / jambes × 2", objectif_course='pas_de_course', sous_objectif='muscu_seule', nb_sorties=0, vol=0,
      objectif_muscu='hypertrophie', nb_muscu=6, niveau_muscu='confirme', renfo=False, tractions=10, prioritaires=['epaules', 'fessiers'],
      jours=['lun', 'mar', 'mer', 'jeu', 'ven', 'sam'], tj=60),
    P('R47', "muscu seule au poids du corps, force demandée (M16c)", objectif_course='pas_de_course', sous_objectif='muscu_seule', nb_sorties=0, vol=0,
      objectif_muscu='force', nb_muscu=3, equipement='poids_du_corps', renfo=False, tractions=4, jours=['lun', 'mer', 'ven'], tj=45),
    # --- cas limites muscu dans un plan course (R48-R50)
    P('R48', "10 km, maison avec haltères, fessiers et ischios prioritaires", objectif_course='10km', semaines=12, chrono=dict(d=10, t=t(52)),
      nb_sorties=3, vol=150, pls=dict(v=60, u='min'), objectif_muscu='hypertrophie', nb_muscu=3, equipement='maison_halteres',
      prioritaires=['fessiers', 'ischios'], jours=['lun', 'mar', 'jeu', 'sam', 'dim'], tj=45, tsl=90),
    P('R49', "semi, exclusion du dos et des abdos (M11)", objectif_course='semi', semaines=12, chrono=dict(d=10, t=t(50)),
      nb_sorties=3, vol=170, pls=dict(v=75, u='min'), objectif_muscu='tonification', nb_muscu=2, exclus=['dos', 'abdos'],
      jours=['lun', 'mer', 'ven', 'dim'], tj=60, tsl=120),
    P('R50', "10 km, muscu prioritaire 4 séances, 1 jour de course choisi = jour de sortie longue absent", objectif_course='10km', semaines=10,
      chrono=dict(d=10, t=t(48)), nb_sorties='jnsp', vol=110, pls=dict(v=55, u='min'), objectif_muscu='hypertrophie', nb_muscu=4,
      prioritaire='muscu', prioritaires=['pectoraux', 'biceps', 'epaules', 'dos'], tractions=3, jours=['lun', 'mar', 'jeu', 'ven', 'sam'], jour_sl='dim', tj=60, tsl=90),
]

# variété d'organisation, de matériel et de niveau muscu (couverture)
MOD = {
    'R02': dict(equipement='poids_du_corps'), 'R03': dict(organisation='haut_bas'), 'R12': dict(organisation='full_body'),
    'R16': dict(equipement='maison_halteres', niveau_muscu='debutant'), 'R21': dict(organisation='haut_bas', niveau_muscu='confirme'),
    'R24': dict(equipement='maison_halteres'), 'R29': dict(equipement='poids_du_corps'), 'R30': dict(organisation='ppj'),
    'R31': dict(organisation='pph'), 'R35': dict(equipement='maison_halteres', organisation='haut_bas', niveau_muscu='debutant'),
    'R44': dict(organisation='full_body'), 'R45': dict(organisation='haut_bas'),
    'R46': dict(organisation='ppj'), 'R48': dict(organisation='haut_jambes_fb'), 'R49': dict(niveau_muscu='confirme'),
    'R37': dict(equipement='maison_halteres'), 'R41': dict(equipement='poids_du_corps', jours=['sam'], cas="courir plus vite avec 1 sortie et 1 seul jour (C8, E4)"),
    'R39': dict(organisation='haut_bas', prioritaire='muscu'), 'R43': dict(prioritaire='muscu'), 'R12': dict(organisation='full_body', prioritaire='muscu'),
}
for p in R:
    p.update(MOD.get(p['id'], {}))

if __name__ == '__main__':
    D = os.path.dirname(os.path.abspath(__file__))
    json.dump(ABC, open(os.path.join(D, 'profils_abc.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump(R, open(os.path.join(D, 'profils_r50.json'), 'w'), ensure_ascii=False, indent=1)
    from collections import Counter
    print(len(ABC), len(R))
    for k in ('objectif_course', 'sous_objectif', 'objectif_muscu', 'equipement', 'nb_sorties', 'tj', 'prioritaire'):
        print(k, dict(Counter(str(p[k]) for p in R)))
    print('jours', dict(Counter(len(p['jours']) for p in R)))

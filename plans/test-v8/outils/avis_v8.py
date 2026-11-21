"""Avis de coach sur les programmes v8 : note sur 10, verdict, pourquoi.
Verdict : Bon (8-10) · À retoucher (6-7) · À refuser (5 ou moins)."""
import json, os

A = {
 'A': (9, "Très bon plan de 10 km : 2 semaines de préparation, une VMA longue qui monte (4 × 1000 m en 4'02), une sortie longue stable à 15 km et un volume de +20 % sans à-coup. Le lundi doublé que tu as choisi reçoit bien l'EF (P11). La muscu full body × 3 est complète (6 à 8 séries par groupe, jambes en léger). Seul point : le principal du 2e full body est maintenant un squat léger (M6 v7) au lieu du développé militaire de ton plan v6."),
 'B': (7, "Base saine pour un débutant : VMA courte (3 × 800 m) une semaine sur deux, fartlek l'autre semaine, sortie longue de 10 km. Mais avec 2 sorties, la sortie longue fait 70 % du volume et le volume reste plat (~110 min) : la 3e sortie que propose l'appli (J8) est la vraie amélioration. En muscu, E13 ne garde que 2 prioritaires (quadriceps, ischios) au lieu de 4 : le dos et les fessiers passent à 3 séries, à arbitrer par toi."),
 'C': (8, "Préparation marathon sérieuse et identique à ton plan v6 au pic (≈ 284 min, sortie longue de 28 km puis 3 h) : 7 semaines de préparation en rotation (côtes, fartlek, seuil), seuil puis allure marathon, affûtage de 2 semaines. Avec 3 sorties, la sortie longue pèse 59 % de la semaine ; une 4e sortie courte serait mieux. La tonification en 45 min est complète."),
 'R01': (8, "Bon plan pour un débutant : fartlek une semaine sur deux, VMA courte (3 × 800 m), hausse limitée à +5 % par semaine (100 → 134 min). La sortie la plus longue plafonne à 1 h parce que c'est le temps choisi ; l'appli le dit (C14)."),
 'R02': (8, "Course propre : VMA longue en 3 × 800 m (assez de fractions), sortie longue qui finit à 1 h 18. La tonification au poids du corps en une séance est un entretien correct ; il manque les biceps (aucun exercice sans matériel, M11)."),
 'R03': (8, "Bon plan de 10 km pour un confirmé : 2 qualités (VMA longue et courte, 48 h d'écart), sortie longue de 1 h 25, 89 % de facile. La force en 2 séances d'1 h fait le travail principal + back-off, mais laisse les épaules et les bras à 0 : c'est le prix de la force."),
 'R04': (7, "Les 2 qualités d'un expert sont justes (5 × 1000 m, 7 × 400 m). Mais avec une sortie longue limitée à 1 h 30, les EF de 18 km sont aussi longues qu'elle : il n'y a plus vraiment de sortie longue. Je proposerais 1 h 45 de sortie longue et des EF de 12-14 km."),
 'R05': (8, "À 3 semaines du 10 km, le plan « finir » est exactement ce qu'il faut : allure 10 km deux fois, une sortie longue d'1 h 03, puis l'affûtage."),
 'R06': (8, "Délai court bien géré (C4) : hausse limitée à +5 %, test en semaine 2, 2 qualités puis l'allure 10 km. Pour un avancé, c'est un bloc court mais efficace."),
 'R07': (8, "Débutant sans chrono, 26 semaines : test 6 min, 14 semaines de préparation en rotation à +5 %, et la sortie la plus longue devient une vraie sortie longue (1 h) avant le plan 10 km. Long mais très progressif ; la VMA en 3 × 600 m est bien dosée."),
 'R08': (7, "Deux jours qui se suivent : la qualité de la veille passe au seuil (P7 v8) et la sortie longue reste facile, c'est la bonne réponse. La muscu doublée les deux jours, dont un full body après la sortie longue, reste lourde : une sortie longue un autre jour serait mieux (l'appli le conseille)."),
 'R09': (8, "Refus juste : on ne prépare pas un 10 km avec une seule sortie. Le repli garde une sortie facile d'1 h et trois full body complets. La porte de sortie « 2 sorties » est la bonne."),
 'R10': (8, "Refus juste (40 min par semaine). Le repli « courir plus » monte doucement (40 → 64 min) avec une qualité douce, ce qui prépare le 10 km plus tard."),
 'R11': (8, "Bon plan de semi : seuil + VMA longue, sortie longue jusqu'à 2 h, +35 % de volume en 7 semaines, 85 % de facile. La séance de tonification unique (20 séries de 2) est un entretien."),
 'R12': (9, "Plan très équilibré : seuil puis allure semi, sortie longue de 1 h 57, 89 % de facile, et 2 full body complets avec la muscu prioritaire. Je le donnerais tel quel."),
 'R13': (7, "Plan sûr pour un débutant pas régulier : fartlek une semaine sur deux, sortie longue qui monte à 1 h 40. Mais les séances de semaine de 25-30 min font peser la sortie longue à 62 % : 45 min deux fois par semaine aideraient (E10 ne le propose qu'à partir du niveau intermédiaire)."),
 'R14': (8, "« Plan court » à 5 semaines du semi pour un avancé : allure semi chaque semaine, sortie longue jusqu'à 1 h 41, puis l'affûtage. Adapté."),
 'R15': (8, "Très longue préparation (16 semaines) enfin variée (côtes, fartlek, seuil en rotation) puis 2 qualités. La hausse est modeste (200 → 237 min), ce qui est sain sur 30 semaines."),
 'R16': (6, "Le semi passe le minimum C9, mais avec 2 sorties et une sortie longue plafonnée à 1 h 30 (sous la cible d'1 h 45), le plan est juste : 65 % du volume dans la sortie longue. Une 3e sortie et 2 h de sortie longue en feraient un vrai plan de semi."),
 'R17': (8, "Refus juste : 1 h de sortie longue ne prépare pas un semi. Le repli « courir plus » reste à 150 min parce que les séances ne contiennent pas plus ; l'appli propose plus de temps."),
 'R18': (7, "Plan d'expert solide (seuil 3 × 10', 7 × 1000 m, 89 % de facile) et le jour de repos est gardé (P5). Mais 3 EF de 18 km pour une sortie longue de 24 km, c'est déséquilibré : je raccourcirais les EF et allongerais la sortie longue si le temps le permet."),
 'R19': (8, "E3 fait son travail : 330 min déclarées, 210 possibles, départ à la capacité. Le plan de semi qui suit est propre (seuil, sortie longue jusqu'à 2 h)."),
 'R20': (9, "Très bon plan de marathon : seuil + allure marathon, sortie longue de 3 h en spécifique, +27 % de volume, affûtage de 2 semaines. Je le donnerais tel quel."),
 'R21': (9, "Plan d'avancé exemplaire : 5 sorties, 2 qualités, sortie longue de 31 km, 86 % de facile, et la séance jambes placée après le seuil (P2). Haut / bas bien répartis."),
 'R22': (7, "Premier marathon correct, mais avec 3 sorties la sortie longue de 2 h 45-3 h fait 58 % de la semaine. C'est le minimum C9 ; une 4e sortie rendrait ce plan bon."),
 'R23': (8, "« Plan court » marathon à 6 semaines : allure marathon chaque semaine, sortie longue jusqu'à 2 h 31, affûtage. Honnête et prudent ; l'appli annonce la sortie longue max."),
 'R24': (8, "Débutant qui prépare un marathon en 32 semaines : préparation variée, hausse à +5 %, sortie longue limitée au bas de la fourchette (2 h 45, C14 v8). Long, prudent, crédible."),
 'R25': (8, "Refus juste (2 sorties pour un marathon). Le repli garde la sortie longue à 1 h 40 (C8 v8) au lieu de la pousser à 2 h 30 : c'est ce que je voulais. Force en 2 séances de 70-75 min, c'est le haut de ce que j'accepte."),
 'R26': (6, "Avec 45 min proposées en semaine (E10), c'est mieux qu'avant, mais un marathon sur 3 sorties dont une sortie longue de 2 h 42 (63 %) reste déséquilibré. La muscu (2 séances de 28 min) est symbolique."),
 'R27': (8, "Refus défendable : 140 min par semaine ne donnent que 162 min en fin de préparation, sous les 3 h du minimum marathon. Le repli « courir plus » avec 1 qualité monte vers 225 min et permet de viser le marathon au cycle suivant."),
 'R28': (8, "Plan d'expert crédible (6 sorties, sortie longue de 36 km, 90 % de facile). L'utilisateur refuse le repos et l'appli met un conseil fort ; 8 séances, c'est le plafond E12. La force en 70-74 min est longue mais tient."),
 'R29': (8, "« Garder la forme » d'un débutant au poids du corps : une qualité douce, 2 full body de 30 min. Simple et suffisant ; il manque les biceps (M11)."),
 'R30': (9, "Très bon plan d'entretien : 1 qualité en rotation, 96 % de facile, push / pull / jambes complets (6-7 séries par groupe), jambes le lendemain de la sortie longue. Tel quel."),
 'R31': (8, "Muscu prioritaire bien servie : pecs et dos à 15 séries, push / pull / haut. La sortie unique reste facile (C8). Le renfo garde un peu de jambes, c'est le minimum pour un coureur."),
 'R32': (8, "E11 regroupe 3 sorties de 20 min en 2 sorties de 30 min : c'est mieux. Le reste est simple et sain."),
 'R33': (8, "Avec « je ne sais pas » partout et sans chrono : test en semaine 1, 3 sorties proposées puis regroupées (E11), une séance de muscu. Un bon départ par défaut."),
 'R34': (8, "Débutant qui veut courir plus : +5 % par semaine (90 → 115 min) et une seule qualité, c'est prudent et juste."),
 'R35': (7, "Une seule qualité maintenant, bien. Mais +60 % en 7 semaines (150 → 242 min) reste rapide pour un intermédiaire, même à +10 % par semaine : je plafonnerais la hausse d'un cycle « courir plus » (voir points ouverts)."),
 'R36': (8, "La sortie unique d'1 h 45 est répartie en 2 sorties (E11) : bonne décision. Le volume monte ensuite proprement avec une qualité."),
 'R37': (8, "E12 retire une séance de force (7 → 6 séances pour un débutant) et la hausse reste à +5 % : la charge totale est enfin raisonnable."),
 'R38': (8, "Plafond de volume atteint en 3 semaines puis tenu, une qualité en rotation : plan d'entretien solide pour un avancé."),
 'R39': (8, "« Plus vite » bien construit : rotation VMA courte, seuil, VMA longue, côtes ; muscu prioritaire haut / bas complète."),
 'R40': (9, "Plan d'expert pour progresser : 2 qualités, sortie longue d'1 h 44, 86 % de facile. Tel quel."),
 'R41': (7, "Un seul jour : une sortie facile et un full body au poids du corps. L'appli le dit (« 2 sorties minimum pour progresser », C8). C'est de l'entretien, pas une progression, et c'est le choix de l'utilisateur."),
 'R42': (8, "Débutant, 30 min par jour : qualités courtes et douces (seuil 2 × 6'), 87 % de facile. Adapté au temps."),
 'R43': (8, "« Plus vite » avec 4 sorties : rotation des qualités, volume stable ; force + esthétique en 2 séances complètes."),
 'R44': (8, "Débutant en muscu : 3 full body légers (10-13 séries, 30-38 min) au bas de la fourchette (M22 v8). C'est exactement le volume de départ que je donnerais."),
 'R45': (8, "La force en 45 min devient de l'hypertrophie (M23) et les séances alternent bas / haut / bas / haut (P13 v8) : bon plan."),
 'R46': (8, "Push / pull / jambes × 2 bien espacés (jambes lundi et jeudi), épaules et fessiers prioritaires à 15-16 séries. Les séances pull sont courtes (30-35 min) mais suffisent."),
 'R47': (7, "La force au poids du corps devient de l'hypertrophie, c'est juste. Les spécifiques complètent les jambes ; il manque toujours les biceps sans barre (M11)."),
 'R48': (7, "Course propre. À la maison, les fessiers prioritaires montent à 10 séries grâce aux spécifiques (M8), sans atteindre 12 (M13 honnête) : un hip thrust lesté ou une séance de plus réglerait ça."),
 'R49': (7, "Plan de semi propre. L'exclusion du dos et des abdos est respectée avec un conseil et une version légère proposée (M11) ; je la déconseillerais à un coureur."),
 'R50': (7, "La muscu prioritaire en 4 séances est riche (dos 12, pecs 11). La course à 2 sorties (VMA + sortie longue à 62 %) prépare le 10 km au minimum ; la 3e sortie serait la bienvenue."),
}


def verdict(n):
    return 'Bon' if n >= 8 else ('À retoucher' if n >= 6 else 'À refuser')


D = os.path.dirname(os.path.abspath(__file__))
json.dump({k: f"**{v[0]}/10 — {verdict(v[0])}.** {v[1]}" for k, v in A.items()}, open(os.path.join(D, 'avis_v8.json'), 'w'), ensure_ascii=False, indent=1)
json.dump({k: dict(note=v[0], verdict=verdict(v[0])) for k, v in A.items()}, open(os.path.join(D, 'notes_v8.json'), 'w'), ensure_ascii=False, indent=1)
if __name__ == '__main__':
    from collections import Counter
    r = [v[0] for k, v in A.items() if k.startswith('R')]
    print(len(A), Counter(verdict(v[0]) for k, v in A.items() if k.startswith('R')), 'moyenne R', round(sum(r) / len(r), 2))

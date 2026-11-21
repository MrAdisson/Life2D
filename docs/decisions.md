<!-- builder:decisions -->
## Décisions prises

Aucun ADR dans le repo. Constats d'après le code et l'historique (un seul commit, « LIFE 2D INIT COMMIT ») :

- Vite sans framework, canevas 2D.
- LIFE-4 : calcul dans un Web Worker et dessin en WebGL 2 (sans WebGPU ni repli Canvas 2D) ; interactions limitées à une portée (`range` dans le réglage) via une grille spatiale ; état en `Float64Array`. Les forces sont sommées par indice de particule croissant, comme l'ancien calcul en O(n²), pour que les résultats restent identiques au bit près (pas de tolérance) quand toutes les paires sont dans la portée.
- LIFE-4 : `defaultSettings` reste le réglage historique (1 585 particules, portée illimitée), attendu par les tests existants ; la page affiche `referenceSettings`, configuration de référence de 20 000 particules (mêmes familles, masses et règles, proportions proches, portée de 30 pixels choisie pour tenir environ 15 ms par pas).
- LIFE-5 : la page affiche désormais `defaultSettings` (1 585 particules, rouge 60, bleu 1 500, vert 5, blanc 20), copié en mémoire, car le ticket demande que « sans modification » la simulation reproduise ce réglage ; `referenceSettings` reste dans `settings.js` mais n'est plus affiché. Le panneau modifie la copie, rien n'est sauvegardé. Les bords ont deux modes (`edges` : `bounce` par défaut, `wrap`). Le nouveau tirage remet les vitesses à zéro (état de départ). Les curseurs de la matrice vont de −1 à 1 (ticket) ; chaque cellule a un champ de saisie libre, pour les règles hors plage du réglage par défaut (2, −3, −5).
- LIFE-9 : `defaultSettings` garde sa portée illimitée (tests au bit près) ; le réglage de départ est `startSettings` (le même avec une portée de 60 px), repris par le préréglage « Quatre familles », car la page s'ouvre sur la galerie depuis LIFE-6. Les préréglages doivent donner une portée finie (validation). La « gravité » demandée est une accélération verticale constante (`gravity`, px/pas², 0 par défaut, négative vers le haut), indépendante de la masse, appliquée seulement si non nulle (calcul inchangé au bit près sinon). La matrice devient une grille compacte de cases colorées dont la case choisie se règle dans un éditeur sous la grille (au lieu d'une modale). Curseur de friction symétrique et logarithmique vers 0 et 1 (4 décades), curseur de portée logarithmique 5–2000 px ; les champs exacts restent la référence. Changer la masse d'un type passe par `sync()` (nouvelle génération côté page pour les rayons). Budget de performance : 50 ms par pas à 10 000 particules (médiane de 7 pas).
- LIFE-10 : cinq préréglages ajoutés (le nombre N du ticket n'était pas fixé) : « Mousse », « Cristal et impuretés », « Émulsion qui décante », « Nageurs », « Mouvement brownien ». Chacun a été choisi pour un phénomène absent des onze préréglages existants, puis vérifié par simulation. Le moteur, le worker, le rendu, l'interface et les onze préréglages existants sont inchangés. Constat : avec la seule force en 1/(distance + epsilon)², un groupe qui ne fait que s'attirer s'effondre en un point ; les volumes (gouttes, parois, réseaux) viennent d'une répulsion entre types. « Mouvement brownien » a une friction de 0,999 et non 1, car avec une friction de 1 et des bords qui rebondissent, l'agitation grandit sans fin. Écartés après essai : comètes (trop proches des « Nageurs »), toupies et chaîne alimentaire (pas assez lisibles), strates concentriques autour d'un noyau (non obtenues). `presets.behaviour.test.js` vérifie le phénomène décrit par chacun des cinq (graine fixe).
- `main.js` (4 familles, masses) est le point d'entrée chargé ; `mainbis.js` (3 familles, sans masse) est laissé dans le repo mais non chargé (lien de filiation non documenté).

<!-- builder:open-questions -->
## Questions ouvertes

- `mainbis.js`, `counter.js` et `gui.js` (vide) : à garder ou supprimer ? `gui.js` annonce-t-il des réglages à venir ?
- `mainbis.js` fixe `canvas.width = window.innerHeight` : intentionnel ?

<!-- builder:glossary -->
## Glossaire

- **Particule** : disque coloré avec position, vitesse, accélération et masse.
- **Groupe** : ensemble de particules de même couleur partageant les mêmes règles.
- **Règle** : coefficient `g` entre deux groupes ; d'après le calcul de `rules` (direction de l'autre particule vers celle-ci), une valeur positive repousse et une valeur négative attire.
- **Epsilon** : valeur (> 0, réglable) ajoutée à la distance pour éviter une force infinie.
- **Gravité** : accélération verticale constante ajoutée à toutes les particules (0 : aucune).

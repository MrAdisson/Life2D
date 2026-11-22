---
id: CAP-APPLIQUER-LA-GRAVITATION-UNIVERSELLE-ENT
title: Appliquer la gravitation universelle entre les corps
parent: CAP-SIMULATION
deprecated: false
---

Un préréglage peut remplacer la matrice de règles par la gravitation universelle (newtonienne) : avec `"interaction": "gravity"`, tous les corps s'attirent deux à deux selon leur masse, sans table de coefficients à régler type par type. C'est le mode prévu pour un système d'astres (un soleil, des planètes placées avec `bodies` : voir CAP-PLACER-DES-CORPS-A-UNE-POSITION-ET-UNE-V).

À ne pas confondre avec la **gravité verticale** (`gravity`, accélération constante vers le bas, voir CAP-SIMULATION-MODIFIER-EN-DIRECT-LA-PORTEE-L) : la gravitation universelle est une attraction entre corps ; la gravité verticale reste applicable en plus, dans les deux modes (0 par défaut).

Règles :
- `interaction` vaut `"rules"` (par défaut, comportement habituel : matrice de règles, portée) ou `"gravity"`.
- En mode gravité, la force entre deux corps de masses m₁ et m₂ à distance d vaut G·m₁·m₂/d², toujours attractive, quelle que soit la distance (portée illimitée) et quel que soit leur type.
- `G` (nombre > 0, 1 par défaut) : constante de gravitation, réglable dans le préréglage et en direct dans le panneau (champ « Constante G », section Physique).
- Epsilon sert d'adoucissement : la distance d est remplacée par √(d² + ε²). Avec un ε petit devant les distances entre corps, les orbites ne sont pas faussées, et deux corps qui se touchent ne reçoivent pas de force infinie. Il se règle dans le panneau comme d'habitude (nombre > 0).
- La masse de chaque corps (celle du corps, sinon celle de son type) fixe à la fois la force qu'il exerce et celle qu'il subit ; les corps lourds bougent donc aussi un peu.
- La portée (`range`) et les règles (`rules`) sont facultatives et sans effet en mode gravité. Dans le panneau, les champs de portée et la grille des interactions sont remplacés par le champ G et une explication.
- Friction, bords (rebond ou traversée), dimensions (2D ou 3D) et nouveau tirage fonctionnent comme dans le mode des règles.
- Validation à l'ouverture de la galerie : `interaction` doit valoir `"rules"` ou `"gravity"` ; en mode gravité, `range` peut manquer (si elle est donnée, nombre > 0) et `rules` peut manquer (si elles sont données, mêmes règles qu'en mode des règles) ; `G`, s'il est donné, doit être un nombre > 0. Un fichier qui ne respecte pas ces règles devient une carte d'erreur.
- Le mouvement est calculé avec un intégrateur symplectique (vitesse-Verlet) et le pas de temps réglable `dt` (voir CAP-INTEGRER-LE-MOUVEMENT-AVEC-UN-PAS-DE-TEM).
- Précision vérifiée par des tests automatiques : deux corps s'attirent exactement selon G·m/d² ; un corps léger lancé sur une orbite circulaire autour d'un corps lourd (environ 560 pas par tour) garde son rayon à moins de 1 % près sur un tour complet (écart mesuré : environ 0,006 %) ; sur une orbite circulaire, l'énergie totale reste à moins de 1 % près sur 10 000 pas.

Limites : chaque corps agit sur tous les autres (calcul sur toutes les paires) : le mode est prévu pour quelques dizaines à quelques centaines de corps. Budget vérifié par un test : un pas à 200 corps tient en moins de 5 ms (environ 0,2 ms sur la machine de développement ; environ 4 ms à 1 000 corps, 16 ms à 2 000) ; aucun avertissement n'est affiché au-delà. Le pas de temps est le même pour tous les corps : une orbite très serrée (peu de pas par tour) ou un passage très près d'un corps lourd perd en précision, sauf à réduire `dt` (et ajouter des sous-pas pour garder la vitesse d'affichage). Aucun préréglage de la galerie n'utilise encore ce mode, et le panneau ne permet pas de passer d'un mode à l'autre. Avec la traversée des bords, l'attraction ne passe pas à travers les bords. Les collisions (fusion de corps) ne sont pas simulées.

Code : `engine.js`, `presets.js`, `settings.js`, `settings-edit.js`, `panel.js`

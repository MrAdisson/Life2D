---
id: CAP-SIMULER-EN-TROIS-DIMENSIONS
title: Simuler en trois dimensions
parent: CAP-SIMULATION
deprecated: false
---

Un réglage peut demander un espace en volume au lieu d'un plan : champ `dimensions` à `3` (`2` par défaut). Les particules ont alors une position, une vitesse et une accélération sur trois axes (x, y, z), et les forces se calculent avec la distance en 3D.

Règles :
- `dimensions` vaut `2` ou `3` ; absent : `2`. En 2D, z reste à 0 et les résultats sont exactement ceux d'avant l'arrivée de l'axe z (mêmes positions à graine identique, même temps de calcul).
- `depth` (facultatif, en pixels, nombre fini > 0) donne la profondeur de l'espace en 3D ; absent : la plus petite des deux dimensions de la fenêtre. Il est ignoré en 2D.
- Les positions initiales et le nouveau tirage placent les particules au hasard dans tout le volume (z compris entre 0 et la profondeur).
- La portée d'interaction se mesure en 3D : deux particules proches en x et y mais éloignées en z n'interagissent pas.
- Les bords `bounce` (rebond) et `wrap` (traversée) s'appliquent aussi sur z, devant et derrière, comme sur x et y.
- La gravité reste verticale (axe y), la friction et epsilon s'appliquent de la même façon sur les trois axes.
- Un préréglage de `presets/` peut contenir `dimensions` (2 ou 3) et `depth` ; toute autre valeur rend le fichier invalide (carte d'erreur dans la galerie).
- `dimensions` est pris en compte au lancement : s'il change pendant la simulation, celle-ci repart d'un nouveau tirage.

Limites : la vue reste en 2D. Elle dessine la projection sur x et y, sans perspective ni profondeur visible (z n'est pas affiché). Aucun préréglage de la galerie n'utilise encore la 3D. Le panneau de réglages ne permet de modifier ni `dimensions` ni `depth`.

Code : `engine.js`, `settings.js`, `simulation-host.js`, `renderer.js`, `presets.js`

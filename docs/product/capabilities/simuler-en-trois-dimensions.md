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
- Les positions initiales et le nouveau tirage placent les particules au hasard dans tout le volume (z compris entre 0 et la profondeur), sauf les corps placés d'un préréglage (`bodies`), qui partent de leur position et de leur vitesse données, z compris.
- La portée d'interaction se mesure en 3D : deux particules proches en x et y mais éloignées en z n'interagissent pas.
- Les bords `bounce` (rebond) et `wrap` (traversée) s'appliquent aussi sur z, devant et derrière, comme sur x et y.
- La gravité reste verticale (axe y), la friction et epsilon s'appliquent de la même façon sur les trois axes.
- Un préréglage de `presets/` peut contenir `dimensions` (2 ou 3) et `depth` ; toute autre valeur rend le fichier invalide (carte d'erreur dans la galerie).
- Le panneau de réglages a un commutateur 2D / 3D, dans la section « Espace », la première du panneau : changer de mode relance la simulation avec un nouveau tirage des positions (vitesses à zéro). En 3D, la profondeur est celle du réglage `depth`, ou à défaut la plus petite dimension de la fenêtre.
- Vue 3D : vue en perspective d'une caméra qui tourne autour du centre de la boîte de simulation, dont les 12 arêtes sont dessinées. Les particules lointaines sont plus petites, plus sombres et passent derrière les proches. Au départ, la caméra est de face : la face avant (z = 0) remplit la fenêtre.
- Commandes de la vue 3D, sur le canevas :
  - glisser (souris, doigt ou stylet) : tourner autour de la boîte. Vers la droite, la face avant part vers la droite ; vers le bas, on voit le dessus. L'inclinaison est bornée à ±90° (vue de dessus ou de dessous, sans passer de l'autre côté) ;
  - molette : rapprocher ou éloigner (zoom de 0,2 à 5 fois) ;
  - double-clic : revenir à la vue de face ;
  - au clavier, une fois le canevas sélectionné (clic ou touche Tab) : flèches pour tourner, « + » / « − » pour zoomer, « 0 » pour revenir à la vue de face.
- Une aide rappelant ces commandes s'affiche en bas de l'écran en 3D. Le point de vue est gardé si l'on repasse en 2D puis en 3D pendant la même simulation ; lancer un autre préréglage repart de la vue de face. La caméra ne change pas la simulation.
- En 2D, le dessin est celui d'avant et les commandes de caméra sont inactives.

Limites : la caméra tourne toujours autour du centre de la boîte (pas de déplacement latéral) ; pas de zoom à deux doigts sur écran tactile (la molette et le clavier seulement) ; pas d'éclairage, seulement taille et teinte selon la distance. Aucun préréglage de la galerie n'utilise encore la 3D (on y passe depuis le panneau) ; le panneau ne permet pas de régler `depth`. La boîte suit la taille de la fenêtre au lancement (comme en 2D, redimensionner la fenêtre ne la change pas).

Code : `engine.js`, `settings.js`, `simulation-host.js`, `renderer.js`, `camera.js`, `orbit-controls.js`, `main.js`, `panel.js`, `presets.js`

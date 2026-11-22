---
id: CAP-VOIR-LA-SIMULATION-EN-3D-ET-TOURNER-AUTO
title: Voir la simulation en 3D et tourner autour
parent: CAP-AFFICHAGE
deprecated: false
---

Quand la simulation est en 3D (préréglage ou commutateur 2D / 3D du panneau), les particules s'affichent comme des sphères éclairées dans une boîte dont on voit les arêtes, sur le fond sombre de la page.

Règles :
- Chaque particule est une sphère ombrée par une lumière fixe venant du haut à gauche de l'écran, avec un reflet discret ; les lointaines sont plus petites et plus sombres et passent derrière les proches. L'éclairage suit l'écran, pas la boîte : il ne change pas quand on tourne.
- Au départ, la caméra est de face : la face avant de la boîte remplit la fenêtre, proportions gardées et centrée si le préréglage fixe une boîte d'autres proportions que la fenêtre (`width`, `height`) ; un préréglage peut aussi donner un zoom de départ (`display.zoom`).
- Glisser avec la souris (bouton gauche), un doigt ou un stylet : tourner autour de la boîte (inclinaison bornée à ±90°).
- Clic droit + glisser, ou Maj + glisser : déplacer la caméra latéralement ; la boîte suit le pointeur. Le déplacement est borné à la plus grande dimension de la boîte.
- Deux doigts sur écran tactile : pincer pour zoomer, glisser ensemble pour déplacer latéralement. Lever un doigt laisse l'autre faire tourner.
- Molette : zoom de 0,2 à 20 fois.
- Double-clic, ou touche « 0 » (canevas sélectionné) : revient à la vue de face, centrée, au zoom de départ (1, ou celui du préréglage).
- Au clavier : flèches pour tourner, Maj + flèches pour déplacer, « + » / « − » pour zoomer.
- Une aide rappelant ces commandes s'affiche en bas de l'écran. La caméra ne change pas la simulation ; son point de vue est gardé si l'on repasse en 2D puis en 3D pendant la même simulation, et lancer un autre préréglage repart de la vue de face.
- Les préréglages « Amas gravitationnels en 3D » et « Système solaire (3D) » de la galerie lancent la simulation directement en 3D.
- En 2D, les particules restent des disques plats et les commandes de caméra sont inactives.
- Au retour à la galerie, le rendu est libéré. Si WebGL 2 manque, un message d'erreur s'affiche.

Limites : l'ombrage est un effet de dessin sur des disques face à l'écran : pas d'ombres portées, et deux sphères qui se coupent ne s'interpénètrent pas visuellement (la plus proche au centre passe devant). Pas d'inertie après un glissé. Le panneau ne permet pas de régler la profondeur `depth`.

Code : `renderer.js`, `camera.js`, `orbit-controls.js`, `main.js`, `style.css`

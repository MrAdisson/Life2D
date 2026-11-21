---
id: CAP-AFFICHAGE-AFFICHER-LE-NOMBRE-D-IMAGES-PA
title: Afficher le nombre d'images par seconde et de particules
parent: CAP-AFFICHAGE
deprecated: false
---

Un compteur, en haut à gauche par-dessus l'animation, affiche par exemple « 60 images/s · 20 000 particules · 60 pas/s » : le nombre d'images dessinées par seconde, le nombre de particules simulées (somme des nombres de particules par type du réglage affiché) et le nombre de pas de simulation calculés par seconde. Les valeurs sont recalculées toutes les demi-secondes, en moyenne sur la demi-seconde écoulée.

Limites : toujours visible, sans possibilité de le masquer ; les mesures s'arrêtent quand l'onglet est en arrière-plan (le navigateur suspend l'animation) ; en cas d'erreur de simulation ou sans WebGL 2, le compteur est remplacé par le message d'erreur.

Code : `stats.js`, `main.js`, `style.css`

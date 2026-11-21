---
id: CAP-SIMULATION-MODIFIER-EN-DIRECT-LA-PORTEE-L
title: Modifier en direct la portée, la friction, les bords, epsilon et la gravité
parent: CAP-SIMULATION
deprecated: false
---

La section « Physique » du panneau règle les règles globales de la simulation. Chaque valeur est appliquée au pas suivant, sans réinitialiser positions ni vitesses, et chaque champ est accompagné d'une courte explication en français.

- **Portée** (pixels) : au-delà, deux particules n'interagissent plus. Un champ pour la valeur exacte (toutes décimales) et un curseur à échelle logarithmique de 5 à 2000 px, plus fin pour les petites portées ; ils restent synchronisés. Champ vide : portée illimitée.
- **Avertissement** : quand la portée est illimitée et que le total des particules atteint 5 000 ou plus, un avertissement en français s'affiche sous la portée (calcul très lent, conseil de donner une portée). Il disparaît dès que la portée redevient finie ou que le total repasse sous 5 000, sans recharger la page.
- **Friction** (0 à 1, facteur appliqué à la vitesse à chaque pas : 1 = aucune perte, 0 = arrêt immédiat). Un champ pour la valeur exacte, qui accepte toutes les décimales (par exemple 0,9995), et un curseur dont l'échelle est logarithmique vers les deux bouts : plus de positions près de 1 et près de 0 (jusqu'à un écart de 0,00005) qu'au milieu. Déplacer le curseur écrit dans le champ la valeur exacte appliquée ; taper dans le champ place le curseur à la position la plus proche, la valeur appliquée restant celle du champ. Une valeur hors de 0…1 est ramenée dans la plage (le champ affiche la valeur appliquée en le quittant) ; une saisie vide ou non numérique est ignorée.
- **Epsilon** (pixels, nombre supérieur à 0) : ajouté à la distance dans le calcul de la force. Plus petit, les rencontres proches sont plus violentes ; plus grand, les forces sont adoucies. Une valeur vide, nulle, négative ou non numérique est refusée avec un message en français et l'ancienne valeur est conservée.
- **Gravité** (pixels par pas², 0 par défaut) : accélération constante ajoutée à chaque pas à la vitesse de toutes les particules, vers le bas (valeur négative : vers le haut), quelle que soit leur masse. Curseur de −0,2 à 0,2 et champ acceptant toute valeur ; une saisie non numérique est refusée avec un message.
- **Bords** : « Rebond » (la vitesse s'inverse au contact du bord) ou « Traversée » (la particule ressort par le bord opposé).

Limites : avec la traversée, les forces ne s'exercent pas à travers les bords ; une portée illimitée ou très grande ralentit le calcul avec beaucoup de particules ; la gravité est toujours verticale (pas de direction réglable) ; en rebond, une forte gravité peut faire « coller » les particules contre le bas du canevas ; un epsilon très petit peut rendre la simulation instable.

Code : `panel.js`, `settings-edit.js`, `scales.js`, `engine.js`

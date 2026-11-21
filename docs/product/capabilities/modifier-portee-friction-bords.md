---
id: CAP-SIMULATION-MODIFIER-EN-DIRECT-LA-PORTEE-L
title: Modifier en direct la portée, la friction et les bords
parent: CAP-SIMULATION
deprecated: false
---

Trois champs du panneau : la portée (distance en pixels au-delà de laquelle deux particules n'interagissent plus ; champ vide : illimitée), la friction (facteur de 0 à 1 appliqué à la vitesse à chaque pas : 1 = aucune perte, 0 = arrêt immédiat) et les bords (« Rebond » : la vitesse s'inverse au contact du bord ; « Passage de l'autre côté » : la particule ressort par le bord opposé). Chaque valeur est appliquée au pas suivant, sans réinitialiser les positions. La constante qui majore la distance (epsilon) n'est pas modifiable.

Limites : avec le passage de l'autre côté, les forces ne s'exercent pas à travers les bords ; une portée illimitée ou très grande ralentit le calcul avec beaucoup de particules.

Code : `panel.js`, `settings-edit.js`, `engine.js`

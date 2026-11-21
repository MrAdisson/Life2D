---
id: CAP-SIMULATION-MODIFIER-EN-DIRECT-LE-NOMBRE-D
title: Modifier en direct le nombre de particules par type
parent: CAP-SIMULATION
deprecated: false
---

Le panneau affiche, pour chaque type, un champ de nombre de particules. Augmenter le nombre ajoute des particules de ce type (positions au hasard, vitesse nulle) ; le diminuer en retire. Les autres types, et les particules déjà présentes, gardent leurs positions et vitesses. Le nombre est un entier de 0 à 100 000. Le compteur affiché en haut à gauche suit le total.

Limites : les particules ajoutées prennent la masse du type (modifiable à côté du nombre, voir CAP-SIMULATION-MODIFIER-EN-DIRECT-LA-MASSE) ; les types dont la masse est aléatoire (masse absente ou 0) tirent la masse de chaque nouvelle particule.

Code : `panel.js`, `settings-edit.js`, `engine.js`, `simulation-host.js`

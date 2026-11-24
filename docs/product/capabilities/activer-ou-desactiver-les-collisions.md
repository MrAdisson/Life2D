---
id: CAP-SIMULATION-ACTIVER-OU-DESACTIVER-LES
title: Activer ou désactiver les collisions en direct dans le panneau de réglages
parent: CAP-SIMULATION
deprecated: false
---

La section « Physique » du panneau de réglages contient une case « Collisions », avec une courte explication en français : cochée, deux particules qui se touchent rebondissent l'une sur l'autre comme des billes (choc élastique, selon leurs masses) au lieu de se traverser.

Au lancement d'un préréglage, la case reflète son réglage : cochée pour « Mouvement brownien » et « Amas gravitationnels », décochée pour les autres. La cocher ou la décocher en cours de simulation (même en pause) change le comportement dès le pas suivant, sans réinitialiser les positions ni les vitesses. Les règles des chocs sont celles de CAP-SIMULATION-FAIRE-ENTRER-EN-COLLISION-LES.

Limites : le choix n'est pas sauvegardé (perdu en revenant à la galerie) ; la case ne règle pas la taille de contact des particules, qui dépend de leur masse ou du rayon donné par le préréglage.

Code : `panel.js`, `settings-edit.js`, `engine.js`

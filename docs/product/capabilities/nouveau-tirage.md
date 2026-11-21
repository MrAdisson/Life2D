---
id: CAP-SIMULATION-TIRER-DE-NOUVELLES-POSITIONS-S
title: Tirer de nouvelles positions sans recharger la page
parent: CAP-SIMULATION
deprecated: false
---

Le bouton « Nouveau tirage » remet toutes les particules à des positions au hasard, avec des vitesses nulles (comme au démarrage). Le nombre de particules par type, les règles, les autres réglages et l'état de pause ne changent pas : en pause, la nouvelle disposition s'affiche et reste figée.

Limites : les masses déjà tirées au hasard (types sans masse fixe) sont conservées.

Code : `panel.js`, `engine.js`, `simulation-host.js`

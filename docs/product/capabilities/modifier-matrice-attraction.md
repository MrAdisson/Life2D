---
id: CAP-SIMULATION-MODIFIER-EN-DIRECT-LA-MATRICE
title: Modifier en direct la matrice d'attraction entre types (−1 à 1)
parent: CAP-SIMULATION
deprecated: false
---

Le panneau affiche une grille : un curseur de −1 à 1 (pas de 0,05) pour chaque couple de types (ligne : type qui subit la force, colonne : type qui l'exerce), avec sa valeur. Positif : répulsion ; négatif : attraction ; 0 : aucune interaction. Déplacer un curseur modifie la règle correspondante et l'effet est visible dès le pas suivant, sans réinitialiser positions ni vitesses.

Limites : les curseurs sont limités à −1…1 ; les règles du réglage par défaut hors de cet intervalle (par exemple −5 ou 2) sont affichées avec leur valeur réelle mais le curseur est en butée, et la première manipulation les ramène dans −1…1.

Code : `panel.js`, `settings-edit.js`, `engine.js`

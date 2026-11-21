---
id: CAP-SIMULATION-MODIFIER-EN-DIRECT-LA-MATRICE
title: Modifier en direct la matrice d'attraction entre types (−1 à 1)
parent: CAP-SIMULATION
deprecated: false
---

Le panneau affiche une grille : un curseur de −1 à 1 (pas de 0,05) pour chaque couple de types (ligne : type qui subit la force, colonne : type qui l'exerce), avec sa valeur. Positif : répulsion ; négatif : attraction ; 0 : aucune interaction. Déplacer un curseur modifie la règle correspondante et l'effet est visible dès le pas suivant, sans réinitialiser positions ni vitesses.

Chaque cellule a aussi un champ de saisie : on y tape une valeur exacte, hors de −1…1 si besoin (par exemple 2 ou −5, comme dans le réglage par défaut). Le curseur reste borné à −1…1 : pour une valeur hors plage, il est en butée et le champ affiche la valeur réelle. Une saisie vide ou non numérique est ignorée.

Limites : une valeur très grande rend les particules très rapides et le calcul peut devenir instable.

Code : `panel.js`, `settings-edit.js`, `engine.js`

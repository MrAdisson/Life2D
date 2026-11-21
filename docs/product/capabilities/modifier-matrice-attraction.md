---
id: CAP-SIMULATION-MODIFIER-EN-DIRECT-LA-MATRICE
title: Modifier en direct la matrice d'attraction entre types
parent: CAP-SIMULATION
deprecated: false
---

La section « Interactions » du panneau montre une grille compacte : une case par couple de types (ligne : type qui subit la force, repéré par sa pastille de couleur et son nom ; colonne : type qui l'exerce, repéré par sa pastille). Chaque case affiche la valeur arrondie de la règle et est colorée : rouge = répulsion (positif), bleu = attraction (négatif), plus intense pour une valeur forte ; neutre pour 0 (aucune interaction). Le survol d'une case donne sa valeur exacte.

Cliquer sur une case la sélectionne (cadre blanc) et l'ouvre dans l'éditeur sous la grille, qui rappelle les deux types concernés : un curseur de −1 à 1 (pas de 0,01) et un champ de saisie exacte qui accepte toute valeur, y compris hors de −1…1 (par exemple 2 ou −5) ; pour une valeur hors plage, le curseur est en butée et le champ affiche la valeur réelle. Une saisie vide ou non numérique est ignorée. Chaque modification met à jour la case et s'applique dès le pas suivant, sans réinitialiser positions ni vitesses.

La grille garde toujours la largeur du panneau, quel que soit le nombre de types (vérifié à 4, 8 et 12 types) : les cases rétrécissent au lieu de faire défiler le panneau horizontalement. Ajouter ou retirer un type redessine la grille ; la case sélectionnée reste ouverte si ses deux types existent encore.

Limites : avec beaucoup de types, les cases deviennent petites et leur valeur affichée est arrondie à deux chiffres (la valeur exacte est dans l'éditeur et au survol) ; les noms longs sont tronqués dans la grille ; une valeur très grande rend les particules très rapides et le calcul peut devenir instable.

Code : `panel.js`, `settings-edit.js`, `engine.js`, `style.css`

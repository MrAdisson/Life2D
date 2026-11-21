---
id: CAP-SIMULATION-MODIFIER-EN-DIRECT-LA-MASSE
title: Modifier en direct la masse d'un type de particules
parent: CAP-SIMULATION
deprecated: false
---

Dans la section « Particules par type » du panneau, chaque type a un champ « Masse » à côté de son nombre de particules. Saisir une masse (nombre supérieur à 0, décimales acceptées) l'applique dès le pas suivant à toutes les particules déjà présentes de ce type : leur masse et leur taille (rayon = masse / 2 + 2 pixels) changent, leurs positions et vitesses sont conservées, sans nouveau tirage ni rechargement. Les particules ajoutées ensuite prennent aussi cette masse. Une masse plus forte rend les particules de ce type plus influentes sur les autres (leur propre accélération ne dépend que de la masse des autres).

Une valeur vide, nulle, négative ou non numérique est refusée : un message en français s'affiche sous le type et la masse précédente est conservée (le champ la réaffiche en le quittant).

Masse aléatoire : un type dont la masse est absente ou 0 (chaque particule tire la sienne entre 0 et 50) a un champ vide marqué « aléatoire » et une note qui l'explique. Saisir une masse fixe l'impose à toutes les particules existantes de ce type.

Limites : on ne peut pas revenir à une masse aléatoire depuis le panneau ; les particules les plus massives sont dessinées en premier (dessous), l'ordre suit les nouvelles masses ; rien n'est sauvegardé.

Code : `panel.js`, `settings-edit.js`, `engine.js`, `simulation-host.js`

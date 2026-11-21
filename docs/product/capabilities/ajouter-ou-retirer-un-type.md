---
id: CAP-SIMULATION-AJOUTER-OU-RETIRER-UN-TYPE-DE
title: Ajouter ou retirer un type de particules pendant la simulation
parent: CAP-SIMULATION
deprecated: false
---

Ajouter : un formulaire du panneau demande un nom (unique, non vide), une couleur, un nombre et une masse (supérieure à 0) ; le nouveau type apparaît sur le canevas, dans la liste des types (avec ses champs de nombre et de masse) et dans la grille des interactions, avec toutes ses règles à 0 (aucune interaction) envers chaque type et envers lui-même. Un message d'erreur en français s'affiche si le formulaire est invalide. Retirer : le bouton « Retirer » d'un type supprime toutes ses particules et toutes les règles qui le citent. Les particules des autres types gardent leur état. La grille des interactions est redessinée à la largeur du panneau, sans défilement horizontal, quel que soit le nombre de types ; la masse d'un type existant se change ensuite dans son champ (voir CAP-SIMULATION-MODIFIER-EN-DIRECT-LA-MASSE).

Limites : la masse demandée à l'ajout est fixe (pas de masse aléatoire) ; on ne peut pas renommer ni recolorer un type existant ; retirer le dernier type est permis (le canevas est alors vide).

Code : `panel.js`, `settings-edit.js`, `engine.js`, `renderer.js`

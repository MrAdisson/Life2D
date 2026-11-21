---
id: CAP-SIMULATION-AJOUTER-OU-RETIRER-UN-TYPE-DE
title: Ajouter ou retirer un type de particules pendant la simulation
parent: CAP-SIMULATION
deprecated: false
---

Ajouter : un formulaire du panneau demande un nom (unique, non vide), une couleur, un nombre et une masse (supérieure à 0) ; le nouveau type apparaît sur le canevas et dans la grille, avec toutes ses règles à 0 (aucune interaction) envers chaque type et envers lui-même. Un message d'erreur en français s'affiche si le formulaire est invalide. Retirer : le bouton « Retirer » d'un type supprime toutes ses particules et toutes les règles qui le citent. Les particules des autres types gardent leur état.

Limites : on ne peut pas renommer ni recolorer un type existant ; retirer le dernier type est permis (le canevas est alors vide).

Code : `panel.js`, `settings-edit.js`, `engine.js`, `renderer.js`

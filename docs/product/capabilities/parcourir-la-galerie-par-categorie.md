---
id: CAP-SIMULATION-PARCOURIR-LA-GALERIE-DE
title: Parcourir la galerie de préréglages classée par catégorie
parent: CAP-GALERIE-PREREGLAGES
---

La galerie range ses préréglages par catégorie : chaque catégorie est une section avec son titre, suivie de ses cartes, triées par ordre alphabétique du titre. Les sections apparaissent toujours dans cet ordre :

1. Pour commencer (« Page blanche », « Quatre familles ») ;
2. Astronomie ;
3. Physique ;
4. Chimie et liquides ;
5. Vivant et émergent ;
6. Esthétique.

Une catégorie sans préréglage valide n'est pas affichée : aucune section n'est vide. Chaque préréglage de `presets/` indique sa catégorie (`category`, identifiant parmi `base`, `astronomie`, `physique`, `chimie`, `vivant`, `esthetique`) ; la liste est fermée. Un fichier sans catégorie ou avec une catégorie inconnue n'apparaît dans aucune section : il devient une carte d'erreur (qui nomme la catégorie fautive et liste les catégories admises), regroupée avec les autres fichiers invalides dans une dernière section « Préréglages invalides », sans empêcher l'affichage des autres cartes.

Limites : pas de recherche, de filtre ni de sommaire pour sauter à une section ; un préréglage n'appartient qu'à une seule catégorie ; ajouter une catégorie demande de modifier le code (`presets.js`).

Code : `gallery.js`, `presets.js` (`CATEGORIES`, `groupByCategory`), `style.css`, `presets/` ; tests : `presets.test.js`

---
id: CAP-SIMULATION-CHOISIR-UNE-SIMULATION-DANS-UN
title: Choisir une simulation dans une bibliothèque de préréglages
parent: CAP-SIMULATION
deprecated: false
---

À l'ouverture, la page affiche une galerie de préréglages : chaque carte montre une vignette, un titre et une courte description (ce qu'on observe et pourquoi). Un clic sur la carte lance la simulation plein écran avec les types, couleurs, nombres de particules et règles du préréglage ; le panneau de réglages est alors replié. Le bouton « Modifier » d'une carte lance la même simulation avec le panneau de réglages déjà déplié, pour partir du préréglage et le changer. Le bouton « ← Galerie » de la simulation l'arrête et ramène à la galerie. Une seule simulation tourne à la fois : lancer un préréglage remplace la simulation en cours.

Dix préréglages sont fournis : les quatre phénomènes (amas gravitationnels, cellules et membranes, chasseurs et proies, cristallisation) et six réglages surtout esthétiques (orbites, feu d'artifice, trois tribus, nébuleuse, huile et eau, lucioles). Ce sont des approximations avec la seule force en 1/distance² du moteur : l'effet est suggéré, pas une reproduction fidèle du phénomène réel.

Chaque préréglage est un fichier JSON du dossier `presets/` (`title`, `description`, `vignette`, `settings`) ; la vignette est une image dont le chemin est relatif à `presets/`. Ajouter un fichier valide fait apparaître une carte après `npm run build` ou le redémarrage de `npm run dev`, sans modifier le code (les vignettes fournies sont produites par `node tools/make-vignettes.js`). Un fichier invalide (JSON mal formé, champ manquant, type ou règle incohérent) n'empêche pas les autres cartes : une carte d'erreur liste ses problèmes dans la galerie et ils sont écrits dans la console. Une vignette introuvable laisse la carte avec un encadré « Pas de vignette ».

Limites : les modifications faites avec « Modifier » ne sont jamais écrites dans le fichier du préréglage et sont perdues en revenant à la galerie ; pas de création, de téléversement, de partage ni de sauvegarde de préréglage depuis l'application ; la liste est fixée au build ; pas de tri ni de recherche (cartes par ordre alphabétique des titres) ; revenir à la galerie ne garde pas la simulation (pas de reprise).

Code : `gallery.js`, `presets.js`, `presets/`, `main.js`, `tools/make-vignettes.js`

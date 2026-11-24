---
id: CAP-SIMULATION-FAIRE-ENTRER-EN-COLLISION-LES
title: Faire entrer en collision les particules (choc élastique), en option par préréglage
parent: CAP-SIMULATION
deprecated: false
---

Un préréglage peut activer les collisions (`"collisions": true` dans `settings`). Elles sont désactivées par défaut : sans la clé, ou avec `false`, les particules se traversent comme avant et la simulation donne exactement le même résultat qu'avant cette option.

Quand elles sont activées :

- deux particules dont les disques (en 2D) ou les sphères (en 3D) se touchent rebondissent l'une sur l'autre. Leur taille est celle de la particule dans la simulation : le facteur « Taille des corps » de l'affichage 3D ne la change pas ;
- le choc est parfaitement élastique et tient compte des masses : la quantité de mouvement et l'énergie de mouvement de la paire sont conservées (deux billes de même masse qui se heurtent de face échangent leurs vitesses ; une bille légère rebondit sur une lourde). La friction reste le seul frein ;
- deux particules qui se chevauchent (au départ, ou poussées l'une dans l'autre par les forces) sont écartées l'une de l'autre en quelques pas, sans rester imbriquées ; deux particules exactement superposées sont aussi séparées ;
- cela marche dans les deux modes d'interaction (matrice de règles et gravitation universelle), en 2D et en 3D, avec les bords en rebond ou en traversée, et quels que soient le pas de temps, les sous-pas et la vitesse de simulation.

Les préréglages « Mouvement brownien » et « Amas gravitationnels » (en 3D comme une fois passé en 2D) activent les collisions ; aucun autre ne le fait, y compris « Système solaire (3D) », dont les tailles d'astres sont exagérées. La validation des préréglages accepte `collisions` à `true` ou `false` et refuse toute autre valeur avec le message « `settings.collisions` : booléen attendu (true ou false) ».

Limites : pas de fusion, d'absorption ni de fragmentation des corps, pas de choc amorti (restitution non réglable), pas de rotation ni de frottement au contact ; avec les bords en traversée, deux particules de part et d'autre d'un bord ne se heurtent pas à travers lui ; les chocs sont traités une fois par pas de calcul, donc une particule très rapide (plus d'un diamètre par pas) peut en traverser une autre ; une particule écartée hors de la boîte y est ramenée (en rebond, à un rayon du bord).

Code : `engine.js`, `presets.js`, `presets/` ; tests : `engine.collisions.test.js`, `engine.perf.test.js`, `presets.test.js`, `presets.behaviour.test.js`

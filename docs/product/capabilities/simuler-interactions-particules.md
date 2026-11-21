---
id: CAP-SIMULER-INTERACTIONS-PARTICULES
title: Simuler les interactions entre familles de particules
parent: CAP-SIMULATION
---

Quatre familles de particules (rouge ×60, bleue ×1500, verte ×5, blanche ×20, de masses différentes) s'attirent ou se repoussent selon une table de coefficients issue d'un objet de réglage unique (positif : répulsion, négatif : attraction, d'après le calcul), avec une force en 1/distance². La simulation démarre seule à l'ouverture de la page, positions initiales aléatoires.

Règles : la distance est majorée d'une constante (EPSILON = 10) pour éviter les divisions par zéro ; friction à 1 (aucune perte) ; le rayon dépend de la masse.

Réglage : un objet JavaScript (`settings.js`) décrit les types (nom, couleur, nombre, masse), les règles (coefficient d'un type vers un autre ; règle absente = aucune interaction), EPSILON et FRICTION. Le réglage par défaut reproduit les quatre familles ci-dessus. Le moteur fonctionne sans navigateur et est couvert par des tests.

Limites : aucune interaction (souris, clavier, boutons), aucune interface de réglage ni pause (le réglage n'est modifiable que dans le code) ; calcul en O(n²) sur ~1600 particules, donc potentiellement lent. Les noms « électron », « eau », « noyau », « proton » ne sont que des commentaires.

Code : `settings.js`, `engine.js`, `main.js` (affichage et boucle)

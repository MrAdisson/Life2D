---
id: simuler-interactions-particules
title: Simuler les interactions entre familles de particules
parent: simulation
---

Quatre familles de particules (rouge ×60, bleue ×1500, verte ×5, blanche ×20, de masses différentes) s'attirent ou se repoussent selon une table de coefficients (positif : répulsion, négatif : attraction, d'après le calcul), avec une force en 1/distance². La simulation démarre seule à l'ouverture de la page, positions initiales aléatoires.

Règles : la distance est majorée d'une constante (EPSILON = 10) pour éviter les divisions par zéro ; friction à 1 (aucune perte) ; le rayon dépend de la masse.

Limites : aucune interaction (souris, clavier, boutons), aucun réglage ni pause ; calcul en O(n²) sur ~1600 particules, donc potentiellement lent ; les coefficients sont codés en dur. Les noms « électron », « eau », « noyau », « proton » ne sont que des commentaires.

Code : `main.js`

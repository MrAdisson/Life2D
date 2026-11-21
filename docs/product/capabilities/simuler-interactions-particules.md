---
id: CAP-SIMULER-INTERACTIONS-PARTICULES
title: Simuler les interactions entre familles de particules
parent: CAP-SIMULATION
deprecated: false
---

Quatre familles de particules (rouge, bleue, verte, blanche, de masses différentes) s'attirent ou se repoussent selon une table de coefficients issue d'un objet de réglage unique (positif : répulsion, négatif : attraction, d'après le calcul), avec une force en 1/distance². La simulation démarre seule à l'ouverture de la page, positions initiales aléatoires. La page affiche la configuration de référence : 20 000 particules (rouge ×800, bleue ×18 900, verte ×50, blanche ×250), mêmes masses et mêmes règles que le réglage historique, portée de 30 pixels.

Règles : deux particules plus éloignées que la portée d'interaction n'exercent aucune force l'une sur l'autre ; la distance est majorée d'une constante (EPSILON = 10) pour éviter les divisions par zéro ; friction à 1 (aucune perte) ; le rayon dépend de la masse. La simulation avance d'un pas par image affichée, sauf si le calcul d'un pas prend plus d'une image : elle ralentit alors sans que l'affichage soit bloqué. Le calcul tourne en arrière-plan (Web Worker), en double précision.

Réglage : un objet JavaScript (`settings.js`) décrit les types (nom, couleur, nombre, masse), les règles (coefficient d'un type vers un autre ; règle absente = aucune interaction), EPSILON, FRICTION et la portée (`range`, en pixels ; illimitée si absente). Deux réglages sont fournis : le réglage historique (`defaultSettings` : rouge ×60, bleue ×1500, verte ×5, blanche ×20, portée illimitée, mêmes résultats que la version précédente du moteur) et la configuration de référence ci-dessus (`referenceSettings`), seule affichée par la page. Le moteur fonctionne sans navigateur et est couvert par des tests ; à graine identique, le résultat est reproductible.

Limites : aucune interaction (souris, clavier, boutons), aucune interface de réglage ni pause (le réglage n'est modifiable que dans le code, et changer de réglage affiché demande de modifier `main.js`) ; avec une portée illimitée ou très grande, le calcul redevient en O(n²) et lent pour des dizaines de milliers de particules ; le temps de calcul grandit avec la portée et avec le regroupement des particules. L'objectif de 60 images par seconde à 20 000 particules n'a pas encore été mesuré sur un portable de référence (sur le processeur de développement, un pas prend environ 15 ms). Les noms « électron », « eau », « noyau », « proton » ne sont que des commentaires.

Code : `settings.js`, `engine.js`, `simulation-host.js`, `simulation.worker.js`

---
id: CAP-SIMULER-INTERACTIONS-PARTICULES
title: Simuler les interactions entre familles de particules
parent: CAP-SIMULATION
deprecated: false
---

Quatre familles de particules (rouge, bleue, verte, blanche, de masses différentes) s'attirent ou se repoussent selon une table de coefficients issue d'un objet de réglage unique (positif : répulsion, négatif : attraction, d'après le calcul), avec une force en 1/distance². La simulation démarre seule à l'ouverture de la page, positions initiales aléatoires. La page affiche le réglage par défaut de `settings.js` : 1 585 particules (rouge ×60, bleue ×1 500, verte ×5, blanche ×20), portée illimitée ; ce réglage peut ensuite être modifié en direct depuis le panneau de réglages.

Règles : deux particules plus éloignées que la portée d'interaction n'exercent aucune force l'une sur l'autre ; la distance est majorée d'une constante (EPSILON = 10) pour éviter les divisions par zéro ; friction à 1 par défaut (aucune perte) ; le rayon dépend de la masse. La simulation avance d'un pas par image affichée, sauf si le calcul d'un pas prend plus d'une image : elle ralentit alors sans que l'affichage soit bloqué. Le calcul tourne en arrière-plan (Web Worker), en double précision.

Réglage : un objet JavaScript (`settings.js`) décrit les types (nom, couleur, nombre, masse), les règles (coefficient d'un type vers un autre ; règle absente = aucune interaction), EPSILON, FRICTION et la portée (`range`, en pixels ; illimitée si absente). Deux réglages sont fournis : le réglage historique (`defaultSettings`, affiché par la page, mêmes résultats que la version précédente du moteur) et une configuration de 20 000 particules (`referenceSettings` : rouge ×800, bleue ×18 900, verte ×50, blanche ×250, portée de 30 pixels), non affichée par la page. Le moteur fonctionne sans navigateur et est couvert par des tests ; à graine identique, le résultat est reproductible.

Les modifications faites dans le panneau ne sont pas sauvegardées : un rechargement revient au réglage de `settings.js`.

Limites : aucune interaction avec les particules (souris, clavier) ; avec une portée illimitée ou très grande, le calcul redevient en O(n²) et lent pour des dizaines de milliers de particules ; le temps de calcul grandit avec la portée et avec le regroupement des particules. L'objectif de 60 images par seconde à 20 000 particules n'a pas encore été mesuré sur un portable de référence (sur le processeur de développement, un pas prend environ 15 ms). Les noms « électron », « eau », « noyau », « proton » ne sont que des commentaires.

Code : `settings.js`, `engine.js`, `simulation-host.js`, `simulation.worker.js`, `main.js`

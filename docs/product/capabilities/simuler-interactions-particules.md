---
id: CAP-SIMULER-INTERACTIONS-PARTICULES
title: Simuler les interactions entre familles de particules
parent: CAP-SIMULATION
deprecated: false
---

Quatre familles de particules (rouge, bleue, verte, blanche, de masses différentes) s'attirent ou se repoussent selon une table de coefficients issue d'un objet de réglage unique (positif : répulsion, négatif : attraction, d'après le calcul), avec une force en 1/distance². La simulation démarre quand on lance un préréglage depuis la galerie (voir CAP-SIMULATION-CHOISIR-UNE-SIMULATION-DANS-UN), positions initiales aléatoires ; une seule simulation tourne à la fois. Les types, couleurs, nombres et règles viennent du préréglage choisi (de même forme que l'objet de `settings.js`) ; ils peuvent ensuite être modifiés en direct depuis le panneau de réglages.

Règles : deux particules plus éloignées que la portée d'interaction n'exercent aucune force l'une sur l'autre ; la distance est majorée d'une constante (EPSILON = 10) pour éviter les divisions par zéro ; friction à 1 par défaut (aucune perte) ; le rayon dépend de la masse. La simulation avance d'un pas par image affichée, sauf si le calcul d'un pas prend plus d'une image : elle ralentit alors sans que l'affichage soit bloqué. Le calcul tourne en arrière-plan (Web Worker), en double précision.

Réglage : un objet JavaScript (`settings.js`) décrit les types (nom, couleur, nombre, masse), les règles (coefficient d'un type vers un autre ; règle absente = aucune interaction), EPSILON, FRICTION et la portée (`range`, en pixels ; illimitée si absente). Deux réglages restent dans `settings.js` : le réglage historique (`defaultSettings`, mêmes résultats que la version précédente du moteur) et une configuration de 20 000 particules (`referenceSettings` : rouge ×800, bleue ×18 900, verte ×50, blanche ×250, portée de 30 pixels) ; la page ne les affiche pas, ils servent de référence aux tests. Le moteur fonctionne sans navigateur et est couvert par des tests ; à graine identique, le résultat est reproductible.

Les modifications faites dans le panneau ne sont pas sauvegardées : revenir à la galerie ou recharger la page remet le réglage du préréglage, dont le fichier n'est jamais modifié.

Limites : aucune interaction avec les particules (souris, clavier) ; seuls les préréglages de la galerie sont proposés (ni création, ni téléversement, ni sauvegarde de réglage) ; avec une portée illimitée ou très grande, le calcul redevient en O(n²) et lent pour des dizaines de milliers de particules ; le temps de calcul grandit avec la portée et avec le regroupement des particules. L'objectif de 60 images par seconde à 20 000 particules n'a pas encore été mesuré sur un portable de référence (sur le processeur de développement, un pas prend environ 15 ms). Les noms « électron », « eau », « noyau », « proton » ne sont que des commentaires.

Code : `settings.js`, `engine.js`, `simulation-host.js`, `simulation.worker.js`, `main.js`, `presets/`

---
id: CAP-SIMULATION-METTRE-LA-SIMULATION-EN-PAUSE
title: Mettre la simulation en pause, la reprendre ou avancer pas à pas
parent: CAP-SIMULATION
deprecated: false
---

Le bouton « Pause » fige les particules ; il devient « Reprendre », qui relance l'évolution depuis l'état où elle s'est arrêtée. En pause, « Pas à pas » avance la simulation d'exactement une image par clic (un pas de calcul avec le réglage par défaut, autant de pas de temps que de sous-pas sinon, et davantage si la vitesse de simulation est supérieure à 1 : voir CAP-INTEGRER-LE-MOUVEMENT-AVEC-UN-PAS-DE-TEM et CAP-REGLER-LA-VITESSE-DE-LA-SIMULATION-EN-DI) ; hors pause, ce bouton est désactivé. Le panneau indique l'état (en marche ou en pause), le numéro du pas courant (images calculées) et le temps simulé écoulé ; à faible vitesse, un seul pas déplace très peu les particules, le compteur montre qu'il a bien eu lieu. Le temps simulé est suivi de l'unité du préréglage s'il en donne une. Changer la vitesse pendant la pause ne fait rien avancer : elle s'applique au prochain pas ou à la reprise. Les réglages modifiés pendant la pause sont pris en compte au pas suivant.

Limites : pas de raccourci clavier ; l'affichage (compteur d'images par seconde) continue de tourner en pause.

Code : `panel.js`, `main.js`, `simulation-host.js`

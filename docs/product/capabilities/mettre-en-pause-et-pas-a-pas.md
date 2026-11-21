---
id: CAP-SIMULATION-METTRE-LA-SIMULATION-EN-PAUSE
title: Mettre la simulation en pause, la reprendre ou avancer pas à pas
parent: CAP-SIMULATION
deprecated: false
---

Le bouton « Pause » fige les particules ; il devient « Reprendre », qui relance l'évolution depuis l'état où elle s'est arrêtée. En pause, « Pas à pas » avance la simulation d'exactement un pas par clic ; hors pause, ce bouton est désactivé. Les réglages modifiés pendant la pause sont pris en compte au pas suivant.

Limites : pas de raccourci clavier ; l'affichage (compteur d'images par seconde) continue de tourner en pause.

Code : `panel.js`, `main.js`, `simulation-host.js`

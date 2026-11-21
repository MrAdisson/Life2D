---
id: rebond-sur-les-bords
title: Faire rebondir les particules sur les bords
parent: simulation
---

Une particule qui touche un bord du canevas voit sa vitesse inversée.

Limites : la position n'est pas recadrée, seule la vitesse est inversée, donc une particule peut rester un instant au-delà du bord ; l'accélération est aussi inversée, et la taille du canevas n'est pas recalculée si la fenêtre est redimensionnée.

Code : `main.js` (méthode `update`)

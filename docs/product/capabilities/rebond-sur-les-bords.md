---
id: rebond-sur-les-bords
title: Faire rebondir les particules sur les bords
parent: simulation
---

Une particule qui touche un bord du canevas voit sa vitesse inversée et reste dans la zone visible.

Limites : l'accélération est aussi inversée, et la taille du canevas n'est pas recalculée si la fenêtre est redimensionnée.

Code : `main.js` (méthode `update`)

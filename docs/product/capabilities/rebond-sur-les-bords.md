---
id: CAP-REBOND-SUR-LES-BORDS
title: Faire rebondir les particules sur les bords
parent: CAP-SIMULATION
---

Une particule qui touche un bord du canevas (ou de l'espace fixé par le préréglage, `width` / `height`) voit sa vitesse inversée.

Les bords sont réglables dans le panneau de réglages : le rebond est le mode par défaut, l'autre est la traversée (voir la capacité sur la portée, la friction et les bords).

Limites : la position n'est pas recadrée, seule la vitesse est inversée, donc une particule peut rester un instant au-delà du bord ; l'accélération est aussi inversée, et la taille du canevas n'est pas recalculée si la fenêtre est redimensionnée.

Code : `engine.js`

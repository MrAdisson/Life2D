---
id: afficher-animation-plein-ecran
title: Voir l'animation en plein écran
parent: affichage
---

Un canevas de la taille de la fenêtre est ajouté à la page ; chaque image est effacée puis les particules sont dessinées (disques colorés, les plus massives d'abord), à la cadence de `requestAnimationFrame`.

Limites : taille fixée au chargement (pas de redimensionnement) ; thème sombre uniquement par défaut (fond #242424) ; aucune légende ni texte ; page intitulée « Vite App » ; pas de repli si le canevas n'est pas supporté.

Code : `main.js`, `index.html`, `style.css`

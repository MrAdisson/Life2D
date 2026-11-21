---
id: CAP-AFFICHER-ANIMATION-PLEIN-ECRAN
title: Voir l'animation en plein écran
parent: CAP-AFFICHAGE
deprecated: false
---

Un canevas de la taille de la fenêtre, entouré d'un cadre blanc d'un pixel, est ajouté à la page ; à chaque image (cadence de `requestAnimationFrame`), il est effacé puis les particules sont dessinées en WebGL 2 aux dernières positions reçues de la simulation : disques colorés aux bords adoucis, les plus massives d'abord (donc dessous). Le fond du canevas est transparent et laisse voir le fond sombre de la page (#242424). Le dessin ne fait aucun calcul de simulation : il reste fluide même si un pas de calcul est plus long qu'une image.

Limites : taille fixée au chargement (pas de redimensionnement) ; écran haute densité non pris en compte (un pixel du canevas par pixel CSS) ; thème sombre uniquement par défaut ; page intitulée « Vite App » ; WebGL 2 est obligatoire : sans lui, aucun dessin, seul le message « WebGL 2 n'est pas disponible dans ce navigateur. » s'affiche (pas de repli Canvas 2D) ; WebGPU n'est pas utilisé.

Code : `main.js`, `renderer.js`, `index.html`, `style.css`

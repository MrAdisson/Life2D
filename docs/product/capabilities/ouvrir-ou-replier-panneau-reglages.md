---
id: CAP-SIMULATION-OUVRIR-OU-REPLIER-UN-PANNEAU-D
title: Ouvrir ou replier un panneau de réglages pendant la simulation
parent: CAP-SIMULATION
deprecated: false
---

Un panneau « Réglages » est affiché en haut à droite de la simulation : replié quand on lance un préréglage, déplié quand on choisit « Modifier ». Le bouton « Réglages » le replie ou le déplie sans recharger la page ; la simulation continue de tourner dans les deux cas. Chaque réglage est regroupé dans une section avec une courte explication ; les libellés sont en français. Sections : Espace (commutateur 2D / 3D), Lecture (pause, pas à pas, nouveau tirage), Physique (portée, friction, epsilon, gravité, bords, avec un champ de valeur exacte à côté de chaque curseur), Particules par type (nombre et masse), Interactions (grille compacte colorée, rouge : répulsion, bleu : attraction, et éditeur de la case choisie), Nouveau type. Le panneau ne défile que verticalement : aucune section ne déborde en largeur, même avec 12 types. Un avertissement apparaît dans la section Physique quand la portée est illimitée avec 5 000 particules ou plus.

Limites : les réglages ne sont pas sauvegardés (revenir à la galerie ou recharger la page revient au réglage du préréglage) ; pas d'adaptation spécifique aux petits écrans ; le panneau recouvre une partie du canevas quand il est déplié.

Code : `panel.js`, `main.js`, `style.css`

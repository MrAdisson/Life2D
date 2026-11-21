---
id: CAP-SIMULATION-OUVRIR-OU-REPLIER-UN-PANNEAU-D
title: Ouvrir ou replier un panneau de réglages pendant la simulation
parent: CAP-SIMULATION
deprecated: false
---

Un panneau « Réglages » est affiché en haut à droite de la page, déplié au chargement. Le bouton « Réglages » le replie ou le déplie sans recharger la page ; la simulation continue de tourner dans les deux cas. Les libellés sont en français.

Limites : les réglages ne sont pas sauvegardés (un rechargement revient au réglage de `settings.js`) ; pas d'adaptation spécifique aux petits écrans ; le panneau recouvre une partie du canevas quand il est déplié.

Code : `panel.js`, `main.js`, `style.css`

<!-- builder:pitch -->
## Pitch

« Life » : une simulation de particules 2D en JavaScript dans le navigateur, où des familles de particules colorées s'attirent ou se repoussent selon des règles (voir `index.html`, `main.js`).

<!-- builder:scope -->
## Périmètre

Aujourd'hui : une seule page, une animation canevas (WebGL 2, calcul dans un Web Worker, 1 585 particules par défaut) avec un compteur d'images par seconde, avec un panneau de réglages en direct (nombres par type, matrice d'attraction, portée, friction, bords, pause et pas à pas, nouveau tirage, ajout et retrait de types), sans sauvegarde des réglages ni interaction avec les particules ; la page affiche le réglage par défaut de `settings.js` (1 585 particules). Voir la carte des capacités : `docs/product/capabilities/`. Le code non chargé (`mainbis.js`, `counter.js`, `gui.js` vide) est hors périmètre.

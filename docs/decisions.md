<!-- builder:decisions -->
## Décisions prises

Aucun ADR dans le repo. Constats d'après le code et l'historique (un seul commit, « LIFE 2D INIT COMMIT ») :

- Vite sans framework, canevas 2D.
- `main.js` (4 familles, masses) est le point d'entrée chargé ; `mainbis.js` (3 familles, sans masse) est laissé dans le repo mais non chargé (lien de filiation non documenté).

<!-- builder:open-questions -->
## Questions ouvertes

- `mainbis.js`, `counter.js` et `gui.js` (vide) : à garder ou supprimer ? `gui.js` annonce-t-il des réglages à venir ?
- `mainbis.js` fixe `canvas.width = window.innerHeight` : intentionnel ?

<!-- builder:glossary -->
## Glossaire

- **Particule** : disque coloré avec position, vitesse, accélération et masse.
- **Groupe** : ensemble de particules de même couleur partageant les mêmes règles.
- **Règle** : coefficient `g` entre deux groupes ; d'après le calcul de `rules` (direction de l'autre particule vers celle-ci), une valeur positive repousse et une valeur négative attire.
- **EPSILON** : constante ajoutée à la distance pour éviter une force infinie.

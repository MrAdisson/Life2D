<!-- builder:stack -->
## Stack et raisons

JavaScript (modules ES) sans framework, API Canvas 2D, Vite ^5.0.8 comme outil de dev et de build (seule dépendance, de développement). Les raisons ne sont pas documentées ; la structure est celle du gabarit « vanilla » de Vite.

<!-- builder:architecture -->
## Architecture

Application front-end statique : `index.html` charge `main.js`, qui crée un canevas plein fenêtre, instancie les particules (classe `ParticleElement`), applique des règles de force entre groupes (`rules`) puis boucle avec `requestAnimationFrame`. `style.css` donne le style de page. Pas de serveur ni de backend. `mainbis.js` est une variante antérieure/alternative non chargée.

<!-- builder:data -->
## Données

Aucune donnée persistée : l'état (positions, vitesses) vit en mémoire et est tiré au hasard à chaque chargement.

<!-- builder:environments -->
## Environnements et hébergement

`npm run dev` (serveur Vite), `npm run build` (sortie `dist/`), `npm run preview`. L'hébergement n'est pas indiqué dans le repo.

<!-- builder:conventions -->
## Conventions

Modules ES (`"type": "module"`), JavaScript formaté à la Prettier (double guillemets, point-virgule) ; commentaires en anglais, souvent en majuscules. Aucun linter ni formateur configuré.

<!-- builder:quality -->
## Qualité

Aucun test, lint ni vérification de types. Seul le build (`npm run build`) passe et sert de vérification.

<!-- builder:services -->
## Services externes

Aucun.

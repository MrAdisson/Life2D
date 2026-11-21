<!-- builder:stack -->
## Stack et raisons

JavaScript (modules ES) sans framework, WebGL 2 pour le dessin, Web Worker pour le calcul, Vite ^5.0.8 comme outil de dev et de build (seule dépendance, de développement). Les raisons ne sont pas documentées ; la structure est celle du gabarit « vanilla » de Vite.

<!-- builder:architecture -->
## Architecture

Application front-end statique : `index.html` charge `main.js` (thread principal), qui crée un canevas plein fenêtre et le compteur, lance le Web Worker `simulation.worker.js` et dessine à chaque `requestAnimationFrame` les dernières positions reçues (`renderer.js`, WebGL 2, un disque instancié par particule). Le Worker (`simulation-host.js`) fait tourner le moteur `engine.js` : état en `Float64Array`, forces limitées à la portée du réglage grâce à une grille spatiale, sommées dans le même ordre que l'ancien calcul en O(n²) (résultat identique au bit près quand toutes les paires sont dans la portée). Les positions circulent dans un tampon `Float32Array` transféré (sans copie) entre la page et le Worker : la page renvoie le tampon pour demander le pas suivant, donc au plus un pas par image. `stats.js` calcule le compteur. `style.css` donne le style de page. Pas de serveur ni de backend. `mainbis.js` est une variante antérieure/alternative non chargée.

<!-- builder:data -->
## Données

Aucune donnée persistée : l'état (positions, vitesses, accélérations, masses) vit en mémoire dans le Worker et est tiré au hasard à chaque chargement.

<!-- builder:environments -->
## Environnements et hébergement

`npm run dev` (serveur Vite), `npm run build` (sortie `dist/`), `npm run preview`. L'hébergement n'est pas indiqué dans le repo.

<!-- builder:conventions -->
## Conventions

Modules ES (`"type": "module"`), JavaScript formaté à la Prettier (double guillemets, point-virgule) ; commentaires en anglais, souvent en majuscules. Aucun linter ni formateur configuré.

<!-- builder:quality -->
## Qualité

Pas de lint ni de vérification de types. Les tests (`*.test.js` : moteur, grille comparée à un calcul de référence en O(n²) et à la copie figée de l'ancien moteur `fixtures/legacy-engine.js`, protocole du Worker, compteur) se lancent avec `npm test` (`node --test`, sans dépendance) ; le build (`npm run build`) sert aussi de vérification. Le rendu WebGL n'est pas testé automatiquement. Le moteur (`engine.js`) est indépendant du navigateur et reçoit le réglage (`settings.js`) ; `main.js` ne garde que canevas, affichage et boucle.

<!-- builder:services -->
## Services externes

Aucun.

<!-- builder:stack -->
## Stack et raisons

JavaScript (modules ES) sans framework, WebGL 2 pour le dessin, Web Worker pour le calcul, Vite ^5.0.8 comme outil de dev et de build (seule dépendance, de développement). Les raisons ne sont pas documentées ; la structure est celle du gabarit « vanilla » de Vite.

<!-- builder:architecture -->
## Architecture

Application front-end statique : `index.html` charge `main.js` (thread principal), qui affiche d'abord la galerie (`gallery.js` : les fichiers JSON de `presets/` et leurs vignettes sont découverts au build par `import.meta.glob` de Vite ; `presets.js` les valide, un fichier invalide devient une carte d'erreur sans bloquer les autres). Lancer un préréglage crée un canevas plein fenêtre, le compteur et un bouton de retour, lance le Web Worker `simulation.worker.js` avec une copie des réglages, construit le panneau de réglages (`panel.js`, DOM seulement ; les modifications du réglage en mémoire sont dans `settings-edit.js`, sans accès à la page) et dessine à chaque `requestAnimationFrame` les dernières positions reçues (`renderer.js`, WebGL 2, un disque instancié par particule). Le Worker (`simulation-host.js`) fait tourner le moteur `engine.js` : état en `Float64Array`, forces limitées à la portée du réglage grâce à une grille spatiale, sommées dans le même ordre que l'ancien calcul en O(n²) (résultat identique au bit près quand toutes les paires sont dans la portée). Le panneau envoie le réglage modifié au Worker (message `settings`, `reseed` pour un nouveau tirage) ; le moteur relit friction, portée, bords et règles à chaque pas, et `sync()` reconstruit ses tableaux quand les types ou leurs nombres changent (les particules existantes gardent leur état), ce qui change la « génération » de la description des particules envoyée à la page. La pause est gérée côté page : elle garde le tampon de positions au lieu de le renvoyer, le pas à pas le renvoie une fois. Les positions circulent dans un tampon `Float32Array` transféré (sans copie) entre la page et le Worker : la page renvoie le tampon pour demander le pas suivant, donc au plus un pas par image. `stats.js` calcule le compteur. `style.css` donne le style de page. Pas de serveur ni de backend. `mainbis.js` est une variante antérieure/alternative non chargée.

<!-- builder:data -->
## Données

Aucune donnée persistée (le réglage modifié depuis le panneau n'est pas sauvegardé) : l'état (positions, vitesses, accélérations, masses) vit en mémoire dans le Worker et est tiré au hasard à chaque chargement.

<!-- builder:environments -->
## Environnements et hébergement

`npm run dev` (serveur Vite), `npm run build` (sortie `dist/`), `npm run preview`. L'hébergement n'est pas indiqué dans le repo.

<!-- builder:conventions -->
## Conventions

Modules ES (`"type": "module"`), JavaScript formaté à la Prettier (double guillemets, point-virgule) ; commentaires en anglais, souvent en majuscules. Aucun linter ni formateur configuré.

<!-- builder:quality -->
## Qualité

Pas de lint ni de vérification de types. Les tests (`*.test.js` : moteur, modifications du réglage, grille comparée à un calcul de référence en O(n²) et à la copie figée de l'ancien moteur `fixtures/legacy-engine.js`, protocole du Worker, compteur, forme des préréglages de `presets/`) se lancent avec `npm test` (`node --test`, sans dépendance) ; le build (`npm run build`) sert aussi de vérification. Le rendu WebGL n'est pas testé automatiquement. Le moteur (`engine.js`) est indépendant du navigateur et reçoit le réglage (`settings.js`) ; `main.js` ne garde que galerie, canevas, affichage et boucle ; `tools/make-vignettes.js` régénère les vignettes SVG des préréglages en les simulant avec le moteur.

<!-- builder:services -->
## Services externes

Aucun.

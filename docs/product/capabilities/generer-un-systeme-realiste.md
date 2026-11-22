---
id: CAP-GENERER-UN-SYSTEME-REALISTE-A-PARTIR-D-E
title: Générer un système réaliste à partir d'éléments orbitaux
parent: CAP-SIMULATION
deprecated: false
---

Pour qui écrit un préréglage : un outil en ligne de commande calcule, à partir de données astronomiques réelles, la position et la vitesse de départ du Soleil et des planètes, et écrit le bloc de corps (`types` / `bodies`) d'un préréglage en mode gravitation universelle (voir CAP-APPLIQUER-LA-GRAVITATION-UNIVERSELLE-ENT et CAP-PLACER-DES-CORPS-A-UNE-POSITION-ET-UNE-V). Rien à calculer à la main.

Usage : `node tools/make-solar-system.js [--ua 100] [--temps jour|annee] [--pluton] [--epaisseur n] [--centre x,y,z] [--preset presets/fichier.json]`.

Règles :
- Corps : le Soleil (astre émissif) et les huit planètes, de Mercure à Neptune, chacun dans son propre type, avec un nom, une couleur et un rayon d'affichage. Pluton s'ajoute avec `--pluton`. La Lune n'est pas incluse.
- Données réelles : demi-grand axe, excentricité, inclinaison et orientation de chaque orbite (époque J2000, JPL) et masses (IAU 2009). Les sources sont listées dans `docs/technical.md`.
- Unités : 1 UA vaut 100 unités du moteur (réglable avec `--ua`), les masses sont en masses solaires et l'unité de temps est le jour (ou l'année avec `--temps annee`). L'outil écrit la constante `G` qui va avec ces unités, l'adoucissement `epsilon`, l'unité du temps affiché (`timeUnit` : « jours » ou « années ») et la taille de la boîte : largeur `width` et hauteur `height` (qui contiennent toutes les orbites et remplacent la taille de la fenêtre), profondeur `depth` (la même que la largeur, ou l'épaisseur donnée par `--epaisseur` : les orbites étant presque dans un même plan, 300 unités suffisent sans Pluton).
- Distances à l'échelle réelle ; seules les tailles d'affichage sont exagérées (le Soleil fait 0,12 UA à l'écran, la Terre 0,04 UA), et elles suivent l'échelle des distances.
- Départ : chaque planète part de son périhélie (point le plus proche du Soleil), avec la vitesse qui lui fait décrire son orbite réelle. Le centre de masse du système est immobile, au centre d'une boîte qui contient toutes les orbites (ou au point `--centre`), donc le système ne dérive pas.
- Simulées par le moteur, les planètes de Mercure à Mars bouclent leur orbite dans la période de la 3ᵉ loi de Kepler à 2 % près (Terre : environ 365 jours), et l'énergie et la quantité de mouvement du système varient de moins de 1 % sur un an simulé (vérifié par les tests).
- Sortie : le bloc en JSON sur la sortie standard ; avec `--preset`, les clés `G`, `epsilon`, `timeUnit`, `width`, `height`, `depth` et `types` du préréglage sont remplacées, et le reste du fichier est gardé. Mêmes options, même sortie au caractère près.
- Une option invalide arrête l'outil avec un message en français.

Limites : les planètes partent toutes de leur périhélie au même instant, pas de leur position réelle à une date donnée. Le préréglage « Système solaire (3D) » de la galerie est écrit par cet outil (`node tools/make-solar-system.js --epaisseur 300 --preset presets/systeme-solaire.json`). Avec `--epaisseur`, l'outil ne vérifie pas que les orbites tiennent dans l'épaisseur choisie (trop mince, une planète inclinée rebondirait sur une face). L'outil ne se lance pas depuis l'application.

Code : `orbital-elements.js`, `solar-system.js`, `tools/make-solar-system.js`

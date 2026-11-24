---
id: CAP-SIMULATION-CHOISIR-UNE-SIMULATION-DANS-UN
title: Choisir une simulation dans une bibliothèque de préréglages
parent: CAP-SIMULATION
deprecated: false
---

À l'ouverture, la page affiche une galerie de préréglages : chaque carte montre une vignette, un titre et une courte description (ce qu'on observe et pourquoi). Un clic sur la carte lance la simulation plein écran avec les types, couleurs, nombres de particules et règles du préréglage ; le panneau de réglages est alors replié. Le bouton « Modifier » d'une carte lance la même simulation avec le panneau de réglages déjà déplié, pour partir du préréglage et le changer. Le bouton « ← Galerie » de la simulation l'arrête et ramène à la galerie. Une seule simulation tourne à la fois : lancer un préréglage remplace la simulation en cours.

Vingt et un préréglages sont fournis, rangés par catégorie (voir CAP-SIMULATION-PARCOURIR-LA-GALERIE-DE) :

- Pour commencer : « Quatre familles », le réglage de départ historique (1 585 particules rouges, bleues, vertes et blanches) avec une portée finie de 60 pixels, et « Page blanche », un seul type de 400 particules sans aucune règle (rien ne bouge) pour construire sa propre simulation avec « Modifier » ;
- Astronomie : « Amas gravitationnels », « Orbites », « Système solaire (3D) » et « Collision de galaxies (3D) » ;
- Physique : « Cristal et impuretés », « Mouvement brownien » ;
- Chimie et liquides : « Cristallisation », « Émulsion qui décante », « Huile et eau », « Mousse », « Gouttes en apesanteur (3D) » ;
- Vivant et émergent : « Cellules et membranes », « Chasseurs et proies », « Lucioles », « Nageurs », « Trois tribus », « Ronde des cinq tribus (3D) » ;
- Esthétique : « Feu d'artifice », « Nébuleuse ».

La plupart des préréglages comptent de 2 000 à 5 000 particules (« Ronde des cinq tribus (3D) » en compte 10 000, « Gouttes en apesanteur (3D) » 9 000) ; chacun tient dans le budget de calcul (50 ms par pas à portée finie, 5 ms par pas en gravitation universelle, mesuré par les tests). Phénomènes notables :

- « Mousse » : des cellules qui se repoussent s'espacent régulièrement et chassent une poussière bleue sur leurs frontières, qui dessine un réseau de parois proche d'une mousse ou d'un pavage de Voronoï ;
- « Cristal et impuretés » : des charges de même signe, enfermées par des bords qui rebondissent, se rangent en réseau régulier de triangles (cristal de Wigner) ; quelques impuretés immobiles creusent le réseau autour d'elles ;
- « Émulsion qui décante » : sous la gravité, des particules orange que le liquide bleu repousse forment des gouttes et des filaments qui coulent, puis une couche au fond sous le liquide (environ 2 000 pas, une demi-minute à 60 images par seconde) ;
- « Nageurs » : chaque particule orange poursuit une bleue qui la fuit ; la paire file droit jusqu'à la prochaine collision (règles non réciproques, comme dans la matière active) ;
- « Mouvement brownien » : un gaz de petites molécules agitées bombarde quelques grains jaunes, qui avancent lentement en zigzags imprévisibles ; les collisions y sont activées : molécules et grains rebondissent comme des billes dures au lieu de se traverser ;
- « Amas gravitationnels » : la poussière tombe vers des étoiles lourdes et s'agglomère en amas ; les collisions y sont activées, donc les corps ne se traversent plus, en 3D comme en 2D ; le préréglage démarre en 3D et le commutateur 2D / 3D du panneau le fait passer à plat (il remplace les anciens « Amas gravitationnels » en 2D et « Amas gravitationnels en 3D ») ;
- « Collision de galaxies (3D) » : deux galaxies de 100 corps (un cœur massif et 99 étoiles en disque, disques inclinés) se frôlent en gravitation universelle ; au premier passage, quelques secondes après le lancement, les marées arrachent une bonne partie des étoiles en bras et en ponts, puis les deux cœurs restent liés et tournent l'un autour de l'autre ;
- « Ronde des cinq tribus (3D) » : 10 000 particules de cinq couleurs, chacune poursuit la suivante et fuit la précédente ; des essaims colorés se poursuivent sans fin dans le volume ;
- « Gouttes en apesanteur (3D) » : trois liquides qui ne se mélangent pas, sans gravité, se rassemblent chacun en gouttes qui grossissent.

Seuls « Mouvement brownien » et « Amas gravitationnels » activent les collisions (voir CAP-SIMULATION-FAIRE-ENTRER-EN-COLLISION-LES) ; les autres n'en ont pas, y compris « Système solaire (3D) », dont les tailles d'astres sont exagérées et ne sont pas des tailles physiques.

Cinq préréglages démarrent en 3D : « Amas gravitationnels », « Collision de galaxies (3D) », « Ronde des cinq tribus (3D) », « Gouttes en apesanteur (3D) » et « Système solaire (3D) ». Ce dernier montre le Soleil et les huit planètes (de Mercure à Neptune) avec leurs masses et leurs orbites réelles (données astronomiques J2000, distances à l'échelle, tailles des astres exagérées), attirés par la gravitation universelle :

- au lancement, la vue est de dessus (plan des orbites), zoomée sur le Soleil, les planètes intérieures et Jupiter, avec les noms des astres et leurs traînées ; Saturne et les planètes plus lointaines apparaissent (selon la taille de la fenêtre) en dézoomant à la molette (ou en pinçant) ; un clic sur une planète fait suivre cette planète par la caméra ;
- à la vitesse 1, le temps simulé avance de 12 jours par seconde à 60 images par seconde : la Terre fait le tour du Soleil en une demi-minute environ (365 jours simulés, affichés en jours dans le panneau), Mercure en 7 secondes, Neptune en plus d'une heure ;
- les orbites restent stables sur de nombreuses années simulées, de 0,1× à 100× ; au-delà de 100×, la vitesse est plafonnée (avertissement dans le panneau) plutôt que d'agrandir le pas de calcul, donc les orbites ne se déforment pas ;
- toutes les planètes partent en même temps de leur périhélie (point le plus proche du Soleil), pas de leur position réelle à une date donnée.

Les préréglages à matrice de règles sont des approximations avec la seule force en 1/distance² du moteur : l'effet est suggéré, pas une reproduction fidèle du phénomène réel. Un groupe qui ne fait que s'attirer finit en un seul point : les formes avec un volume (gouttes, parois, réseaux) viennent toujours d'une répulsion entre types. Le mouvement brownien ne vient pas de la chaleur mais des répulsions entre molécules, et le gaz reste agité grâce à une friction juste sous 1 ; les gouttes de l'émulsion n'ont pas de vraie tension de surface.

Chaque préréglage est un fichier JSON du dossier `presets/` (`title`, `description`, `category`, `vignette`, `settings`) ; la vignette est une image dont le chemin est relatif à `presets/`. Ajouter un fichier valide fait apparaître une carte après `npm run build` ou le redémarrage de `npm run dev`, sans modifier le code (les vignettes fournies sont produites par `node tools/make-vignettes.js`). Chaque préréglage doit donner une portée finie : aucune simulation ne démarre avec une portée illimitée (le « Système solaire » en donne une, sans effet en gravitation universelle). Un préréglage peut fixer la taille de son espace (`width`, `height`, en plus de `depth`) au lieu de prendre celle de la fenêtre, et le zoom de la vue 3D au lancement (`display.zoom`). Un fichier invalide (JSON mal formé, champ manquant, catégorie absente ou inconnue, portée absente ou illimitée, type ou règle incohérent) n'empêche pas les autres cartes : une carte d'erreur liste ses problèmes dans la galerie et ils sont écrits dans la console. Une vignette introuvable laisse la carte avec un encadré « Pas de vignette ».

Limites : les modifications faites avec « Modifier » ne sont jamais écrites dans le fichier du préréglage et sont perdues en revenant à la galerie ; pas de création, de téléversement, de partage ni de sauvegarde de préréglage depuis l'application ; la liste est fixée au build ; pas de recherche ni de filtre (cartes groupées par catégorie, puis par ordre alphabétique des titres) ; revenir à la galerie ne garde pas la simulation (pas de reprise). Le mode « gravitation universelle » (« Système solaire (3D) », « Collision de galaxies (3D) ») ne se choisit pas dans le panneau : on ne peut que partir d'un de ces deux préréglages ; « Page blanche » démarre en mode des règles. Passés en 2D, les préréglages 3D gardent leurs nombres et leurs règles, le phénomène peut alors y être moins lisible. « Système solaire (3D) » : à vitesse élevée, la traînée de Mercure devient anguleuse (une position par image) sans que son orbite change ; à 100× une image avance de 20 jours ; en passant en 2D, tout le système tient dans la fenêtre et les astres deviennent des points minuscules, sans noms ni zoom ; dans la vignette, les astres sont grossis pour rester visibles.

Code : `gallery.js`, `presets.js`, `presets/`, `main.js`, `tools/make-galaxies.js` (écrit « Collision de galaxies (3D) »), `tools/make-vignettes.js` (qui sait aussi dessiner un préréglage 3D, vu de face, avec ses traînées) ; tests : `presets.test.js`, `presets.behaviour.test.js`

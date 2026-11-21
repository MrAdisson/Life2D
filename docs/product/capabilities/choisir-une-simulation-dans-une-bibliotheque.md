---
id: CAP-SIMULATION-CHOISIR-UNE-SIMULATION-DANS-UN
title: Choisir une simulation dans une bibliothèque de préréglages
parent: CAP-SIMULATION
deprecated: false
---

À l'ouverture, la page affiche une galerie de préréglages : chaque carte montre une vignette, un titre et une courte description (ce qu'on observe et pourquoi). Un clic sur la carte lance la simulation plein écran avec les types, couleurs, nombres de particules et règles du préréglage ; le panneau de réglages est alors replié. Le bouton « Modifier » d'une carte lance la même simulation avec le panneau de réglages déjà déplié, pour partir du préréglage et le changer. Le bouton « ← Galerie » de la simulation l'arrête et ramène à la galerie. Une seule simulation tourne à la fois : lancer un préréglage remplace la simulation en cours.

Seize préréglages sont fournis : « Quatre familles », le réglage de départ historique (1 585 particules rouges, bleues, vertes et blanches) avec une portée finie de 60 pixels pour un calcul fluide, les quatre phénomènes (amas gravitationnels, cellules et membranes, chasseurs et proies, cristallisation), six réglages surtout esthétiques (orbites, feu d'artifice, trois tribus, nébuleuse, huile et eau, lucioles) et cinq phénomènes émergents inspirés de simulations connues :

- « Mousse » : des cellules qui se repoussent s'espacent régulièrement et chassent une poussière bleue sur leurs frontières, qui dessine un réseau de parois proche d'une mousse ou d'un pavage de Voronoï ;
- « Cristal et impuretés » : des charges de même signe, enfermées par des bords qui rebondissent, se rangent en réseau régulier de triangles (cristal de Wigner) ; quelques impuretés immobiles creusent le réseau autour d'elles ;
- « Émulsion qui décante » : sous la gravité, des particules orange que le liquide bleu repousse forment des gouttes et des filaments qui coulent, puis une couche au fond sous le liquide (environ 2 000 pas, une demi-minute à 60 images par seconde) ;
- « Nageurs » : chaque particule orange poursuit une bleue qui la fuit ; la paire file droit jusqu'à la prochaine collision (règles non réciproques, comme dans la matière active) ;
- « Mouvement brownien » : un gaz de petites molécules agitées bombarde quelques grains jaunes, qui avancent lentement en zigzags imprévisibles.

Ce sont des approximations avec la seule force en 1/distance² du moteur : l'effet est suggéré, pas une reproduction fidèle du phénomène réel. Un groupe qui ne fait que s'attirer finit en un seul point : les formes avec un volume (gouttes, parois, réseaux) viennent toujours d'une répulsion entre types. Le mouvement brownien ne vient pas de la chaleur mais des répulsions entre molécules, et le gaz reste agité grâce à une friction juste sous 1 ; les gouttes de l'émulsion n'ont pas de vraie tension de surface.

Chaque préréglage est un fichier JSON du dossier `presets/` (`title`, `description`, `vignette`, `settings`) ; la vignette est une image dont le chemin est relatif à `presets/`. Ajouter un fichier valide fait apparaître une carte après `npm run build` ou le redémarrage de `npm run dev`, sans modifier le code (les vignettes fournies sont produites par `node tools/make-vignettes.js`). Chaque préréglage doit donner une portée finie : aucune simulation ne démarre avec une portée illimitée. Un fichier invalide (JSON mal formé, champ manquant, portée absente ou illimitée, type ou règle incohérent) n'empêche pas les autres cartes : une carte d'erreur liste ses problèmes dans la galerie et ils sont écrits dans la console. Une vignette introuvable laisse la carte avec un encadré « Pas de vignette ».

Limites : les modifications faites avec « Modifier » ne sont jamais écrites dans le fichier du préréglage et sont perdues en revenant à la galerie ; pas de création, de téléversement, de partage ni de sauvegarde de préréglage depuis l'application ; la liste est fixée au build ; pas de tri ni de recherche (cartes par ordre alphabétique des titres) ; revenir à la galerie ne garde pas la simulation (pas de reprise).

Code : `gallery.js`, `presets.js`, `presets/`, `main.js`, `tools/make-vignettes.js` ; tests : `presets.test.js`, `presets.behaviour.test.js`

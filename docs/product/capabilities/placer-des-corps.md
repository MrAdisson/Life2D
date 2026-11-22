---
id: CAP-PLACER-DES-CORPS-A-UNE-POSITION-ET-UNE-V
title: Placer des corps à une position et une vitesse données
parent: CAP-SIMULATION
deprecated: false
---

Un préréglage peut placer certaines particules d'un type à un état précis au lieu de les tirer au hasard, par exemple un astre au centre et une planète lancée à une vitesse donnée. Le type liste ses corps dans `bodies` : `[{ "name": "Terre", "position": [x, y, z], "velocity": [vx, vy, vz], "mass": 3, "radius": 6 }]`.

Règles :
- Les premières particules du type sont ces corps, dans l'ordre de la liste ; elles démarrent exactement à la position et à la vitesse données. Si `count` dépasse le nombre de corps, les particules suivantes sont tirées au hasard comme d'habitude, vitesse nulle.
- `position` et `velocity` sont des tableaux de 2 ou 3 nombres. En 2D, la troisième valeur est ignorée (z reste à 0) ; en 3D, un tableau de deux nombres donne z = 0 (le bord avant de la boîte).
- `name` (facultatif) : affiché comme étiquette en vue 3D quand l'option « Étiquettes » est cochée, et sert à choisir le corps à suivre (voir « Suivre les trajectoires et nommer les corps »). `emissive` (facultatif, booléen) : voir la même capacité.
- `mass` (facultatif, > 0) : masse du corps ; absente, celle du type (ou une masse tirée au hasard si le type n'en fixe pas). Une masse propre au corps est gardée même si l'on change la masse du type dans le panneau.
- `radius` (facultatif, > 0) : taille du disque, à la place de celle qui découle de la masse.
- Le « Nouveau tirage » remet les corps à leur état de départ et ne tire que les autres particules.
- Dans le panneau, baisser le nombre d'un type retire ses dernières particules : les premiers corps sont gardés, dans leur état courant. Remonter le nombre recrée les corps retirés à leur état de départ. Une bulle d'aide sur le champ « Nombre » le rappelle.
- Validation à l'ouverture de la galerie : `bodies` doit être une liste d'objets ; positions et vitesses de 2 ou 3 nombres ; masse et rayon > 0 s'ils sont donnés ; nom non vide s'il est donné ; `count` au moins égal au nombre de corps. Un fichier qui ne respecte pas ces règles devient une carte d'erreur (message en français) sans empêcher les autres.
- Les préréglages sans `bodies` donnent exactement les mêmes résultats qu'avant.

Limites : seul le préréglage « Système solaire (3D) » utilise `bodies` ; le panneau ne permet ni de voir, ni de modifier, ni d'ajouter des corps ; les corps sans `name` ne sont pas distingués des autres particules du type. Passer de 2D à 3D dans le panneau relance la simulation : les corps repartent de leur état donné.

Code : `engine.js`, `presets.js`, `settings.js`, `simulation-host.js`, `panel.js`

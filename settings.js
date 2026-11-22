// Réglage de la simulation.
//
// {
//   interaction: "rules" (par défaut) : forces de la matrice `rules`, dans la
//             portée ; "gravity" : gravitation universelle (newtonienne) entre
//             tous les corps, G·mi·mj/d², toujours attractive, portée
//             illimitée, sans `rules` ni `range` (ignorées). Calcul direct sur
//             toutes les paires : prévu pour quelques centaines de corps,
//   G:        nombre > 0, constante de gravitation du mode "gravity" (1 par
//             défaut),
//   epsilon:  nombre, majoration de la distance (évite la division par zéro) ;
//             en mode "gravity", adoucissement : d devient sqrt(d² + ε²)
//             (à garder petit devant les distances entre corps),
//   dt:       nombre > 0, pas de temps (1 par défaut) : chaque pas du moteur
//             fait avancer le temps simulé de dt. Mode "rules" : Euler
//             semi-implicite (dt = 1 : calcul d'avant, au bit près) ; mode
//             "gravity" : vitesse-Verlet (symplectique). Relu à chaque pas,
//   substeps: entier de 1 à 100, pas de dt calculés par image affichée
//             (1 par défaut), relu à chaque image,
//   friction: nombre, facteur appliqué à la vitesse par unité de temps
//             (friction^dt par pas ; 1 = aucune perte),
//   gravity:  nombre, accélération constante vers le bas en pixels par
//             unité de temps² (par pas² avec dt = 1),
//             la même pour toutes les particules (négative : vers le haut ;
//             absente ou 0 : aucune),
//   edges:    "bounce" (rebond, par défaut) ou "wrap" (traversée),
//   range:    nombre, portée d'interaction en pixels : deux particules plus
//             éloignées n'exercent aucune force l'une sur l'autre
//             (Infinity ou absente : portée illimitée),
//   dimensions: 2 (par défaut) ou 3 : espace plan ou en volume ; en 3D, les
//             positions, vitesses, forces, la portée et les bords portent
//             aussi sur l'axe z. Fixé au lancement de la simulation,
//   depth:    nombre, profondeur de l'espace en pixels (3D seulement ; absente :
//             la plus petite des dimensions du canevas), bornant z pour les
//             bords "bounce" et "wrap",
//   types:    [{ name, color, count, mass, bodies }],  // mass absente ou 0 : masse aléatoire (0-50)
//             bodies (facultatif) : corps placés à un état exact,
//             [{ name, position: [x, y, z], velocity: [vx, vy, vz], mass, radius }]
//             (name, mass et radius facultatifs ; z et vz facultatifs, ignorés
//             en 2D). Les `bodies.length` premières particules du type sont
//             ces corps (count >= bodies.length dans un préréglage) ; les
//             suivantes sont tirées au hasard. Masse du corps absente : celle
//             du type ; rayon absent : dérivé de la masse (masse / 2 + 2),
//   rules:    { [nomDuType]: { [nomDeLAutreType]: g } } (mode "rules"),
// }
//
// rules[a][b] = g : coefficient appliqué aux particules du type a, du fait des
// particules du type b. Positif : répulsion ; négatif : attraction ; règle
// absente : 0 (aucune interaction).

// Réglage historique : 1 585 particules, portée illimitée (même résultat que
// le moteur en O(n²) d'avant la grille).
export const defaultSettings = {
  epsilon: 10,
  friction: 1,
  range: Infinity,
  types: [
    { name: "red", color: "red", count: 60, mass: 4 },
    { name: "blue", color: "blue", count: 1500, mass: 2 },
    { name: "green", color: "green", count: 5, mass: 100 },
    { name: "white", color: "white", count: 20, mass: 15 },
  ],
  rules: {
    red: { red: 1, blue: 1, green: -1, white: -3 },
    blue: { red: 2, blue: 2, green: 2, white: 2 },
    green: { red: 1, blue: 1, green: -1, white: 1 },
    white: { red: -5, blue: 1, green: -1, white: 1 },
  },
};

// Réglage de départ : le réglage historique avec une portée finie de 60 pixels
// (calcul fluide). C'est celui du préréglage « Quatre familles »
// (presets/quatre-familles.json, vérifié par presets.test.js).
export const startSettings = {
  ...defaultSettings,
  range: 60,
};

// Configuration de référence (tests) : 20 000 particules, mêmes familles,
// couleurs, masses et règles que le réglage historique, portée de 30 pixels.
export const referenceSettings = {
  ...defaultSettings,
  range: 30,
  types: [
    { name: "red", color: "red", count: 800, mass: 4 },
    { name: "blue", color: "blue", count: 18900, mass: 2 },
    { name: "green", color: "green", count: 50, mass: 100 },
    { name: "white", color: "white", count: 250, mass: 15 },
  ],
};

// Réglage de la simulation.
//
// {
//   epsilon:  nombre, majoration de la distance (évite la division par zéro),
//   friction: nombre, facteur appliqué à la vitesse à chaque pas (1 = aucune perte),
//   range:    nombre, portée d'interaction en pixels : deux particules plus
//             éloignées n'exercent aucune force l'une sur l'autre
//             (Infinity ou absente : portée illimitée),
//   types:    [{ name, color, count, mass }],  // mass absente ou 0 : masse aléatoire (0-50)
//   rules:    { [nomDuType]: { [nomDeLAutreType]: g } },
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

// Configuration de référence, affichée par la page : 20 000 particules, mêmes
// familles, couleurs, masses et règles que le réglage historique, portée de
// 30 pixels.
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

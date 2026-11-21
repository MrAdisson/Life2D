// Réglage de la simulation.
//
// {
//   epsilon:  nombre, majoration de la distance (évite la division par zéro),
//   friction: nombre, facteur appliqué à la vitesse à chaque pas (1 = aucune perte),
//   types:    [{ name, color, count, mass }],  // mass absente ou 0 : masse aléatoire (0-50)
//   rules:    { [nomDuType]: { [nomDeLAutreType]: g } },
// }
//
// rules[a][b] = g : coefficient appliqué aux particules du type a, du fait des
// particules du type b. Positif : répulsion ; négatif : attraction ; règle
// absente : 0 (aucune interaction).
export const defaultSettings = {
  epsilon: 10,
  friction: 1,
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

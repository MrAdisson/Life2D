// Données du système solaire et bloc `types` / `bodies` d'un préréglage en
// mode gravité. Module sans accès à la page ; les valeurs générées ne
// dépendent que des options (aucun hasard, aucune date).
//
// Sources (voir docs/technical.md, section « Données du système solaire ») :
// - éléments orbitaux : E. M. Standish, « Keplerian Elements for Approximate
//   Positions of the Major Planets », JPL Solar System Dynamics, table 1
//   (époque J2000, valable 1800-2050) : a (UA), e, I (degrés), longitude du
//   périhélie ϖ et longitude du nœud ascendant Ω (degrés) ; l'argument du
//   périhélie est ω = ϖ − Ω. La « Terre » est le barycentre Terre-Lune.
// - masses : rapports masse du Soleil / masse de la planète, IAU 2009
//   System of Astronomical Constants (Luzum et al., 2011) ; Terre seule
//   (la Lune n'est pas incluse), Pluton : système Pluton-Charon.
// - rayons d'affichage et couleurs : choisis pour la lisibilité, sans
//   rapport d'échelle avec les rayons réels (exagérés, LIFE-18). Le rayon
//   d'affichage est donné en UA et suit donc l'échelle des distances.
import { systemStates, unitSystem } from "./orbital-elements.js";

const planet = (name, color, displayRadius, sunPerPlanet, a, e, i, perihelion, node, extra = {}) => ({
  name,
  color,
  displayRadius,
  mass: 1 / sunPerPlanet,
  elements: { a, e, i, node, periapsis: perihelion - node },
  ...extra,
});

export const SOLAR_SYSTEM = [
  { name: "Soleil", color: "#ffc94d", displayRadius: 0.12, mass: 1, emissive: true },
  planet("Mercure", "#b5a99a", 0.025, 6023600, 0.38709927, 0.20563593, 7.00497902, 77.45779628, 48.33076593),
  planet("Vénus", "#e8c27a", 0.038, 408523.719, 0.72333566, 0.00677672, 3.39467605, 131.60246718, 76.67984255),
  planet("Terre", "#4f8cff", 0.04, 332946.048, 1.00000261, 0.01671123, -0.00001531, 102.93768193, 0),
  planet("Mars", "#d9603b", 0.03, 3098703.59, 1.52371034, 0.0933941, 1.84969142, -23.94362959, 49.55953891),
  planet("Jupiter", "#d8b48a", 0.09, 1047.348644, 5.202887, 0.04838624, 1.30439695, 14.72847983, 100.47390909),
  planet("Saturne", "#e3d29b", 0.08, 3497.9018, 9.53667594, 0.05386179, 2.48599187, 92.59887831, 113.66242448),
  planet("Uranus", "#9fdbe3", 0.06, 22902.98, 19.18916464, 0.04725744, 0.77263783, 170.9542763, 74.01692503),
  planet("Neptune", "#4a6fe3", 0.06, 19412.26, 30.06992276, 0.00859048, 1.77004347, 44.96476227, 131.78422574),
  planet("Pluton", "#c9b49b", 0.02, 136566000, 39.48211675, 0.2488273, 17.14001206, 224.06891629, 110.30393684, { optional: true }),
];

// Adoucissement de la gravitation, en UA : négligeable devant les distances
// entre corps (périhélie de Mercure ≈ 0,31 UA).
export const EPSILON_AU = 1e-4;

// 12 chiffres significatifs : valeurs stables d'une machine à l'autre et
// largement assez précises pour le moteur.
const round = (x) => {
  const r = Number(x.toPrecision(12));
  return Object.is(r, -0) ? 0 : r;
};

// Corps retenus : le Soleil et les 8 planètes, plus Pluton si demandé.
export const solarSystemBodies = ({ pluto = false } = {}) =>
  SOLAR_SYSTEM.filter((b) => pluto || !b.optional);

// Demi-côté (en unités du moteur) d'une boîte centrée sur le Soleil qui
// contient toutes les orbites retenues (aphélie le plus lointain, + 10 %).
export const systemHalfSize = (bodies, units) =>
  Math.ceil(
    1.1 * units.au * Math.max(...bodies.map((b) => (b.elements ? b.elements.a * (1 + b.elements.e) : 0))),
  );

// Bloc de réglage pour un préréglage en mode gravité :
// { G, epsilon, timeUnit, width, height, depth, types } (un type par corps,
// avec un seul corps explicite). `width` et `height` fixent la taille de
// l'espace (2 × systemHalfSize, indépendante du canevas). Options : au
// (unités du moteur par UA), time ("day" ou "year"), pluto (booléen),
// thickness (épaisseur de la boîte selon z, `depth` ; par défaut
// 2 × systemHalfSize : un cube), center ([x, y, z] du barycentre ; par
// défaut le centre de la boîte).
export const solarSystemBlock = ({ au, time, pluto = false, thickness, center } = {}) => {
  const units = unitSystem({ au, time });
  const bodies = solarSystemBodies({ pluto });
  const half = systemHalfSize(bodies, units);
  if (thickness !== undefined && !(Number.isFinite(thickness) && thickness > 0)) {
    throw new Error("épaisseur : nombre d'unités > 0 attendu");
  }
  const depth = thickness ?? 2 * half;
  const states = systemStates(bodies, { units, center: center ?? [half, half, depth / 2] });
  return {
    G: round(units.G),
    epsilon: round(EPSILON_AU * units.au),
    timeUnit: units.label,
    width: 2 * half,
    height: 2 * half,
    depth,
    types: states.map(({ body, mass, position, velocity }) => ({
      name: body.name,
      color: body.color,
      count: 1,
      ...(body.emissive ? { emissive: true } : {}),
      bodies: [
        {
          name: body.name,
          position: position.map(round),
          velocity: velocity.map(round),
          mass: round(mass),
          radius: round(body.displayRadius * units.au),
        },
      ],
    })),
  };
};

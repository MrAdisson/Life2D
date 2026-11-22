// Modifications du réglage en mémoire (utilisées par le panneau). Fonctions
// sans accès à la page. Convention des règles : rules[a][b] = g, positif =
// répulsion, négatif = attraction, règle absente = 0.

import { MAX_SUBSTEPS } from "./engine.js";

export { MAX_SUBSTEPS };

export const MAX_COUNT = 100000;

// Avertissement de performance : portée illimitée avec au moins ce nombre de
// particules.
export const WARN_PARTICLES = 5000;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const getRule = (settings, a, b) => settings.rules?.[a]?.[b] ?? 0;

// Valeur libre (les curseurs du panneau vont de −1 à 1, mais une règle peut
// valoir n'importe quel nombre fini, comme celles du réglage par défaut).
export const setRule = (settings, a, b, value) => {
  const n = parseNumber(value);
  settings.rules ??= {};
  settings.rules[a] ??= {};
  settings.rules[a][b] = Number.isFinite(n) ? n : 0;
};

export const setCount = (settings, name, value) => {
  const type = settings.types.find((t) => t.name === name);
  if (!type) return;
  const n = Math.floor(Number(value));
  type.count = Number.isFinite(n) ? clamp(n, 0, MAX_COUNT) : 0;
};

// Portée : nombre > 0 ; vide ou invalide : illimitée.
export const setRange = (settings, value) => {
  const n = parseNumber(value);
  settings.range = n > 0 && Number.isFinite(n) ? n : Infinity;
};

// Nombre saisi (la virgule décimale est acceptée) ; vide ou invalide : NaN.
export const parseNumber = (value) => {
  if (typeof value === "number") return value;
  const text = String(value ?? "").trim().replace(",", ".");
  return text === "" ? NaN : Number(text);
};

// Friction : de 0 à 1 (ramenée dans la plage) ; non numérique : ignorée.
// Renvoie la valeur appliquée.
export const setFriction = (settings, value) => {
  const n = parseNumber(value);
  if (Number.isFinite(n)) settings.friction = clamp(n, 0, 1);
  return settings.friction;
};

// Epsilon : nombre > 0. Renvoie { ok: true } ou { ok: false, error } ; une
// valeur refusée laisse l'ancienne en place.
export const setEpsilon = (settings, value) => {
  const n = parseNumber(value);
  if (!(n > 0) || !Number.isFinite(n)) {
    return { ok: false, error: "Epsilon doit être un nombre supérieur à 0." };
  }
  settings.epsilon = n;
  return { ok: true };
};

// Gravité : tout nombre fini (0 : aucune). Même retour que setEpsilon.
export const setGravity = (settings, value) => {
  const n = parseNumber(value);
  if (!Number.isFinite(n)) {
    return { ok: false, error: "La gravité doit être un nombre (0 : aucune)." };
  }
  settings.gravity = n;
  return { ok: true };
};

// Masse fixe d'un type existant : nombre > 0, appliquée aussi à ses particules
// déjà présentes (par le moteur), corps placés compris (leur masse propre est
// remplacée ; position, vitesse et rayon d'affichage sont gardés). Même retour
// que setEpsilon.
export const setMass = (settings, name, value) => {
  const type = settings.types.find((t) => t.name === name);
  if (!type) return { ok: false, error: "Type inconnu." };
  const n = parseNumber(value);
  if (!(n > 0) || !Number.isFinite(n)) {
    return { ok: false, error: "La masse doit être un nombre supérieur à 0." };
  }
  type.mass = n;
  if (Array.isArray(type.bodies)) {
    type.bodies = type.bodies.map((b) => (b?.mass > 0 ? { ...b, mass: n } : b));
  }
  return { ok: true };
};

// Masse d'un type telle que le panneau l'affiche : { kind, value }.
//   "bodies" : toutes ses particules sont des corps placés de même masse
//              (value = cette masse ; préréglage « Système solaire ») ;
//   "mixed" :  toutes sont des corps placés, de masses différentes ;
//   "fixed" :  masse du type (value) ;
//   "random" : chaque particule tire sa masse.
export const typeMass = (type) => {
  const bodies = Array.isArray(type.bodies) ? type.bodies.slice(0, type.count) : [];
  if (type.count > 0 && bodies.length >= type.count && bodies.every((b) => b?.mass > 0)) {
    const first = bodies[0].mass;
    return bodies.every((b) => b.mass === first)
      ? { kind: "bodies", value: first }
      : { kind: "mixed", value: null };
  }
  if (type.mass > 0) return { kind: "fixed", value: type.mass };
  return { kind: "random", value: null };
};

// Masse aléatoire : ni masse de type, ni corps placés qui en donnent une.
export const hasRandomMass = (type) => typeMass(type).kind === "random";

// Taille de l'espace (unités du moteur, pixels pour un préréglage sans taille
// fixée) : `width`, `height` ou `depth`, nombre de MIN_WORLD_SIZE à
// MAX_WORLD_SIZE. Même retour que setEpsilon.
export const MIN_WORLD_SIZE = 50;
export const MAX_WORLD_SIZE = 100000;
const AXIS_LABEL = { width: "La largeur", height: "La hauteur", depth: "La profondeur" };
export const setWorldSize = (settings, axis, value) => {
  if (!(axis in AXIS_LABEL)) return { ok: false, error: "Dimension inconnue." };
  const n = parseNumber(value);
  if (!(n >= MIN_WORLD_SIZE && n <= MAX_WORLD_SIZE)) {
    return {
      ok: false,
      error: `${AXIS_LABEL[axis]} doit être un nombre de ${MIN_WORLD_SIZE} à ${MAX_WORLD_SIZE}.`,
    };
  }
  settings[axis] = n;
  return { ok: true };
};

// Revient à la taille de la fenêtre (largeur, hauteur) et à la profondeur par
// défaut (la plus petite des deux).
export const fitWorldToWindow = (settings) => {
  delete settings.width;
  delete settings.height;
  delete settings.depth;
};

export const totalParticles = (settings) =>
  settings.types.reduce((n, t) => n + t.count, 0);

// Mode gravitation universelle (interaction: "gravity") : la portée et les
// règles ne servent pas.
export const isGravitation = (settings) => settings.interaction === "gravity";

// Constante de gravitation G (mode "gravity") : nombre > 0. Même retour que
// setEpsilon.
export const setGravitationalConstant = (settings, value) => {
  const n = parseNumber(value);
  if (!(n > 0) || !Number.isFinite(n)) {
    return { ok: false, error: "G doit être un nombre supérieur à 0." };
  }
  settings.G = n;
  return { ok: true };
};

// Pas de temps dt : nombre > 0. Même retour que setEpsilon.
export const setTimeStep = (settings, value) => {
  const n = parseNumber(value);
  if (!(n > 0) || !Number.isFinite(n)) {
    return { ok: false, error: "Le pas de temps doit être un nombre supérieur à 0." };
  }
  settings.dt = n;
  return { ok: true };
};

// Sous-pas par image : entier de 1 à MAX_SUBSTEPS. Même retour que setEpsilon.
export const setSubsteps = (settings, value) => {
  const n = parseNumber(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_SUBSTEPS) {
    return {
      ok: false,
      error: `Le nombre de sous-pas doit être un entier de 1 à ${MAX_SUBSTEPS}.`,
    };
  }
  settings.substeps = n;
  return { ok: true };
};

// Vitesse de simulation : nombre > 0 (multiplicateur du temps simulé par
// seconde réelle). Même retour que setEpsilon.
export const setSpeed = (settings, value) => {
  const n = parseNumber(value);
  if (!(n > 0) || !Number.isFinite(n)) {
    return { ok: false, error: "La vitesse doit être un nombre supérieur à 0." };
  }
  settings.speed = n;
  return { ok: true };
};

// Vrai quand la portée est illimitée et qu'il y a beaucoup de particules
// (mode des règles seulement : la portée ne sert pas en mode gravité).
export const needsRangeWarning = (settings) =>
  !isGravitation(settings) &&
  !Number.isFinite(settings.range ?? Infinity) &&
  totalParticles(settings) >= WARN_PARTICLES;

export const setEdges = (settings, value) => {
  settings.edges = value === "wrap" ? "wrap" : "bounce";
};

// 2 (plan, par défaut) ou 3 (volume).
export const setDimensions = (settings, value) => {
  settings.dimensions = Number(value) === 3 ? 3 : 2;
};

// Ajoute un type (nom unique, couleur, nombre, masse) ; ses règles, avec les
// autres types et avec lui-même, valent 0. Renvoie { ok: true } ou
// { ok: false, error } (message en français).
export const addType = (settings, { name, color, count, mass }) => {
  const label = String(name ?? "").trim();
  if (!label || label === "__proto__") return { ok: false, error: "Nom requis." };
  if (settings.types.some((t) => t.name === label)) {
    return { ok: false, error: "Ce nom existe déjà." };
  }
  if (!String(color ?? "").trim()) return { ok: false, error: "Couleur requise." };
  const m = parseNumber(mass);
  if (!(m > 0) || !Number.isFinite(m)) {
    return { ok: false, error: "La masse doit être supérieure à 0." };
  }
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: "Le nombre doit être un entier positif ou nul." };
  }
  const names = settings.types.map((t) => t.name);
  settings.types.push({
    name: label,
    color: String(color).trim(),
    count: Math.min(n, MAX_COUNT),
    mass: m,
  });
  settings.rules ??= {};
  settings.rules[label] = {};
  for (const other of [...names, label]) {
    settings.rules[label][other] = 0;
    if (other !== label) settings.rules[other] ??= {};
    settings.rules[other][label] = 0;
  }
  return { ok: true };
};

// Retire un type, ses particules (via le nombre de types) et toutes les règles
// qui le citent.
export const removeType = (settings, name) => {
  settings.types = settings.types.filter((t) => t.name !== name);
  delete settings.rules?.[name];
  for (const row of Object.values(settings.rules ?? {})) delete row[name];
};

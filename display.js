// Rendu des astres (vue 3D seulement) : taille d'affichage, traînées d'orbite,
// étiquettes. Réglage facultatif `settings.display` :
//   { sizeFactor, trails, trailLength, labels }
//   sizeFactor : nombre > 0, facteur global sur le rayon d'affichage de tous
//                les corps (1 par défaut) ; la physique n'est pas touchée,
//   trails :     traînées activées (faux par défaut) ; sans effet au-delà de
//                TRAIL_MAX_BODIES particules,
//   trailLength: nombre de dernières positions gardées par corps,
//   labels :     noms des corps affichés (faux par défaut),
//   zoom :       zoom de la caméra au lancement et après réinitialisation
//                (1 par défaut, de MIN_ZOOM à MAX_ZOOM de camera.js).
// Sans accès à la page : testable avec node --test.

import { MAX_ZOOM, MIN_ZOOM } from "./camera.js";

export const DEFAULT_SIZE_FACTOR = 1;
export const MIN_SIZE_FACTOR = 0.05;
export const MAX_SIZE_FACTOR = 100;
export const DEFAULT_TRAIL_LENGTH = 100;
export const MIN_TRAIL_LENGTH = 2;
export const MAX_TRAIL_LENGTH = 500;
// Au-delà de ce nombre de particules, les traînées sont désactivées (coût de
// dessin et de mémoire proportionnel au nombre de corps × longueur).
export const TRAIL_MAX_BODIES = 50;

const parse = (value) => {
  if (typeof value === "number") return value;
  const text = String(value ?? "").trim().replace(",", ".");
  return text === "" ? NaN : Number(text);
};

export const displayOf = (settings) => {
  const d = settings?.display ?? {};
  const size = d.sizeFactor;
  const length = Math.round(d.trailLength);
  return {
    sizeFactor:
      size >= MIN_SIZE_FACTOR && size <= MAX_SIZE_FACTOR ? size : DEFAULT_SIZE_FACTOR,
    trails: d.trails === true,
    trailLength:
      length >= MIN_TRAIL_LENGTH && length <= MAX_TRAIL_LENGTH
        ? length
        : DEFAULT_TRAIL_LENGTH,
    labels: d.labels === true,
    zoom: d.zoom >= MIN_ZOOM && d.zoom <= MAX_ZOOM ? d.zoom : 1,
  };
};

// Traînées possibles : peu de particules.
export const trailsAvailable = (particles) => particles <= TRAIL_MAX_BODIES;

export const setSizeFactor = (settings, value) => {
  const n = parse(value);
  if (!(n >= MIN_SIZE_FACTOR && n <= MAX_SIZE_FACTOR)) {
    return {
      ok: false,
      error: `Facteur attendu : un nombre de ${MIN_SIZE_FACTOR} à ${MAX_SIZE_FACTOR}.`,
    };
  }
  settings.display = { ...settings.display, sizeFactor: n };
  return { ok: true };
};

export const setTrailLength = (settings, value) => {
  const n = parse(value);
  if (!(Number.isFinite(n) && n >= MIN_TRAIL_LENGTH && n <= MAX_TRAIL_LENGTH)) {
    return {
      ok: false,
      error: `Longueur attendue : un entier de ${MIN_TRAIL_LENGTH} à ${MAX_TRAIL_LENGTH}.`,
    };
  }
  settings.display = { ...settings.display, trailLength: Math.round(n) };
  return { ok: true };
};

export const setDisplayFlag = (settings, name, value) => {
  settings.display = { ...settings.display, [name]: value === true };
};

// Historique des dernières positions de `count` corps (tampon circulaire).
// push(positions) : x, y, z par corps ; write(out, colors) : écrit des
// segments (deux sommets x, y, z, r, g, b, a) du plus ancien au plus récent,
// l'opacité croissant vers la position actuelle ; renvoie le nombre de sommets.
export const TRAIL_VERTEX_FLOATS = 7;

export const createTrails = (count, length) => {
  const history = new Float32Array(count * length * 3);
  let filled = 0; // positions gardées (au plus length)
  let head = 0; // prochaine case d'écriture
  return {
    get filled() {
      return filled;
    },
    push(positions) {
      history.set(positions.subarray(0, count * 3), head * count * 3);
      head = (head + 1) % length;
      if (filled < length) filled++;
    },
    // Sommets nécessaires au plus : count × (length − 1) × 2.
    maxVertices: count * Math.max(0, length - 1) * 2,
    // colors : [r, g, b, a] (0 à 1) de chaque corps.
    write(out, colors) {
      let v = 0;
      const start = (head - filled + length) % length;
      for (let b = 0; b < count; b++) {
        const [r, g, bl, a] = colors[b];
        for (let k = 0; k + 1 < filled; k++) {
          const p0 = ((start + k) % length) * count * 3 + b * 3;
          const p1 = ((start + k + 1) % length) * count * 3 + b * 3;
          for (const [p, t] of [[p0, k], [p1, k + 1]]) {
            out[v++] = history[p];
            out[v++] = history[p + 1];
            out[v++] = history[p + 2];
            out[v++] = r;
            out[v++] = g;
            out[v++] = bl;
            out[v++] = a * (0.1 + (0.9 * t) / (filled - 1));
          }
        }
      }
      return v / TRAIL_VERTEX_FLOATS;
    },
  };
};

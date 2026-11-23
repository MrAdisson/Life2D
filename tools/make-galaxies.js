// Écrit le préréglage « Collision de galaxies (3D) » (presets/collision-de-galaxies.json) :
// deux galaxies en disque, chacune un cœur massif entouré d'étoiles légères sur
// des orbites circulaires, lancées l'une vers l'autre en gravitation
// universelle. Les positions et vitesses sont tirées avec une graine fixe :
// relancer l'outil réécrit le même fichier. Usage : node tools/make-galaxies.js
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "presets/collision-de-galaxies.json";
const G = 1;
const EPSILON = 4;
const CORE_MASS = 1000;
const STAR_MASS = 0.05;
const STARS = 99; // par galaxie : 2 × (1 + 99) = 200 corps, budget du mode gravité
const R_MIN = 30;
const R_MAX = 140;
const WIDTH = 1600;
const HEIGHT = 1000;
const DEPTH = 1000;

const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const random = seeded(2023);
const round = (v) => Math.round(v * 1000) / 1000;

// Vitesse circulaire autour d'un cœur adouci par epsilon (voir engine.js).
const circular = (r) => Math.sqrt((G * CORE_MASS * r * r) / (r * r + EPSILON * EPSILON) ** 1.5);

// Disque incliné de `tilt` radians autour de l'axe x, tournant dans le sens `spin`.
const galaxy = (center, velocity, tilt, spin) => {
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const stars = [];
  for (let k = 0; k < STARS; k++) {
    const r = R_MIN + (R_MAX - R_MIN) * Math.sqrt(random());
    const a = random() * 2 * Math.PI;
    const v = circular(r) * spin;
    // Disque dans le plan (x, y), puis rotation autour de x.
    const p = [r * Math.cos(a), r * Math.sin(a), 0];
    const u = [-v * Math.sin(a), v * Math.cos(a), 0];
    const rot = ([x, y, z]) => [x, y * cos - z * sin, y * sin + z * cos];
    const pr = rot(p);
    const ur = rot(u);
    stars.push({
      position: pr.map((c, i) => round(c + center[i])),
      velocity: ur.map((c, i) => round(c + velocity[i])),
      mass: STAR_MASS,
      radius: 3,
    });
  }
  return {
    core: { position: center, velocity, mass: CORE_MASS, radius: 9 },
    stars,
  };
};

const cx = WIDTH / 2;
const cy = HEIGHT / 2;
const cz = DEPTH / 2;
const a = galaxy([cx - 320, cy - 130, cz], [0.45, -0.25, 0], 0.5, 1);
const b = galaxy([cx + 320, cy + 130, cz], [-0.45, 0.25, 0], -0.9, -1);

const settings = {
  interaction: "gravity",
  G,
  epsilon: EPSILON,
  friction: 1,
  dt: 0.5,
  substeps: 2,
  edges: "bounce",
  dimensions: 3,
  width: WIDTH,
  height: HEIGHT,
  depth: DEPTH,
  range: 2000,
  display: { sizeFactor: 1.2, zoom: 1.8 },
  types: [
    {
      name: "cœur",
      color: "#fff4d6",
      count: 2,
      emissive: true,
      bodies: [a.core, b.core],
    },
    { name: "galaxie bleue", color: "#7fb4ff", count: STARS, bodies: a.stars },
    { name: "galaxie dorée", color: "#ffb35c", count: STARS, bodies: b.stars },
  ],
};

let preset;
try {
  preset = JSON.parse(readFileSync(FILE, "utf8"));
} catch {
  preset = {
    title: "Collision de galaxies (3D)",
    description: "",
    category: "astronomie",
    vignette: "vignettes/collision-de-galaxies.svg",
  };
}
preset.settings = settings;
writeFileSync(FILE, `${JSON.stringify(preset, null, 2)}\n`);

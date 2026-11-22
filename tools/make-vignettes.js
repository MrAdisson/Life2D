// Génère les vignettes SVG de presets/vignettes/ : chaque préréglage est
// simulé quelques centaines de pas (graine fixe), puis ses particules sont
// dessinées. Usage : node tools/make-vignettes.js [pas] [nom-du-préréglage]
//
// Préréglage 3D : projection sur le plan x, y (vue de face de la caméra par
// défaut, c'est-à-dire le plan des orbites pour le système solaire), les corps
// lointains dessinés d'abord. Si l'espace n'a pas la taille de la vignette
// (`width` / `height` du réglage) ou si le préréglage donne un zoom de départ
// (`display.zoom`), l'espace est cadré comme dans la page : centré, proportions
// gardées, agrandi du zoom. Le facteur de taille (`display.sizeFactor`)
// s'applique aux rayons, et les traînées (`display.trails`) sont dessinées
// avec les `trailLength` dernières positions de chaque corps ; avec traînées,
// un corps fait au moins MIN_BODY_RADIUS pixels pour rester visible dans la
// carte de la galerie.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createSimulation } from "../engine.js";
import { displayOf, trailsAvailable } from "../display.js";

const W = 1280;
const H = 720;
const steps = Number(process.argv[2] ?? 400);
const only = process.argv[3];
const MIN_BODY_RADIUS = 6;

const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

mkdirSync("presets/vignettes", { recursive: true });
for (const file of readdirSync("presets").filter((f) => f.endsWith(".json"))) {
  if (only && file !== `${only}.json`) continue;
  const preset = JSON.parse(readFileSync(`presets/${file}`, "utf8"));
  const settings = structuredClone(preset.settings);
  const sim = createSimulation(settings, {
    width: W,
    height: H,
    random: seeded(42),
  });
  const in3d = sim.dimensions === 3;
  const display = in3d ? displayOf(settings) : displayOf({});
  const trails = in3d && display.trails && trailsAvailable(sim.count);
  const history = [];
  for (let i = 0; i < steps; i++) {
    sim.step();
    if (trails) {
      history.push(Float64Array.from(sim.state.x.subarray(0, sim.count)));
      history.push(Float64Array.from(sim.state.y.subarray(0, sim.count)));
      if (history.length > 2 * display.trailLength) history.splice(0, 2);
    }
  }
  // Cadrage : identité quand l'espace a la taille de la vignette, sans zoom.
  const scale = Math.min(W / sim.width, H / sim.height) * display.zoom;
  const ox = W / 2 - (sim.width / 2) * scale;
  const oy = H / 2 - (sim.height / 2) * scale;
  const sx = (v) => (v * scale + ox).toFixed(0);
  const sy = (v) => (v * scale + oy).toFixed(0);
  const { x, y, z, radius } = sim.state;
  const color = (i) => settings.types[sim.typeIndex[i]].color;
  const shapes = [];
  if (trails) {
    for (let i = 0; i < sim.count; i++) {
      const points = [];
      for (let k = 0; k < history.length; k += 2) {
        points.push(`${sx(history[k][i])},${sy(history[k + 1][i])}`);
      }
      shapes.push(
        `<polyline points="${points.join(" ")}" fill="none" stroke="${color(i)}" stroke-opacity="0.5" stroke-width="4"/>`,
      );
    }
  }
  const order = in3d ? [...sim.drawOrder].sort((a, b) => z[b] - z[a]) : sim.drawOrder;
  for (const i of order) {
    const r = radius[i] * scale * display.sizeFactor;
    shapes.push(
      `<circle cx="${sx(x[i])}" cy="${sy(y[i])}" r="${(trails ? Math.max(r, MIN_BODY_RADIUS) : r).toFixed(1)}" fill="${color(i)}"/>`,
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#242424"/>${shapes.join("")}</svg>\n`;
  writeFileSync(`presets/vignettes/${file.replace(/\.json$/, ".svg")}`, svg);
}

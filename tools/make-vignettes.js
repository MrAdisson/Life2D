// Génère les vignettes SVG de presets/vignettes/ : chaque préréglage est
// simulé quelques centaines de pas (graine fixe), puis ses particules sont
// dessinées. Usage : node tools/make-vignettes.js [pas] [nom-du-préréglage]
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createSimulation } from "../engine.js";

const W = 1280;
const H = 720;
const steps = Number(process.argv[2] ?? 400);
const only = process.argv[3];

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
  for (let i = 0; i < steps; i++) sim.step();
  const { x, y, radius } = sim.state;
  const circles = [];
  for (const i of sim.drawOrder) {
    const color = settings.types[sim.typeIndex[i]].color;
    circles.push(
      `<circle cx="${x[i].toFixed(0)}" cy="${y[i].toFixed(0)}" r="${radius[i].toFixed(1)}" fill="${color}"/>`,
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#242424"/>${circles.join("")}</svg>\n`;
  writeFileSync(`presets/vignettes/${file.replace(/\.json$/, ".svg")}`, svg);
}

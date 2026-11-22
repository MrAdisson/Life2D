// Écrit le bloc `G` / `epsilon` / `timeUnit` / `width` / `height` / `depth` /
// `types` (corps
// explicites `bodies`) d'un préréglage « système solaire » à partir des
// éléments orbitaux de solar-system.js. Déterministe : mêmes options, même
// sortie, au caractère près.
//
// Usage : node tools/make-solar-system.js [--ua 100] [--temps jour|annee]
//           [--pluton] [--epaisseur n] [--centre x,y,z]
//           [--preset presets/fichier.json]
// Sans --preset, le bloc est écrit en JSON sur la sortie standard. Avec
// --preset, ces clés de `settings` sont remplacées dans le fichier (les
// autres réglages, le titre et la description sont gardés).
import { readFileSync, writeFileSync } from "node:fs";
import { solarSystemBlock } from "../solar-system.js";

const fail = (message) => {
  process.stderr.write(`make-solar-system : ${message}\n`);
  process.exit(1);
};

const options = {};
let preset;
const args = process.argv.slice(2);
for (let k = 0; k < args.length; k++) {
  const arg = args[k];
  const value = () => args[++k] ?? fail(`valeur attendue après ${arg}`);
  if (arg === "--ua") options.au = Number(value());
  else if (arg === "--temps") {
    const t = value();
    if (t === "jour") options.time = "day";
    else if (t === "annee" || t === "année") options.time = "year";
    else fail("--temps : « jour » ou « annee » attendu");
  } else if (arg === "--pluton") options.pluto = true;
  else if (arg === "--epaisseur") options.thickness = Number(value());
  else if (arg === "--centre") {
    const c = value().split(",").map(Number);
    if (c.length !== 3 || !c.every(Number.isFinite)) fail("--centre : x,y,z attendu");
    options.center = c;
  } else if (arg === "--preset") preset = value();
  else fail(`option inconnue : ${arg}`);
}

let block;
try {
  block = solarSystemBlock(options);
} catch (error) {
  fail(error.message);
}

if (preset) {
  const data = JSON.parse(readFileSync(preset, "utf8"));
  data.settings = { ...data.settings, ...block };
  writeFileSync(preset, `${JSON.stringify(data, null, 2)}\n`);
  process.stderr.write(
    `${preset} : ${block.types.length} corps écrits (boîte de ${block.width} × ${block.height} × ${block.depth} unités)\n`,
  );
} else {
  process.stdout.write(`${JSON.stringify(block, null, 2)}\n`);
}

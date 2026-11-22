// Comportement des préréglages ajoutés par LIFE-10 : chaque description dit ce
// qu'on observe ; ces tests vérifient, sur le moteur seul (graine fixe, mêmes
// dimensions que les vignettes), que le phénomène décrit apparaît bien.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSimulation, frameSteps } from "./engine.js";
import { SOLAR_SYSTEM } from "./solar-system.js";
import { DEFAULT_AU } from "./orbital-elements.js";

const W = 1280;
const H = 720;

// Même générateur que tools/make-vignettes.js.
const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const start = (file, seed = 42) => {
  const settings = JSON.parse(readFileSync(`presets/${file}`, "utf8")).settings;
  const sim = createSimulation(settings, { width: W, height: H, random: seeded(seed) });
  // Indices des particules d'un type.
  const of = (name) => {
    const t = settings.types.findIndex((type) => type.name === name);
    assert.ok(t >= 0, `${file} : type ${name}`);
    const ids = [];
    for (let i = 0; i < sim.count; i++) if (sim.typeIndex[i] === t) ids.push(i);
    return ids;
  };
  const run = (steps) => {
    for (let k = 0; k < steps; k++) sim.step();
  };
  return { sim, of, run };
};

const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;

// Écart le plus court (bords qui se rejoignent).
const wrapped = (d, size) => d - size * Math.round(d / size);

test("Émulsion qui décante : les gouttes orange passent sous le liquide", () => {
  const { sim, of, run } = start("emulsion.json");
  const meanY = (ids) => mean(ids.map((i) => sim.state.y[i]));
  const drops = of("goutte");
  const liquid = of("liquide");
  assert.ok(Math.abs(meanY(drops) - meanY(liquid)) < 20, "mélange au départ");
  run(1500); // 25 s à 60 pas par seconde
  assert.ok(
    meanY(drops) - meanY(liquid) > 50,
    `gouttes ${meanY(drops).toFixed(0)} px, liquide ${meanY(liquid).toFixed(0)} px`,
  );
});

test("Nageurs : les paires filent en ligne droite", () => {
  const { sim, of, run } = start("nageurs.json");
  run(300);
  const ids = of("pousseur");
  const { x, y } = sim.state;
  const x0 = ids.map((i) => x[i]);
  const y0 = ids.map((i) => y[i]);
  const px = [...x0];
  const py = [...y0];
  const path = ids.map(() => 0);
  for (let k = 0; k < 120; k++) {
    sim.step();
    ids.forEach((i, n) => {
      path[n] += Math.hypot(wrapped(x[i] - px[n], W), wrapped(y[i] - py[n], H));
      px[n] = x[i];
      py[n] = y[i];
    });
  }
  const net = ids.map((i, n) =>
    Math.hypot(wrapped(x[i] - x0[n], W), wrapped(y[i] - y0[n], H)),
  );
  // En 2 s, une paire avance d'au moins 25 px, presque sans détour.
  assert.ok(mean(net) > 25, `déplacement moyen ${mean(net).toFixed(1)} px`);
  assert.ok(mean(net) / mean(path) > 0.7, "trajets presque rectilignes");
});

test("Mousse : la poussière se range entre les cellules", () => {
  const { sim, of, run } = start("mousse.json");
  run(600);
  const cells = of("cellule");
  const walls = of("paroi");
  const { x, y } = sim.state;
  // Rapport distance à la cellule la plus proche / à la deuxième : proche de
  // 1 sur une frontière, plus faible au hasard.
  const ratio = (px, py) => {
    const d = cells
      .map((j) => Math.hypot(wrapped(px - x[j], W), wrapped(py - y[j], H)))
      .sort((a, b) => a - b);
    return d[0] / d[1];
  };
  const random = seeded(7);
  const observed = mean(walls.map((i) => ratio(x[i], y[i])));
  const chance = mean(walls.map(() => ratio(random() * W, random() * H)));
  assert.ok(
    observed > chance + 0.08,
    `parois ${observed.toFixed(2)}, hasard ${chance.toFixed(2)}`,
  );
});

test("Cristal et impuretés : réseau régulier, creusé autour des impuretés", () => {
  const { sim, of, run } = start("cristal-et-impuretes.json");
  const impurities = of("impureté");
  const { x, y } = sim.state;
  const before = impurities.map((i) => [x[i], y[i]]);
  run(600);
  const charges = of("électron");
  const nearest = (i, ids) =>
    Math.min(
      ...ids.filter((j) => j !== i).map((j) => Math.hypot(x[i] - x[j], y[i] - y[j])),
    );
  const inner = charges.filter(
    (i) => x[i] > 60 && x[i] < W - 60 && y[i] > 60 && y[i] < H - 60,
  );
  const nn = inner.map((i) => nearest(i, charges));
  const m = mean(nn);
  const cv = Math.sqrt(mean(nn.map((d) => (d - m) ** 2))) / m;
  // Au hasard, l'écart relatif des distances au plus proche voisin vaut ~0,5.
  assert.ok(cv < 0.2, `écart relatif ${cv.toFixed(2)}`);
  impurities.forEach((i, n) => {
    assert.deepEqual([x[i], y[i]], before[n], "impureté immobile");
    assert.ok(nearest(i, charges) > 1.5 * m, "trou autour de l'impureté");
  });
});

test("Mouvement brownien : les grains errent, le gaz reste agité", () => {
  const { sim, of, run } = start("mouvement-brownien.json");
  run(300);
  const grains = of("grain");
  const { x, y, vx, vy } = sim.state;
  const before = grains.map((i) => [x[i], y[i]]);
  run(1200); // 20 s à 60 pas par seconde
  const moved = grains.map((i, n) => Math.hypot(x[i] - before[n][0], y[i] - before[n][1]));
  assert.ok(Math.min(...moved) > 10, `déplacements ${moved.map(Math.round)}`);
  const gas = of("molécule");
  const speed = mean(gas.map((i) => Math.hypot(vx[i], vy[i])));
  // Agité sans s'emballer (friction juste sous 1).
  assert.ok(speed > 0.5 && speed < 2, `vitesse du gaz ${speed.toFixed(2)} px/pas`);
});

// LIFE-20 : « Système solaire ». Le préréglage est simulé image par image
// (frame(), comme dans la page), à plusieurs vitesses.
const solar = (speed = 1) => {
  const settings = JSON.parse(readFileSync("presets/systeme-solaire.json", "utf8")).settings;
  settings.speed = speed;
  const sim = createSimulation(settings, { width: W, height: H, random: seeded(42) });
  const index = (name) => {
    const t = settings.types.findIndex((type) => type.name === name);
    for (let i = 0; i < sim.count; i++) if (sim.typeIndex[i] === t) return i;
    throw new Error(name);
  };
  const names = settings.types.map((t) => t.name);
  const sun = index("Soleil");
  const rel = (i) => {
    const s = sim.state;
    return [s.x[i] - s.x[sun], s.y[i] - s.y[sun], s.z[i] - s.z[sun]];
  };
  return { settings, sim, index, names, sun, rel };
};

// Distance au Soleil de chaque planète, minimum et maximum, pendant `years`
// années simulées ; les planètes ne doivent ni tomber ni s'échapper.
const distances = ({ sim, names, index, rel }, years) => {
  const planets = names.slice(1).map((name) => ({ name, i: index(name), min: Infinity, max: 0 }));
  const until = years * 365.25;
  while (sim.time < until) {
    sim.frame();
    for (const p of planets) {
      const d = Math.hypot(...rel(p.i));
      p.min = Math.min(p.min, d);
      p.max = Math.max(p.max, d);
    }
  }
  return planets;
};

// Préréglage généré avec l'échelle par défaut : 1 UA = DEFAULT_AU unités.
const keepsOrbits = (planets) => {
  for (const p of planets) {
    const { elements } = SOLAR_SYSTEM.find((b) => b.name === p.name);
    const perihelion = elements.a * (1 - elements.e) * DEFAULT_AU;
    const aphelion = elements.a * (1 + elements.e) * DEFAULT_AU;
    // 3 % de marge : les autres planètes perturbent un peu les orbites.
    assert.ok(p.min > 0.97 * perihelion, `${p.name} : ${p.min.toFixed(1)} < périhélie ${perihelion.toFixed(1)}`);
    assert.ok(p.max < 1.03 * aphelion, `${p.name} : ${p.max.toFixed(1)} > aphélie ${aphelion.toFixed(1)}`);
  }
};

test("Système solaire : la Terre fait un tour en une année simulée (à 0,5 % près)", () => {
  const { sim, index, rel } = solar();
  const earth = index("Terre");
  const start = rel(earth);
  let previous = start;
  let angle = 0;
  let lap = null;
  while (lap === null && sim.time < 400) {
    const before = sim.time;
    sim.frame();
    const r = rel(earth);
    // Angle balayé dans le plan x, y (inclinaison de la Terre ≈ 0).
    const step = Math.atan2(
      previous[0] * r[1] - previous[1] * r[0],
      previous[0] * r[0] + previous[1] * r[1],
    );
    if (angle < 2 * Math.PI && angle + step >= 2 * Math.PI) {
      lap = before + ((sim.time - before) * (2 * Math.PI - angle)) / step;
    }
    angle += step;
    previous = r;
  }
  assert.ok(lap !== null, "aucun tour complet en 400 jours");
  assert.ok(Math.abs(lap / 365.25 - 1) < 0.005, `${lap.toFixed(1)} jours`);
});

test("Système solaire : aucune planète éjectée ni tombée sur dix années simulées", () => {
  const system = solar();
  keepsOrbits(distances(system, 10));
  // Les corps restent dans l'espace du préréglage (aucun rebond sur un bord).
  const { sim, settings } = system;
  for (let i = 0; i < sim.count; i++) {
    const s = sim.state;
    assert.ok(s.x[i] > 0 && s.x[i] < settings.width);
    assert.ok(s.y[i] > 0 && s.y[i] < settings.height);
    assert.ok(s.z[i] > 0 && s.z[i] < settings.depth);
  }
});

test("Système solaire : orbites gardées de 0,1× à 1000× (vitesse plafonnée)", () => {
  for (const [speed, years] of [[0.1, 0.5], [10, 5], [100, 20], [1000, 20]]) {
    const system = solar(speed);
    keepsOrbits(distances(system, years));
    // Le pas de temps ne dépasse jamais celui du préréglage.
    assert.ok(frameSteps(system.settings).dt <= system.settings.dt + 1e-12, `${speed}×`);
  }
});

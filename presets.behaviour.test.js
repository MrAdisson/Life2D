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

// LIFE-25 : « Mouvement brownien » active les collisions. Même graine, avec et
// sans : sans, les billes du gaz restent imbriquées les unes dans les autres ;
// avec, elles rebondissent et ne se chevauchent presque plus, et les grains
// suivent un autre chemin.
test("Mouvement brownien : avec les collisions, les billes ne s'imbriquent plus", () => {
  const run = (collisions) => {
    const settings = JSON.parse(readFileSync("presets/mouvement-brownien.json", "utf8")).settings;
    assert.equal(settings.collisions, true);
    settings.collisions = collisions;
    const sim = createSimulation(settings, { width: W, height: H, random: seeded(42) });
    for (let k = 0; k < 300; k++) sim.step();
    const { x, y, radius } = sim.state;
    let nested = 0;
    for (let i = 0; i < sim.count; i++) {
      for (let j = i + 1; j < sim.count; j++) {
        const r = 0.9 * (radius[i] + radius[j]);
        const dx = x[j] - x[i];
        const dy = y[j] - y[i];
        if (dx * dx + dy * dy < r * r) nested++;
      }
    }
    const grains = [...Array(sim.count).keys()].filter((i) => sim.typeIndex[i] === 1);
    return { nested, grains: grains.map((i) => [x[i], y[i]]) };
  };
  const on = run(true);
  const off = run(false);
  assert.ok(off.nested > 100, `sans collisions : ${off.nested} paires imbriquées`);
  assert.ok(on.nested * 5 < off.nested, `avec : ${on.nested}, sans : ${off.nested}`);
  const apart = on.grains.map(([x, y], n) => Math.hypot(x - off.grains[n][0], y - off.grains[n][1]));
  assert.ok(Math.max(...apart) > 5, `chemins des grains : écarts ${apart.map(Math.round)}`);
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

// --- LIFE-23 : préréglages aux nombres augmentés et nouveaux préréglages ---
// Même graine et mêmes dimensions que les vignettes ; chaque test vérifie que
// le phénomène décrit reste observable avec les nouveaux nombres.

// Distance entre deux particules, bords qui se rejoignent si `edges: "wrap"`.
const distance = (sim, settings) => {
  const { x, y, z } = sim.state;
  const wrap = settings.edges === "wrap";
  const d = (v, size) => (wrap ? wrapped(v, size) : v);
  return (i, j) =>
    Math.hypot(d(x[i] - x[j], sim.width), d(y[i] - y[j], sim.height), d(z[i] - z[j], sim.depth || 1));
};
const settingsOf = (file) => JSON.parse(readFileSync(`presets/${file}`, "utf8")).settings;

// Part des voisins (à moins de `radius`) de même type, sur un échantillon.
const sameTypeShare = (sim, settings, radius = 25) => {
  const dist = distance(sim, settings);
  let same = 0;
  let all = 0;
  const stride = Math.ceil(sim.count / 500);
  for (let i = 0; i < sim.count; i += stride) {
    for (let j = 0; j < sim.count; j++) {
      if (i === j || dist(i, j) >= radius) continue;
      all++;
      if (sim.typeIndex[i] === sim.typeIndex[j]) same++;
    }
  }
  return same / all;
};
const meanSpeed = (sim, ids) => {
  const { vx, vy, vz } = sim.state;
  return mean(ids.map((i) => Math.hypot(vx[i], vy[i], vz[i])));
};
// Part des particules `ids` à moins de `radius` d'une particule de `others`.
const shareNear = (sim, settings, ids, others, radius) => {
  const dist = distance(sim, settings);
  return ids.filter((i) => others.some((j) => j !== i && dist(i, j) < radius)).length / ids.length;
};
const sample = (ids, every = 5) => ids.filter((_, k) => k % every === 0);

for (const dimensions of [3, 2]) {
  test(`Amas gravitationnels (${dimensions}D) : la poussière s'agglomère autour des étoiles`, () => {
    const settings = { ...settingsOf("amas-gravitationnels.json"), dimensions };
    const sim = createSimulation(settings, { width: W, height: H, random: seeded(42) });
    const ids = (t) => [...Array(sim.count).keys()].filter((i) => sim.typeIndex[i] === t);
    const stars = ids(0);
    const dust = sample(ids(1));
    const before = shareNear(sim, settings, dust, stars, 40);
    for (let k = 0; k < 900; k++) sim.step();
    const after = shareNear(sim, settings, dust, stars, 40);
    assert.ok(after > before + 0.25, `poussière près d'une étoile : ${before.toFixed(2)} → ${after.toFixed(2)}`);
  });
}

test("Cellules et membranes : la membrane se range autour des noyaux", () => {
  const { sim, of, run } = start("cellules-membranes.json");
  const settings = settingsOf("cellules-membranes.json");
  const membrane = sample(of("membrane"));
  const before = shareNear(sim, settings, membrane, of("noyau"), 40);
  run(600);
  const after = shareNear(sim, settings, membrane, of("noyau"), 40);
  assert.ok(after > 0.8 && after > before + 0.2, `${before.toFixed(2)} → ${after.toFixed(2)}`);
});

test("Chasseurs et proies : la poursuite ne s'arrête pas, les proies restent en bancs", () => {
  const { sim, of, run } = start("chasseurs-proies.json");
  run(900);
  assert.ok(meanSpeed(sim, of("chasseur")) > 0.4, "chasseurs en mouvement");
  assert.ok(meanSpeed(sim, of("proie")) > 0.15, "proies en fuite");
  assert.ok(sameTypeShare(sim, settingsOf("chasseurs-proies.json")) > 0.9, "bancs de proies");
});

test("Cristallisation : chaque ion a pour plus proche voisin un ion de couleur opposée", () => {
  const { sim, run } = start("cristallisation.json");
  const { x, y } = sim.state;
  const opposite = () => {
    let n = 0;
    let all = 0;
    for (let i = 0; i < sim.count; i += 7) {
      let best = Infinity;
      let nearest = -1;
      for (let j = 0; j < sim.count; j++) {
        const d = j === i ? Infinity : Math.hypot(x[i] - x[j], y[i] - y[j]);
        if (d < best) [best, nearest] = [d, j];
      }
      all++;
      if (sim.typeIndex[nearest] !== sim.typeIndex[i]) n++;
    }
    return n / all;
  };
  assert.ok(opposite() < 0.65, "mélange au hasard au départ");
  run(300);
  assert.ok(opposite() > 0.95, "réseau alterné");
});

test("Feu d'artifice : sans frein, les gerbes restent mêlées et en mouvement", () => {
  const { sim, run } = start("feu-d-artifice.json");
  run(900);
  const all = [...Array(sim.count).keys()];
  assert.ok(meanSpeed(sim, all) > 0.4, "toujours en mouvement");
  const share = sameTypeShare(sim, settingsOf("feu-d-artifice.json"));
  assert.ok(share < 0.45, `couleurs mêlées (${share.toFixed(2)})`);
});

test("Huile et eau : les deux liquides se démêlent en plaques", () => {
  const { sim, run } = start("huile-et-eau.json");
  const settings = settingsOf("huile-et-eau.json");
  assert.ok(sameTypeShare(sim, settings) < 0.6, "mélangés au départ");
  run(600);
  assert.ok(sameTypeShare(sim, settings) > 0.95, "démêlés");
});

test("Lucioles : le nuage s'accroche aux lanternes", () => {
  const { sim, of, run } = start("lucioles.json");
  const settings = settingsOf("lucioles.json");
  const flies = sample(of("luciole"));
  const before = shareNear(sim, settings, flies, of("lanterne"), 80);
  run(1200);
  const after = shareNear(sim, settings, flies, of("lanterne"), 80);
  assert.ok(after > 0.75 && after > before + 0.4, `${before.toFixed(2)} → ${after.toFixed(2)}`);
});

test("Nébuleuse : des volutes en mouvement qui se figent peu à peu", () => {
  const { sim, run } = start("nebuleuse.json");
  const all = [...Array(sim.count).keys()];
  run(600);
  assert.ok(meanSpeed(sim, all) > 0.2, "volutes en mouvement");
  run(1800);
  assert.ok(meanSpeed(sim, all) < 0.05, "figées");
});

test("Orbites : les grains tournent sans se poser sur les astres", () => {
  const { sim, of, run } = start("orbites.json");
  const settings = settingsOf("orbites.json");
  run(900);
  const grains = sample(of("grain"));
  assert.ok(meanSpeed(sim, grains) > 1, "grains en mouvement");
  assert.ok(shareNear(sim, settings, grains, of("astre"), 40) < 0.2, "grains pas posés");
});

test("Trois tribus : des taches colorées qui se poursuivent sans fin", () => {
  const { sim, run } = start("trois-tribus.json");
  const settings = settingsOf("trois-tribus.json");
  assert.ok(sameTypeShare(sim, settings) < 0.4, "mélange au départ");
  run(900);
  assert.ok(sameTypeShare(sim, settings) > 0.65, "taches de même couleur");
  assert.ok(meanSpeed(sim, [...Array(sim.count).keys()]) > 0.5, "poursuite");
});

test("Ronde des cinq tribus (3D) : 10 000 particules en essaims qui se poursuivent", () => {
  const { sim, run } = start("ronde-des-cinq-tribus.json");
  const settings = settingsOf("ronde-des-cinq-tribus.json");
  assert.equal(settings.dimensions, 3);
  assert.equal(sim.count, 10000);
  assert.ok(sameTypeShare(sim, settings, 30) < 0.3, "mélange au départ");
  run(1200);
  assert.ok(sameTypeShare(sim, settings, 30) > 0.45, "essaims de même couleur");
  assert.ok(meanSpeed(sim, [...Array(sim.count).keys()]) > 0.5, "ronde en mouvement");
});

test("Gouttes en apesanteur (3D) : chaque liquide se rassemble en gouttes", () => {
  const { sim, run } = start("gouttes-en-apesanteur.json");
  const settings = settingsOf("gouttes-en-apesanteur.json");
  assert.equal(settings.dimensions, 3);
  assert.equal(settings.gravity ?? 0, 0);
  assert.ok(sameTypeShare(sim, settings, 30) < 0.45, "mélange au départ");
  run(1200);
  assert.ok(sameTypeShare(sim, settings, 30) > 0.85, "gouttes séparées");
});

test("Collision de galaxies (3D) : bras de marée au passage, cœurs liés ensuite", () => {
  const { sim, of } = start("collision-de-galaxies.json");
  const { x, y, z } = sim.state;
  const [a, b] = of("cœur");
  const stars = [...of("galaxie bleue"), ...of("galaxie dorée")];
  assert.equal(sim.count, 200);
  const d = (i, j) => Math.hypot(x[i] - x[j], y[i] - y[j], z[i] - z[j]);
  // Étoiles à plus de 300 unités des deux cœurs (disques de 140 au départ).
  const torn = () => stars.filter((i) => Math.min(d(i, a), d(i, b)) > 300).length;
  assert.equal(torn(), 0, "disques intacts au départ");
  const start0 = d(a, b);
  let closest = Infinity;
  let farthest = 0;
  for (let k = 0; k < 600; k++) {
    sim.frame();
    closest = Math.min(closest, d(a, b));
  }
  assert.ok(closest < start0 / 2, `les galaxies se frôlent (${closest.toFixed(0)})`);
  assert.ok(torn() > 40, `étoiles arrachées : ${torn()}`);
  for (let k = 0; k < 2400; k++) {
    sim.frame();
    farthest = Math.max(farthest, d(a, b));
  }
  assert.ok(farthest < 1000, `cœurs liés (au plus ${farthest.toFixed(0)})`);
});

test("Page blanche : aucune règle, rien ne bouge", () => {
  const { sim, run } = start("page-blanche.json");
  const x0 = Float64Array.from(sim.state.x.subarray(0, sim.count));
  run(300);
  assert.deepEqual(Float64Array.from(sim.state.x.subarray(0, sim.count)), x0);
});

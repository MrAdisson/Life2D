// Tests LIFE-4 : portée d'interaction, grille spatiale, état en Float64Array.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createSimulation } from "./engine.js";
import { defaultSettings, referenceSettings } from "./settings.js";
import { createSimulation as createLegacySimulation } from "./fixtures/legacy-engine.js";

const seeded = (seed) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

// Positions par indice de création (type par type, dans l'ordre du réglage).
const positions = (sim, settings) =>
  settings.types.flatMap((t) => sim.groups.get(t.name).map((p) => [p.x, p.y]));

const run = (create, settings, { steps, width = 1000, height = 1000, seed = 1 }) => {
  const sim = create(settings, { width, height, random: seeded(seed) });
  for (let k = 0; k < steps; k++) sim.step();
  return positions(sim, settings);
};

// Calcul de référence en O(n²) limité à la portée : la version précédente du
// moteur (même ordre de calcul), avec le test de portée en plus.
const createReferenceSimulation = (settings, options) => {
  const { epsilon, friction, types, rules = {}, range = Infinity } = settings;
  const { width, height } = options;
  const sim = createLegacySimulation(settings, options);
  const applyRule = (group, otherGroup, g) => {
    for (const particle of group) {
      for (const other of otherGroup) {
        if (particle === other) continue;
        const dx = particle.x - other.x;
        const dy = particle.y - other.y;
        if (dx * dx + dy * dy > range * range) continue;
        const distance = Math.sqrt(dx * dx + dy * dy) + epsilon;
        const force = (g * particle.mass * other.mass) / distance ** 2;
        particle.ax += (force * dx) / distance / particle.mass;
        particle.ay += (force * dy) / distance / particle.mass;
      }
    }
  };
  sim.step = () => {
    for (const type of types) {
      for (const other of types) {
        const g = rules[type.name]?.[other.name] ?? 0;
        if (g === 0) continue;
        applyRule(sim.groups.get(type.name), sim.groups.get(other.name), g);
      }
    }
    for (const p of sim.particles) p.update({ width, height, friction });
  };
  return sim;
};

const twoTypes = (range) => ({
  epsilon: 10,
  friction: 1,
  range,
  types: [
    { name: "a", color: "red", count: 1, mass: 2 },
    { name: "b", color: "blue", count: 1, mass: 2 },
  ],
  rules: { a: { b: 1 }, b: { a: 1 } },
});

const pairAt = (range, distance) => {
  const coords = [500, 500, 500 + distance, 500].map((v) => v / 1000);
  let i = 0;
  const sim = createSimulation(twoTypes(range), {
    width: 1000,
    height: 1000,
    random: () => coords[i++],
  });
  return { sim, pa: sim.groups.get("a")[0], pb: sim.groups.get("b")[0] };
};

test("portée : au-delà, deux particules n'exercent aucune force", () => {
  const { sim, pa, pb } = pairAt(100, 150);
  for (let k = 0; k < 10; k++) sim.step();
  assert.deepEqual([pa.x, pa.y, pb.x, pb.y], [500, 500, 650, 500]);
  assert.deepEqual([pa.vx, pa.vy, pb.vx, pb.vy], [0, 0, 0, 0]);
});

test("portée : en deçà, la force s'applique", () => {
  const { sim, pa, pb } = pairAt(100, 90);
  sim.step();
  assert.ok(pa.x < 500 && pb.x > 590);
});

test("portée : par défaut, le réglage historique a une portée illimitée", () => {
  assert.equal(defaultSettings.range, Infinity);
  const { sim, pa } = pairAt(undefined, 900);
  sim.step();
  assert.ok(pa.x < 500);
});

test("état des particules stocké en Float64Array", () => {
  const sim = createSimulation(defaultSettings, { width: 100, height: 100 });
  for (const field of ["x", "y", "vx", "vy", "ax", "ay", "mass", "radius"]) {
    assert.ok(sim.state[field] instanceof Float64Array, field);
    assert.equal(sim.state[field].length, 1585);
  }
  // Les particules sont des vues sur ces tableaux.
  const p = sim.groups.get("red")[0];
  p.vx = 3;
  assert.equal(sim.state.vx[p.index], 3);
});

test("déterminisme : même graine et même réglage, mêmes positions après N pas", () => {
  const options = { steps: 5, width: 1920, height: 1080, seed: 7 };
  const a = run(createSimulation, referenceSettings, options);
  const b = run(createSimulation, referenceSettings, options);
  assert.equal(a.length, 20000);
  assert.deepEqual(a, b);
});

test("grille identique au calcul de référence en O(n²) limité à la portée", () => {
  const settings = {
    ...defaultSettings,
    range: 60,
    types: defaultSettings.types.map((t) => ({ ...t, count: Math.ceil(t.count / 3) })),
  };
  for (const seed of [1, 42]) {
    const options = { steps: 40, width: 800, height: 600, seed };
    const grid = run(createSimulation, settings, options);
    const reference = run(createReferenceSimulation, settings, options);
    assert.deepEqual(grid, reference);
  }
});

test("grille identique à la référence même avec des particules hors du cadre", () => {
  const settings = {
    ...twoTypes(50),
    types: [
      { name: "a", color: "red", count: 40, mass: 0 },
      { name: "b", color: "blue", count: 40, mass: 3 },
    ],
    rules: { a: { a: -30, b: 5 }, b: { a: -8, b: 2 } },
  };
  const options = { steps: 200, width: 120, height: 90, seed: 3 };
  const grid = run(createSimulation, settings, options);
  const reference = run(createReferenceSimulation, settings, options);
  assert.ok(grid.flat().some((v) => v < 0 || v > 120));
  assert.deepEqual(grid, reference);
});

test("toutes les paires dans la portée : mêmes positions que la version précédente", () => {
  const options = { steps: 20, width: 1000, height: 1000, seed: 1 };
  const legacy = run(createLegacySimulation, defaultSettings, options);
  // Portée illimitée (réglage historique).
  assert.deepEqual(run(createSimulation, defaultSettings, options), legacy);
  // Portée finie (grille de 2 × 2 cases) mais supérieure, à chaque pas, à la
  // plus grande distance entre deux particules.
  const wide = { ...defaultSettings, range: 1500 };
  const sim = createSimulation(wide, { ...options, random: seeded(1) });
  for (let k = 0; k < options.steps; k++) {
    const { x, y } = sim.state;
    const w = Math.max(...x) - Math.min(...x);
    const h = Math.max(...y) - Math.min(...y);
    assert.ok(Math.hypot(w, h) < wide.range);
    sim.step();
  }
  assert.deepEqual(positions(sim, wide), legacy);
});

test("positions écrites dans l'ordre d'affichage (masse décroissante)", () => {
  const sim = createSimulation(defaultSettings, { width: 100, height: 100 });
  const out = sim.writePositions();
  assert.equal(out.length, 1585 * 2);
  sim.particles.forEach((p, k) => {
    assert.equal(out[2 * k], Math.fround(p.x));
    assert.equal(out[2 * k + 1], Math.fround(p.y));
    if (k) assert.ok(sim.particles[k - 1].mass >= p.mass);
  });
});

test("engine.js ne dépend pas du navigateur", () => {
  const source = readFileSync(new URL("./engine.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Worker|document|window|webgl|canvas|self\./i);
});

test("le thread principal n'appelle pas le moteur", () => {
  for (const file of ["main.js", "renderer.js"]) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /engine\.js|createSimulation|\.step\(/, file);
  }
});

test("le réglage de référence compte 20 000 particules et une portée finie", () => {
  const total = referenceSettings.types.reduce((n, t) => n + t.count, 0);
  assert.equal(total, 20000);
  assert.ok(Number.isFinite(referenceSettings.range));
  assert.equal(referenceSettings.epsilon, defaultSettings.epsilon);
  assert.equal(referenceSettings.friction, defaultSettings.friction);
  assert.deepEqual(referenceSettings.rules, defaultSettings.rules);
});

// Garde-fou de performance : un pas du moteur à 10 000 particules, portée
// finie, doit tenir dans le budget ; en mode gravité, un pas à 200 corps, et
// une image de 10 sous-pas à 200 corps dans le budget d'un pas à portée finie.
// Fait partie de `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "./engine.js";
import { startSettings } from "./settings.js";

// Budget d'un pas, en millisecondes.
export const STEP_BUDGET_MS = 50;
const PARTICLES = 10000;

test(`un pas à ${PARTICLES} particules (portée finie) tient en moins de ${STEP_BUDGET_MS} ms`, () => {
  // Réglage de départ (portée de 60 px) à 10 000 particules, mêmes proportions.
  const total = startSettings.types.reduce((n, t) => n + t.count, 0);
  const settings = structuredClone(startSettings);
  settings.types = settings.types.map((t) => ({
    ...t,
    count: Math.round((t.count * PARTICLES) / total),
  }));
  settings.types[1].count += PARTICLES - settings.types.reduce((n, t) => n + t.count, 0);
  assert.equal(settings.types.reduce((n, t) => n + t.count, 0), PARTICLES);
  assert.ok(Number.isFinite(settings.range));

  let seed = 1;
  const sim = createSimulation(settings, {
    width: 1920,
    height: 1080,
    random: () => (seed = (seed * 16807) % 2147483647) / 2147483647,
  });
  // Échauffement (compilation du code par le moteur JavaScript).
  for (let k = 0; k < 3; k++) sim.step();
  // Médiane de plusieurs pas : insensible à une pause ponctuelle du système.
  const times = [];
  for (let k = 0; k < 7; k++) {
    const t0 = performance.now();
    sim.step();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  assert.ok(
    median < STEP_BUDGET_MS,
    `pas médian ${median.toFixed(1)} ms > budget ${STEP_BUDGET_MS} ms`,
  );
});

// Mode gravitation universelle : calcul direct sur toutes les paires, prévu
// pour un petit nombre de corps. Budget : un pas à 200 corps en 3D.
export const GRAVITY_STEP_BUDGET_MS = 5;
const BODIES = 200;

test(`gravité : un pas à ${BODIES} corps (toutes les paires) tient en moins de ${GRAVITY_STEP_BUDGET_MS} ms`, () => {
  let seed = 3;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const settings = {
    interaction: "gravity",
    G: 1,
    epsilon: 1,
    friction: 1,
    dimensions: 3,
    types: [
      { name: "soleil", color: "yellow", count: 1, mass: 1000 },
      { name: "corps", color: "white", count: BODIES - 1, mass: 1 },
    ],
  };
  const sim = createSimulation(settings, { width: 1920, height: 1080, depth: 1000, random });
  assert.equal(sim.count, BODIES);
  for (let k = 0; k < 20; k++) sim.step();
  const times = [];
  for (let k = 0; k < 21; k++) {
    const t0 = performance.now();
    sim.step();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  assert.ok(
    median < GRAVITY_STEP_BUDGET_MS,
    `pas médian ${median.toFixed(3)} ms > budget ${GRAVITY_STEP_BUDGET_MS} ms`,
  );
});

// Pas d'image en mode gravité : `substeps` pas de dt (vitesse-Verlet, une
// évaluation des forces par pas). Budget : celui d'un pas à portée finie.

const SUBSTEPS = 10;

test(`gravité : une image à ${BODIES} corps et ${SUBSTEPS} sous-pas tient en moins de ${STEP_BUDGET_MS} ms`, () => {
  let seed = 5;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const settings = {
    interaction: "gravity",
    G: 1,
    epsilon: 1,
    friction: 1,
    dimensions: 3,
    dt: 0.1,
    substeps: SUBSTEPS,
    types: [
      { name: "soleil", color: "yellow", count: 1, mass: 1000 },
      { name: "corps", color: "white", count: BODIES - 1, mass: 1 },
    ],
  };
  const sim = createSimulation(settings, { width: 1920, height: 1080, depth: 1000, random });
  for (let k = 0; k < 5; k++) sim.frame();
  const times = [];
  for (let k = 0; k < 11; k++) {
    const t0 = performance.now();
    sim.frame();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  assert.ok(median < STEP_BUDGET_MS, `image médiane ${median.toFixed(2)} ms > budget ${STEP_BUDGET_MS} ms`);
});

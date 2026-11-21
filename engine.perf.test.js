// Garde-fou de performance : un pas du moteur à 10 000 particules, portée
// finie, doit tenir dans le budget. Fait partie de `npm test`.
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

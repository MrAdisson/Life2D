import { test } from "node:test";
import assert from "node:assert/strict";
import { countParticles, createStatsMeter, formatStats } from "./stats.js";
import { defaultSettings, referenceSettings } from "./settings.js";

test("compteur : nombre de particules = somme des count du réglage", () => {
  assert.equal(countParticles(referenceSettings), 20000);
  assert.equal(countParticles(defaultSettings), 1585);
});

test("compteur : images et pas par seconde, mis à jour toutes les 500 ms", () => {
  const meter = createStatsMeter();
  assert.equal(meter.frame(0, 0), null);
  let result = null;
  let t = 0;
  for (let k = 1; k <= 30; k++) {
    t = k * (1000 / 60);
    result = meter.frame(t, k) ?? result;
    if (k < 30) assert.equal(result, null);
  }
  assert.ok(Math.abs(result.fps - 60) < 1e-9);
  assert.ok(Math.abs(result.stepsPerSecond - 60) < 1e-9);
  // Intervalle suivant : 30 images à 30 images/s, 15 pas.
  for (let k = 1; k <= 15; k++) result = meter.frame(t + k * (1000 / 30), 30 + k);
  assert.ok(Math.abs(result.fps - 30) < 1e-9);
  assert.ok(Math.abs(result.stepsPerSecond - 30) < 1e-9);
});

test("compteur : texte affiché", () => {
  const text = formatStats({ fps: 59.6, stepsPerSecond: 58.2, particles: 20000 });
  assert.match(text, /^60 images\/s · 20\s000 particules · 58 pas\/s$/);
});

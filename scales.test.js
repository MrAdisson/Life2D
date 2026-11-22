import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RANGE_MAX,
  RANGE_MIN,
  SLIDER_STEPS,
  frictionFromSlider,
  rangeFromSlider,
  sliderFromFriction,
  sliderFromRange,
} from "./scales.js";

const positions = Array.from({ length: SLIDER_STEPS + 1 }, (_, k) => k);

test("curseur de friction : 0 et 1 aux bouts, 0,5 au milieu, croissant", () => {
  assert.equal(frictionFromSlider(0), 0);
  assert.equal(frictionFromSlider(SLIDER_STEPS), 1);
  assert.equal(frictionFromSlider(SLIDER_STEPS / 2), 0.5);
  const values = positions.map(frictionFromSlider);
  for (let k = 1; k < values.length; k++) assert.ok(values[k] >= values[k - 1]);
  for (const v of values) assert.ok(v >= 0 && v <= 1);
});

test("curseur de friction : plus précis près de 1 et près de 0 qu'au milieu", () => {
  const stepAt = (k) => frictionFromSlider(k + 1) - frictionFromSlider(k);
  const middle = stepAt(SLIDER_STEPS / 2);
  assert.ok(stepAt(SLIDER_STEPS - 5) < middle / 50);
  assert.ok(stepAt(5) < middle / 50);
  // Entre 0,99 et 1, le curseur offre des dizaines de positions distinctes,
  // dont 0,9995.
  const near1 = new Set(positions.map(frictionFromSlider).filter((v) => v > 0.99 && v < 1));
  assert.ok(near1.size > 100);
  assert.ok(near1.has(0.9995));
  // Valeurs arrondies, affichables telles quelles (9 décimales au plus).
  for (const v of positions.map(frictionFromSlider)) {
    assert.equal(v, Number(v.toFixed(9)));
  }
});

test("curseur de friction : aller-retour cohérent", () => {
  for (const k of positions) {
    // À une position près (valeurs arrondies à 2 chiffres significatifs).
    const back = sliderFromFriction(frictionFromSlider(k));
    assert.ok(Math.abs(back - k) <= 1, `position ${k} -> ${back}`);
  }
  assert.equal(sliderFromFriction(1), SLIDER_STEPS);
  assert.equal(sliderFromFriction(0), 0);
  assert.equal(sliderFromFriction(7), SLIDER_STEPS); // hors plage : en butée
});

test("curseur de portée : logarithmique, illimitée en butée", () => {
  assert.equal(rangeFromSlider(0), RANGE_MIN);
  assert.equal(rangeFromSlider(SLIDER_STEPS), RANGE_MAX);
  assert.equal(sliderFromRange(Infinity), SLIDER_STEPS);
  // Plus fin pour les petites portées.
  const at = (k) => rangeFromSlider(k + 10) - rangeFromSlider(k);
  assert.ok(at(100) < at(900));
  const k = sliderFromRange(60);
  assert.ok(Math.abs(rangeFromSlider(k) - 60) <= 2);
});

import { SPEED_MAX, SPEED_MIN, sliderFromSpeed, speedFromSlider } from "./scales.js";

test("curseur de vitesse : 0,1× à 1000×, logarithmique, croissant", () => {
  assert.equal(speedFromSlider(0), SPEED_MIN);
  assert.equal(speedFromSlider(SLIDER_STEPS), SPEED_MAX);
  assert.equal(speedFromSlider(SLIDER_STEPS / 4), 1);
  assert.equal(speedFromSlider(SLIDER_STEPS / 2), 10);
  const values = positions.map(speedFromSlider);
  for (let k = 1; k < values.length; k++) assert.ok(values[k] >= values[k - 1]);
  assert.equal(speedFromSlider(-5), SPEED_MIN);
  assert.equal(speedFromSlider(SLIDER_STEPS * 2), SPEED_MAX);
});

test("curseur de vitesse : position réciproque, bornée", () => {
  assert.equal(sliderFromSpeed(1), SLIDER_STEPS / 4);
  assert.equal(sliderFromSpeed(0.001), 0);
  assert.equal(sliderFromSpeed(1e6), SLIDER_STEPS);
  for (const k of [0, 100, 250, 500, 777, 1000]) {
    assert.ok(Math.abs(sliderFromSpeed(speedFromSlider(k)) - k) <= 3);
  }
});

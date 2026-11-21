import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultSettings } from "./settings.js";
import {
  WARN_PARTICLES,
  addType,
  getRule,
  hasRandomMass,
  needsRangeWarning,
  removeType,
  setCount,
  setEpsilon,
  setFriction,
  setGravity,
  setMass,
  setRange,
  setRule,
  totalParticles,
} from "./settings-edit.js";

const fresh = () => structuredClone(defaultSettings);

test("setRule accepte toute valeur finie, y compris hors de −1…1", () => {
  const s = fresh();
  setRule(s, "red", "blue", 0.5);
  assert.equal(s.rules.red.blue, 0.5);
  setRule(s, "red", "blue", 2);
  assert.equal(s.rules.red.blue, 2);
  setRule(s, "red", "blue", "-5");
  assert.equal(s.rules.red.blue, -5);
  setRule(s, "red", "blue", "");
  assert.equal(s.rules.red.blue, 0);
  setRule(s, "red", "blue", "abc");
  assert.equal(s.rules.red.blue, 0);
  assert.equal(getRule(s, "blue", "nope"), 0);
});

test("setCount, setRange, setFriction", () => {
  const s = fresh();
  setCount(s, "red", "12.7");
  assert.equal(s.types[0].count, 12);
  setCount(s, "red", -3);
  assert.equal(s.types[0].count, 0);
  setRange(s, "40");
  assert.equal(s.range, 40);
  setRange(s, "");
  assert.equal(s.range, Infinity);
  setFriction(s, 5);
  assert.equal(s.friction, 1);
  setFriction(s, 0);
  assert.equal(s.friction, 0);
});

test("ajouter un type : règles à 0, nom unique", () => {
  const s = fresh();
  assert.deepEqual(
    addType(s, { name: "gold", color: "gold", count: 10, mass: 3 }),
    { ok: true },
  );
  assert.equal(s.types.length, 5);
  for (const t of s.types) {
    assert.equal(s.rules.gold[t.name], 0);
    assert.equal(s.rules[t.name].gold, 0);
  }
  assert.equal(s.rules.red.blue, 1); // règles existantes inchangées
  assert.equal(addType(s, { name: "gold", color: "x", count: 1, mass: 1 }).ok, false);
  assert.equal(addType(s, { name: " ", color: "x", count: 1, mass: 1 }).ok, false);
  assert.equal(addType(s, { name: "z", color: "x", count: 1, mass: 0 }).ok, false);
  assert.equal(s.types.length, 5);
});

test("retirer un type supprime ses règles et celles qui le citent", () => {
  const s = fresh();
  removeType(s, "blue");
  assert.deepEqual(s.types.map((t) => t.name), ["red", "green", "white"]);
  assert.equal("blue" in s.rules, false);
  for (const row of Object.values(s.rules)) assert.equal("blue" in row, false);
  assert.equal(s.rules.red.green, -1);
});

test("setFriction : 4 décimales et plus, bornée de 0 à 1, non numérique ignorée", () => {
  const s = fresh();
  assert.equal(setFriction(s, "0.9995"), 0.9995);
  assert.equal(s.friction, 0.9995);
  setFriction(s, "0,99995");
  assert.equal(s.friction, 0.99995);
  setFriction(s, -2);
  assert.equal(s.friction, 0);
  setFriction(s, 0.5);
  for (const bad of ["", "abc", NaN, null, undefined, Infinity]) {
    setFriction(s, bad);
    assert.equal(s.friction, 0.5, String(bad));
  }
});

test("setMass : nombre > 0, sinon refusé avec un message et masse conservée", () => {
  const s = fresh();
  assert.deepEqual(setMass(s, "red", "7.5"), { ok: true });
  assert.equal(s.types[0].mass, 7.5);
  for (const bad of ["", "0", 0, -1, "abc", Infinity]) {
    const result = setMass(s, "red", bad);
    assert.equal(result.ok, false, String(bad));
    assert.match(result.error, /masse/i);
    assert.equal(s.types[0].mass, 7.5);
  }
  assert.equal(setMass(s, "nope", 3).ok, false);
});

test("masse aléatoire : absente ou 0", () => {
  assert.equal(hasRandomMass({ mass: 0 }), true);
  assert.equal(hasRandomMass({}), true);
  assert.equal(hasRandomMass({ mass: 2 }), false);
  const s = fresh();
  s.types[0].mass = 0;
  setMass(s, "red", 3);
  assert.equal(hasRandomMass(s.types[0]), false);
});

test("setEpsilon : nombre > 0 ; setGravity : tout nombre fini", () => {
  const s = fresh();
  assert.deepEqual(setEpsilon(s, "2.5"), { ok: true });
  assert.equal(s.epsilon, 2.5);
  for (const bad of ["", "0", -1, "x"]) {
    assert.equal(setEpsilon(s, bad).ok, false);
    assert.equal(s.epsilon, 2.5);
  }
  assert.deepEqual(setGravity(s, "-0.05"), { ok: true });
  assert.equal(s.gravity, -0.05);
  assert.equal(setGravity(s, "x").ok, false);
  assert.equal(setGravity(s, "").ok, false);
  assert.equal(s.gravity, -0.05);
});

test("avertissement : portée illimitée et au moins 5 000 particules", () => {
  assert.equal(WARN_PARTICLES, 5000);
  const s = fresh(); // 1 585 particules, portée illimitée
  assert.equal(needsRangeWarning(s), false);
  setCount(s, "blue", 5000 - 85);
  assert.equal(totalParticles(s), 5000);
  assert.equal(needsRangeWarning(s), true);
  setRange(s, "60");
  assert.equal(needsRangeWarning(s), false);
  setRange(s, "");
  assert.equal(needsRangeWarning(s), true);
  setCount(s, "blue", 5000 - 86);
  assert.equal(needsRangeWarning(s), false);
  delete s.range; // absente = illimitée
  setCount(s, "blue", 10000);
  assert.equal(needsRangeWarning(s), true);
});

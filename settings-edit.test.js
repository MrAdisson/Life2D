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
  setCollisions,
  setCount,
  setDimensions,
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

test("setDimensions : 3 ou 2, toute autre valeur donne 2", () => {
  const s = fresh();
  setDimensions(s, 3);
  assert.equal(s.dimensions, 3);
  setDimensions(s, "3");
  assert.equal(s.dimensions, 3);
  setDimensions(s, 2);
  assert.equal(s.dimensions, 2);
  setDimensions(s, 7);
  assert.equal(s.dimensions, 2);
});

test("setCollisions : true active, toute autre valeur écrit false (envoyé au Worker)", () => {
  const s = fresh();
  assert.equal(s.collisions, undefined);
  setCollisions(s, true);
  assert.equal(s.collisions, true);
  setCollisions(s, false);
  assert.equal(s.collisions, false);
  setCollisions(s, "oui");
  assert.equal(s.collisions, false);
});

// Polish LIFE-20 : masse des corps placés et taille de l'espace.
import {
  typeMass,
  setWorldSize,
  fitWorldToWindow,
  MIN_WORLD_SIZE,
  MAX_WORLD_SIZE,
} from "./settings-edit.js";
import { readFileSync } from "node:fs";
import { createSimulation } from "./engine.js";

test("masse affichée : corps placés (préréglage), masse du type ou aléatoire", () => {
  const solar = JSON.parse(readFileSync("presets/systeme-solaire.json", "utf8")).settings;
  for (const type of solar.types) {
    const m = typeMass(type);
    assert.equal(m.kind, "bodies", type.name);
    assert.equal(m.value, type.bodies[0].mass, type.name);
    assert.equal(hasRandomMass(type), false, type.name);
  }
  const mixed = { name: "a", count: 2, bodies: [{ mass: 1 }, { mass: 2 }] };
  assert.deepEqual(typeMass(mixed), { kind: "mixed", value: null });
  // Des particules tirées en plus des corps : la masse du type compte.
  assert.deepEqual(typeMass({ count: 3, mass: 4, bodies: [{ mass: 1 }] }), { kind: "fixed", value: 4 });
  assert.deepEqual(typeMass({ count: 3, bodies: [{ mass: 1 }] }), { kind: "random", value: null });
  assert.deepEqual(typeMass({ count: 5 }), { kind: "random", value: null });
});

test("changer la masse d'un corps placé l'applique au moteur, sans le déplacer", () => {
  const settings = {
    interaction: "gravity", epsilon: 1, friction: 1, dimensions: 3, depth: 100,
    types: [{ name: "a", color: "red", count: 1,
      bodies: [{ name: "X", position: [10, 20, 30], velocity: [0, 0, 0], mass: 2, radius: 5 }] }],
  };
  const sim = createSimulation(settings, { width: 100, height: 100, random: () => 0.5 });
  assert.equal(sim.state.mass[0], 2);
  assert.equal(setMass(settings, "a", "7").ok, true);
  assert.equal(typeMass(settings.types[0]).value, 7);
  assert.equal(sim.sync(), true);
  assert.equal(sim.state.mass[0], 7);
  assert.equal(sim.state.radius[0], 5); // rayon d'affichage gardé
  assert.deepEqual([sim.state.x[0], sim.state.y[0], sim.state.z[0]], [10, 20, 30]);
  sim.reseed(); // le nouveau tirage garde la nouvelle masse
  assert.equal(sim.state.mass[0], 7);
});

test("taille de l'espace : bornes, valeurs refusées, retour à la fenêtre", () => {
  const s = fresh();
  assert.equal(setWorldSize(s, "width", "800").ok, true);
  assert.equal(setWorldSize(s, "height", 600).ok, true);
  assert.equal(setWorldSize(s, "depth", "250,5").ok, true);
  assert.deepEqual([s.width, s.height, s.depth], [800, 600, 250.5]);
  for (const bad of [MIN_WORLD_SIZE - 1, MAX_WORLD_SIZE + 1, "abc", "", Infinity]) {
    const r = setWorldSize(s, "width", bad);
    assert.equal(r.ok, false, String(bad));
    assert.match(r.error, /largeur/i);
  }
  assert.equal(s.width, 800);
  assert.equal(setWorldSize(s, "longueur", 100).ok, false);
  fitWorldToWindow(s);
  assert.equal("width" in s || "height" in s || "depth" in s, false);
});

test("taille changée en direct : boîte relue, particules ramenées dedans", () => {
  for (const edges of ["bounce", "wrap"]) {
    const s = { ...fresh(), edges, dimensions: 3 };
    let seed = 3;
    const sim = createSimulation(s, {
      width: 800, height: 600,
      random: () => (seed = (seed * 16807) % 2147483647) / 2147483647,
    });
    assert.equal(sim.refreshSize(), false);
    setWorldSize(s, "width", 200);
    setWorldSize(s, "height", 100);
    setWorldSize(s, "depth", 50);
    assert.equal(sim.refreshSize(), true);
    assert.deepEqual([sim.width, sim.height, sim.depth], [200, 100, 50]);
    const { x, y, z } = sim.state;
    for (let i = 0; i < sim.count; i++) {
      assert.ok(x[i] >= 0 && x[i] <= 200 && y[i] >= 0 && y[i] <= 100 && z[i] >= 0 && z[i] <= 50, edges);
    }
    fitWorldToWindow(s);
    assert.equal(sim.refreshSize(), true);
    assert.deepEqual([sim.width, sim.height, sim.depth], [800, 600, 600]);
  }
});

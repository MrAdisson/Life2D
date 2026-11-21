// Chaque paramètre du réglage, modifié en cours de simulation, change le
// comportement dès le pas suivant, sans nouvelle initialisation (les
// particules déjà présentes gardent positions et vitesses).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "./engine.js";
import { startSettings } from "./settings.js";
import {
  addType,
  removeType,
  setCount,
  setEdges,
  setEpsilon,
  setFriction,
  setGravity,
  setMass,
  setRange,
  setRule,
} from "./settings-edit.js";

const size = { width: 400, height: 300 };

const seeded = (seed = 1) => () =>
  (seed = (seed * 16807) % 2147483647) / 2147483647;

// Réglage de départ, en plus petit (calcul rapide), avec de la friction.
const base = () => {
  const s = structuredClone(startSettings);
  s.friction = 0.9;
  s.types = s.types.map((t) => ({ ...t, count: Math.ceil(t.count / 4) }));
  return s;
};

// État d'un groupe : [x, y, vx, vy] de chaque particule.
const snapshot = (sim, name) =>
  sim.groups.get(name).flatMap((p) => [p.x, p.y, p.vx, p.vy]);

// Deux simulations identiques (même graine), avancées de quelques pas ; la
// seconde reçoit la modification, puis les deux font un pas.
const compare = (modify, watched = "blue") => {
  const make = () => {
    const settings = base();
    const sim = createSimulation(settings, { ...size, random: seeded() });
    for (let k = 0; k < 5; k++) sim.step();
    return { settings, sim };
  };
  const control = make();
  const changed = make();
  modify(changed.settings);
  changed.sim.sync();
  // Pas de nouvelle initialisation : le groupe observé n'a pas bougé.
  assert.deepEqual(
    snapshot(changed.sim, watched),
    snapshot(control.sim, watched),
    "état conservé avant le pas",
  );
  control.sim.step();
  changed.sim.step();
  return { control, changed, watched };
};

const differs = ({ control, changed, watched }) =>
  assert.notDeepEqual(snapshot(changed.sim, watched), snapshot(control.sim, watched));

test("sans modification, deux simulations de même graine restent identiques", () => {
  const { control, changed } = compare(() => {});
  assert.deepEqual(snapshot(changed.sim, "blue"), snapshot(control.sim, "blue"));
  assert.deepEqual(snapshot(changed.sim, "red"), snapshot(control.sim, "red"));
});

const cases = {
  portée: (s) => setRange(s, 150),
  "portée illimitée": (s) => setRange(s, ""),
  friction: (s) => setFriction(s, "0.9995"),
  bords: (s) => setEdges(s, "wrap"),
  epsilon: (s) => assert.ok(setEpsilon(s, 2).ok),
  gravité: (s) => assert.ok(setGravity(s, 0.05).ok),
  règle: (s) => setRule(s, "blue", "blue", -1),
  "règle hors −1…1": (s) => setRule(s, "blue", "red", -5),
  masse: (s) => assert.ok(setMass(s, "blue", 6).ok),
  "masse d'un autre type": (s) => assert.ok(setMass(s, "white", 40).ok),
  nombre: (s) => setCount(s, "red", 2),
  "ajout d'un type": (s) => {
    assert.ok(addType(s, { name: "gold", color: "gold", count: 50, mass: 10 }).ok);
    setRule(s, "blue", "gold", -1);
  },
  "retrait d'un type": (s) => removeType(s, "red"),
};

for (const [name, modify] of Object.entries(cases)) {
  test(`modifier « ${name} » change le pas suivant, sans réinitialiser`, () => {
    differs(compare(modify));
  });
}

test("masse d'un type existant : masse et rayon de toutes ses particules, positions et vitesses conservées", () => {
  const settings = base();
  const sim = createSimulation(settings, { ...size, random: seeded() });
  for (let k = 0; k < 3; k++) sim.step();
  const before = snapshot(sim, "red");
  const others = snapshot(sim, "blue");
  const blueMass = sim.groups.get("blue").map((p) => p.mass);
  assert.ok(setMass(settings, "red", 12).ok);
  assert.equal(sim.sync(), true);
  const reds = sim.groups.get("red");
  assert.equal(reds.length, settings.types[0].count);
  for (const p of reds) {
    assert.equal(p.mass, 12);
    assert.equal(p.radius, 12 / 2 + 2);
  }
  assert.deepEqual(snapshot(sim, "red"), before);
  assert.deepEqual(snapshot(sim, "blue"), others);
  assert.deepEqual(sim.groups.get("blue").map((p) => p.mass), blueMass);
  // Ordre d'affichage : toujours par masse décroissante.
  const masses = sim.particles.map((p) => p.mass);
  for (let k = 1; k < masses.length; k++) assert.ok(masses[k] <= masses[k - 1]);
  // Rien d'autre n'a changé : sync() ne refait rien.
  assert.equal(sim.sync(), false);
});

test("masse aléatoire puis masse fixe : appliquée aux particules existantes", () => {
  const settings = base();
  settings.types[0].mass = 0; // rouge : masse aléatoire
  const sim = createSimulation(settings, { ...size, random: seeded() });
  const random = sim.groups.get("red").map((p) => p.mass);
  assert.ok(new Set(random).size > 1);
  sim.step();
  const before = snapshot(sim, "red");
  assert.ok(setMass(settings, "red", 3).ok);
  sim.sync();
  for (const p of sim.groups.get("red")) {
    assert.equal(p.mass, 3);
    assert.equal(p.radius, 3.5);
  }
  assert.deepEqual(snapshot(sim, "red"), before);
});

test("friction hors de 0…1 ou non numérique dans le réglage : la simulation reste finie", () => {
  for (const friction of [5, -1, NaN, "x", undefined]) {
    const settings = base();
    settings.friction = friction;
    const sim = createSimulation(settings, { ...size, random: seeded() });
    for (let k = 0; k < 3; k++) sim.step();
    for (const v of sim.state.x) assert.ok(Number.isFinite(v), String(friction));
  }
});

test("gravité : accélération constante vers le bas (négative : vers le haut)", () => {
  const settings = {
    epsilon: 10,
    friction: 1,
    range: 50,
    gravity: 0.5,
    types: [{ name: "a", color: "red", count: 1, mass: 2 }],
    rules: {},
  };
  const coords = [0.5, 0.5];
  let i = 0;
  const sim = createSimulation(settings, { ...size, random: () => coords[i++] });
  const p = sim.particles[0];
  sim.step();
  assert.equal(p.vy, 0.5);
  assert.equal(p.y, 150.5);
  assert.equal(p.x, 200);
  settings.gravity = -0.5;
  sim.step();
  assert.equal(p.vy, 0);
});

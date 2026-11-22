// Tests LIFE-14 : gravitation universelle entre corps massifs
// (`interaction: "gravity"`), validation et réglage de G.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSimulation, interactionOf } from "./engine.js";
import { validatePreset } from "./presets.js";
import { startSettings } from "./settings.js";
import {
  isGravitation,
  needsRangeWarning,
  setGravitationalConstant,
} from "./settings-edit.js";

const seeded = (seed = 1) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

const SIZE = { width: 4000, height: 4000 };

// Réglage en mode gravité, un type par corps donné.
const gravitySettings = (bodies, patch = {}) => ({
  interaction: "gravity",
  G: 1,
  epsilon: 1e-6,
  friction: 1,
  dimensions: 3,
  depth: 4000,
  types: bodies.map((b, k) => ({
    name: `corps${k}`,
    color: "white",
    count: 1,
    bodies: [b],
  })),
  ...patch,
});

// Accélération subie au premier pas (vitesse de départ nulle : v = a).
const firstAcceleration = (settings, i) => {
  const sim = createSimulation(settings, { ...SIZE, random: seeded() });
  sim.step();
  const s = sim.state;
  return [s.vx[i], s.vy[i], s.vz[i]];
};

const close = (actual, expected, rel = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) <= rel * Math.abs(expected),
    `${actual} ≠ ${expected}`,
  );

test("mode d'interaction : « rules » par défaut, « gravity » sur demande", () => {
  assert.equal(interactionOf({}), "rules");
  assert.equal(interactionOf({ interaction: "rules" }), "rules");
  assert.equal(interactionOf({ interaction: "gravity" }), "gravity");
  assert.equal(interactionOf({ interaction: "autre" }), "rules");
});

test("deux corps s'attirent selon G·m/d² (loi en 1/d²)", () => {
  const pair = (d, G = 2) =>
    gravitySettings(
      [
        { position: [1000, 1000, 1000], velocity: [0, 0, 0], mass: 3 },
        { position: [1000 + d, 1000, 1000], velocity: [0, 0, 0], mass: 50 },
      ],
      { G },
    );
  for (const d of [10, 20, 40, 300]) {
    const [a0x, a0y, a0z] = firstAcceleration(pair(d), 0);
    const [a1x] = firstAcceleration(pair(d), 1);
    // Corps 0 attiré vers +x par le corps 1 : a = G·m1/d², et inversement.
    close(a0x, (2 * 50) / d ** 2);
    close(a1x, -(2 * 3) / d ** 2);
    assert.equal(a0y, 0);
    assert.equal(a0z, 0);
  }
  // Distance doublée : force divisée par 4.
  close(firstAcceleration(pair(10), 0)[0] / firstAcceleration(pair(20), 0)[0], 4);
  // G doublé : force doublée.
  close(firstAcceleration(pair(10, 4), 0)[0] / firstAcceleration(pair(10, 2), 0)[0], 2);
});

test("gravité : attraction le long de z en 3D, et en 2D sur le plan", () => {
  const bodies = [
    { position: [500, 500, 100], velocity: [0, 0, 0], mass: 1 },
    { position: [500, 500, 150], velocity: [0, 0, 0], mass: 10 },
  ];
  const [, , az] = firstAcceleration(gravitySettings(bodies), 0);
  close(az, 10 / 50 ** 2);
  const plane = [
    { position: [500, 500], velocity: [0, 0], mass: 1 },
    { position: [530, 540], velocity: [0, 0], mass: 10 },
  ];
  const [ax, ay, az2] = firstAcceleration(gravitySettings(plane, { dimensions: 2 }), 0);
  close(ax, (10 * 30) / 50 ** 3);
  close(ay, (10 * 40) / 50 ** 3);
  assert.equal(az2, 0);
});

test("gravité : adoucissement sqrt(d² + ε²), force finie au contact", () => {
  const bodies = (d) => [
    { position: [1000, 1000, 1000], velocity: [0, 0, 0], mass: 1 },
    { position: [1000 + d, 1000, 1000], velocity: [0, 0, 0], mass: 1 },
  ];
  const eps = 5;
  const [ax] = firstAcceleration(gravitySettings(bodies(5), { epsilon: eps }), 0);
  close(ax, 5 / (25 + 25) ** 1.5);
  // Corps confondus : aucune force (ni infinie ni NaN).
  const [cx, cy, cz] = firstAcceleration(gravitySettings(bodies(0), { epsilon: eps }), 0);
  assert.deepEqual([cx, cy, cz], [0, 0, 0]);
  const [zx] = firstAcceleration(gravitySettings(bodies(0), { epsilon: 0 }), 0);
  assert.equal(zx, 0);
});

test("gravité : quantité de mouvement conservée, portée et règles ignorées", () => {
  const random = seeded(7);
  const bodies = Array.from({ length: 30 }, () => ({
    position: [random() * 2000 + 1000, random() * 2000 + 1000, random() * 2000 + 1000],
    velocity: [random() - 0.5, random() - 0.5, random() - 0.5],
    mass: 1 + random() * 20,
  }));
  const settings = gravitySettings(bodies, { epsilon: 2 });
  const sim = createSimulation(settings, { ...SIZE, random: seeded() });
  const momentum = () => {
    const { vx, vy, vz, mass } = sim.state;
    const p = [0, 0, 0];
    for (let i = 0; i < sim.count; i++) {
      p[0] += mass[i] * vx[i];
      p[1] += mass[i] * vy[i];
      p[2] += mass[i] * vz[i];
    }
    return p;
  };
  const p0 = momentum();
  for (let k = 0; k < 50; k++) sim.step();
  const p1 = momentum();
  for (let a = 0; a < 3; a++) assert.ok(Math.abs(p1[a] - p0[a]) < 1e-9);
  assert.equal(sim.range, Infinity);

  // Une portée minuscule et des règles répulsives ne changent rien.
  const other = createSimulation(
    { ...structuredClone(settings), range: 1, rules: { corps0: { corps1: 100 } } },
    { ...SIZE, random: seeded() },
  );
  for (let k = 0; k < 50; k++) other.step();
  assert.deepEqual([...other.state.x], [...sim.state.x]);
  assert.deepEqual([...other.state.vz], [...sim.state.vz]);
});

// Orbite circulaire d'un corps léger autour d'un corps lourd : v = sqrt(G·M/r).
// Intégrateur actuel (Euler semi-implicite, un pas = une unité de temps) :
// avec environ 560 pas par tour, l'écart de rayon mesuré est d'environ 0,6 %
// sur un tour complet (tolérance retenue : 1 %).
const ORBIT_TOLERANCE = 0.01;

test(`orbite circulaire : rayon à ${ORBIT_TOLERANCE * 100} % près sur un tour (2D et 3D)`, () => {
  for (const dimensions of [2, 3]) {
    const G = 1;
    const M = 1000;
    const m = 0.001;
    const r = 200;
    const v = Math.sqrt((G * M) / r);
    const c = 2000;
    const settings = gravitySettings(
      [
        // Vitesse du corps lourd : quantité de mouvement totale nulle.
        { position: [c, c, c], velocity: [0, (-m * v) / M, 0], mass: M },
        { position: [c + r, c, c], velocity: [0, v, 0], mass: m },
      ],
      { G, epsilon: 0.01, dimensions },
    );
    const sim = createSimulation(settings, { ...SIZE, random: seeded() });
    const period = (2 * Math.PI * r) / v;
    const steps = Math.ceil(period);
    const s = sim.state;
    let angle = 0;
    let previous = 0;
    let worst = 0;
    for (let k = 0; k < steps; k++) {
      sim.step();
      const dx = s.x[1] - s.x[0];
      const dy = s.y[1] - s.y[0];
      const dz = s.z[1] - s.z[0];
      const d = Math.hypot(dx, dy, dz);
      worst = Math.max(worst, Math.abs(d - r) / r);
      const theta = Math.atan2(dy, dx);
      let delta = theta - previous;
      if (delta < -Math.PI) delta += 2 * Math.PI;
      if (delta > Math.PI) delta -= 2 * Math.PI;
      angle += delta;
      previous = theta;
      assert.equal(dz, 0);
    }
    assert.ok(worst < ORBIT_TOLERANCE, `écart de rayon ${(worst * 100).toFixed(2)} %`);
    // Un tour complet, à quelques degrés près.
    assert.ok(Math.abs(angle - 2 * Math.PI) < 0.1, `angle parcouru ${angle}`);
  }
});

test("mode gravité → mode des règles en cours de simulation", () => {
  const settings = structuredClone(startSettings);
  settings.types = settings.types.map((t) => ({ ...t, count: 20 }));
  const reference = createSimulation(structuredClone(settings), {
    width: 800,
    height: 600,
    random: seeded(3),
  });
  settings.interaction = "gravity";
  const sim = createSimulation(settings, { width: 800, height: 600, random: seeded(3) });
  sim.step();
  assert.equal(sim.range, Infinity);
  settings.interaction = "rules";
  sim.step();
  assert.equal(sim.range, 60);
  // L'état diffère de la référence (un pas en gravité) mais reste fini.
  reference.step();
  reference.step();
  assert.notDeepEqual([...sim.state.x], [...reference.state.x]);
  assert.ok([...sim.state.x].every(Number.isFinite));
});

test("mode des règles explicite : identique au bit près au réglage sans `interaction`", () => {
  const settings = structuredClone(startSettings);
  const a = createSimulation(settings, { width: 1000, height: 700, random: seeded(5) });
  const b = createSimulation(
    { ...structuredClone(settings), interaction: "rules", G: 5 },
    { width: 1000, height: 700, random: seeded(5) },
  );
  for (let k = 0; k < 5; k++) {
    a.step();
    b.step();
  }
  assert.deepEqual([...a.state.x], [...b.state.x]);
  assert.deepEqual([...a.state.vy], [...b.state.vy]);
});

// --- Validation ---

const preset = (settings) => ({
  title: "Orbite",
  description: "Deux corps",
  vignette: "orbite.svg",
  settings,
});

const gravityPreset = (patch = {}) =>
  preset({
    interaction: "gravity",
    G: 1,
    epsilon: 0.5,
    friction: 1,
    types: [
      {
        name: "soleil",
        color: "yellow",
        count: 1,
        bodies: [{ position: [500, 500], velocity: [0, 0], mass: 1000 }],
      },
      { name: "planète", color: "blue", count: 1, mass: 1 },
    ],
    ...patch,
  });

test("validation : mode gravité sans portée ni règles", () => {
  assert.deepEqual(validatePreset(gravityPreset()), []);
  assert.deepEqual(validatePreset(gravityPreset({ G: undefined })), []);
  assert.deepEqual(validatePreset(gravityPreset({ range: 300 })), []);
  assert.deepEqual(validatePreset(gravityPreset({ range: null })), []);
  assert.deepEqual(validatePreset(gravityPreset({ range: Infinity })), []);
  assert.deepEqual(validatePreset(gravityPreset({ rules: {} })), []);
  assert.deepEqual(validatePreset(gravityPreset({ rules: { soleil: { planète: -1 } } })), []);
});

test("validation : erreurs du mode gravité", () => {
  const errors = (patch) => validatePreset(gravityPreset(patch));
  assert.deepEqual(errors({ G: 0 }), ["`settings.G` : constante de gravitation > 0 attendue"]);
  assert.deepEqual(errors({ G: "1" }), ["`settings.G` : constante de gravitation > 0 attendue"]);
  assert.deepEqual(errors({ range: -1 }), [
    "`settings.range` : nombre > 0 attendu (facultatif en mode gravité)",
  ]);
  assert.deepEqual(errors({ range: "loin" }), [
    "`settings.range` : nombre > 0 attendu (facultatif en mode gravité)",
  ]);
  assert.deepEqual(errors({ rules: [] }), ["`settings.rules` : objet attendu"]);
  assert.deepEqual(errors({ rules: { lune: {} } }), ["règle « lune » : type inconnu"]);
  // Mode inconnu : signalé, puis vérifié comme le mode des règles.
  assert.deepEqual(errors({ interaction: "newton" }), [
    "`settings.interaction` : « rules » ou « gravity » attendu",
    "`settings.range` : portée finie > 0 attendue",
    "`settings.rules` : objet attendu",
  ]);
});

test("validation : le mode des règles exige toujours portée finie et règles", () => {
  const rules = (patch) =>
    validatePreset(gravityPreset({ interaction: "rules", ...patch }));
  assert.deepEqual(rules({}), [
    "`settings.range` : portée finie > 0 attendue",
    "`settings.rules` : objet attendu",
  ]);
  assert.deepEqual(rules({ range: 100, rules: {} }), []);
  // `interaction` absent : mode des règles.
  assert.deepEqual(rules({ interaction: undefined, range: 100, rules: {} }), []);
});

// --- Réglage en direct ---

test("réglage de G et avertissement de portée en mode gravité", () => {
  const settings = { interaction: "gravity", types: [{ name: "a", count: 6000 }] };
  assert.equal(isGravitation(settings), true);
  assert.equal(isGravitation({}), false);
  assert.deepEqual(setGravitationalConstant(settings, "2,5"), { ok: true });
  assert.equal(settings.G, 2.5);
  for (const bad of ["0", "-1", "", "abc", Infinity]) {
    assert.equal(setGravitationalConstant(settings, bad).ok, false);
    assert.equal(settings.G, 2.5);
  }
  // La portée ne sert pas en mode gravité : pas d'avertissement de portée.
  assert.equal(needsRangeWarning(settings), false);
  assert.equal(needsRangeWarning({ ...settings, interaction: "rules" }), true);
});

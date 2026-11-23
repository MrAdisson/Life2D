// Collisions (settings.collisions) : choc élastique entre particules qui se
// touchent, en option ; sans le réglage, calcul inchangé au bit près.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "./engine.js";
import { startSettings } from "./settings.js";

const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Deux corps explicites (un type chacun), sans force entre eux par défaut.
const pair = (a, b, extra = {}) => ({
  epsilon: 1,
  friction: 1,
  range: 100,
  edges: "bounce",
  collisions: true,
  types: [
    { name: "a", color: "red", count: 1, mass: a.mass, bodies: [a] },
    { name: "b", color: "blue", count: 1, mass: b.mass, bodies: [b] },
  ],
  rules: {},
  ...extra,
});
const SIZE = { width: 1000, height: 1000, depth: 1000 };

const momentum = (sim) => {
  const { vx, vy, vz, mass } = sim.state;
  const p = [0, 0, 0];
  for (let i = 0; i < sim.count; i++) {
    p[0] += mass[i] * vx[i];
    p[1] += mass[i] * vy[i];
    p[2] += mass[i] * vz[i];
  }
  return p;
};
const kinetic = (sim) => {
  const { vx, vy, vz, mass } = sim.state;
  let e = 0;
  for (let i = 0; i < sim.count; i++) {
    e += 0.5 * mass[i] * (vx[i] ** 2 + vy[i] ** 2 + vz[i] ** 2);
  }
  return e;
};
const close = (actual, expected, tolerance, message) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message} : ${actual} ≠ ${expected}`);
const allFinite = (sim) => {
  for (const f of ["x", "y", "z", "vx", "vy", "vz"]) {
    for (let i = 0; i < sim.count; i++) {
      if (!Number.isFinite(sim.state[f][i])) return false;
    }
  }
  return true;
};

test("sans `collisions` (absent ou false), le calcul est identique au bit près, 2D et 3D, règles et gravité", () => {
  const cases = [
    { ...structuredClone(startSettings) },
    { ...structuredClone(startSettings), dimensions: 3 },
    { ...structuredClone(startSettings), interaction: "gravity", G: 1, epsilon: 5 },
    { ...structuredClone(startSettings), interaction: "gravity", dimensions: 3, dt: 0.5 },
  ];
  for (const base of cases) {
    base.types = base.types.map((t) => ({ ...t, count: Math.min(t.count, 60) }));
    const run = (collisions) => {
      const settings = structuredClone(base);
      if (collisions !== undefined) settings.collisions = collisions;
      const sim = createSimulation(settings, { width: 400, height: 300, random: seeded(7) });
      for (let k = 0; k < 40; k++) sim.step();
      return sim.state;
    };
    const reference = run(undefined);
    for (const value of [false, "true", 1]) {
      const state = run(value);
      for (const f of ["x", "y", "z", "vx", "vy", "vz"]) {
        assert.deepEqual(state[f], reference[f], `${f} (collisions: ${value})`);
      }
    }
    // Activées : le résultat change (des particules se touchent).
    const withCollisions = run(true);
    assert.notDeepEqual(withCollisions.x, reference.x, "collisions activées");
  }
});

test("2D : deux particules lancées l'une vers l'autre se heurtent au lieu de se traverser", () => {
  const a = { position: [400, 500], velocity: [2, 0], mass: 4, radius: 10 };
  const b = { position: [600, 500], velocity: [-2, 0], mass: 4, radius: 10 };
  const off = createSimulation(pair(a, b, { collisions: false }), SIZE);
  const on = createSimulation(pair(a, b), SIZE);
  for (let k = 0; k < 100; k++) {
    off.step();
    on.step();
  }
  // Sans collisions : elles se sont croisées.
  assert.ok(off.state.x[0] > off.state.x[1]);
  // Avec : masses égales, choc frontal élastique, les vitesses s'échangent.
  assert.ok(on.state.x[0] < on.state.x[1], "pas de traversée");
  assert.equal(on.state.vx[0], -2);
  assert.equal(on.state.vx[1], 2);
  assert.ok(on.state.x[1] - on.state.x[0] >= 20 - 1e-9, "disques séparés");
});

test("masses différentes : quantité de mouvement et énergie cinétique conservées, vitesses du choc élastique", () => {
  const a = { position: [400, 500], velocity: [3, 0], mass: 2, radius: 6 };
  const b = { position: [500, 500], velocity: [-1, 0], mass: 6, radius: 12 };
  const sim = createSimulation(pair(a, b), SIZE);
  const p0 = momentum(sim);
  const e0 = kinetic(sim);
  for (let k = 0; k < 60; k++) sim.step();
  // Choc frontal à une dimension : v1' = ((m1 − m2)v1 + 2 m2 v2) / (m1 + m2).
  close(sim.state.vx[0], ((2 - 6) * 3 + 2 * 6 * -1) / 8, 1e-12, "vitesse de a");
  close(sim.state.vx[1], ((6 - 2) * -1 + 2 * 2 * 3) / 8, 1e-12, "vitesse de b");
  const p1 = momentum(sim);
  for (let k = 0; k < 3; k++) close(p1[k], p0[k], 1e-12, `quantité de mouvement ${k}`);
  close(kinetic(sim), e0, 1e-12, "énergie cinétique");
});

for (const interaction of ["rules", "gravity"]) {
  for (const dimensions of [2, 3]) {
    test(`choc oblique en ${dimensions}D, mode ${interaction} : conservation et changement des vitesses`, () => {
      const a = { position: [400, 480, 500], velocity: [2, 0.3, 0.2], mass: 3, radius: 15 };
      const b = { position: [560, 510, 510], velocity: [-1.5, 0, -0.1], mass: 7, radius: 20 };
      const extra =
        interaction === "gravity"
          ? { interaction, G: 1e-12, epsilon: 1, dimensions }
          : { dimensions };
      const on = createSimulation(pair(a, b, extra), SIZE);
      const off = createSimulation(pair(a, b, { ...extra, collisions: false }), SIZE);
      const p0 = momentum(on);
      const e0 = kinetic(on);
      for (let k = 0; k < 80; k++) {
        on.step();
        off.step();
      }
      // Sans collisions, les vitesses restent (presque) celles du départ.
      close(off.state.vx[0], 2, 1e-6, "sans collisions");
      assert.ok(Math.abs(on.state.vx[0] - 2) > 0.5, "vitesse de a changée par le choc");
      if (dimensions === 2) {
        assert.equal(on.state.z[0], 0);
        assert.equal(on.state.vz[0], 0);
      } else {
        assert.notEqual(on.state.vz[0], 0.2, "la composante z participe au choc");
      }
      const p1 = momentum(on);
      for (let k = 0; k < 3; k++) close(p1[k], p0[k], 1e-9, `quantité de mouvement ${k}`);
      close(kinetic(on), e0, 1e-9, "énergie cinétique");
      // Les sphères ne s'interpénètrent pas.
      const { x, y, z } = on.state;
      assert.ok(Math.hypot(x[1] - x[0], y[1] - y[0], z[1] - z[0]) >= 35 - 1e-9);
    });
  }
}

test("deux particules superposées au départ sont séparées, sans NaN ni infini", () => {
  for (const dimensions of [2, 3]) {
    for (const interaction of ["rules", "gravity"]) {
      const a = { position: [500, 500, 500], velocity: [0, 0, 0], mass: 5, radius: 8 };
      const b = { position: [500, 500, 500], velocity: [0, 0, 0], mass: 5, radius: 8 };
      const c = { position: [505, 501, 500], velocity: [0, 0, 0], mass: 1, radius: 3 };
      const settings = pair(a, b, { dimensions, interaction, epsilon: 0 });
      settings.types.push({ name: "c", color: "white", count: 1, mass: 1, bodies: [c] });
      const sim = createSimulation(settings, SIZE);
      for (let k = 0; k < 5; k++) sim.step();
      assert.ok(allFinite(sim), `${dimensions}D ${interaction} : valeurs finies`);
      const { x, y, z, radius } = sim.state;
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          const d = Math.hypot(x[j] - x[i], y[j] - y[i], z[j] - z[i]);
          assert.ok(d >= (radius[i] + radius[j]) * 0.99, `${dimensions}D ${interaction} : ${i}-${j} séparées (${d})`);
        }
      }
    }
  }
});

test("les collisions marchent avec les bords qui se rejoignent, le pas de temps et les sous-pas", () => {
  const a = { position: [300, 500], velocity: [-0.5, 0], mass: 2, radius: 8 };
  const b = { position: [350, 500], velocity: [-1.5, 0], mass: 2, radius: 8 };
  const sim = createSimulation(pair(a, b, { edges: "wrap", dt: 0.25, substeps: 4 }), SIZE);
  const e0 = kinetic(sim);
  // 300 images de 4 × 0,25 : a, plus rapide après le choc, repasse par le bord.
  for (let k = 0; k < 300; k++) sim.frame();
  // b a rattrapé a : vitesses échangées, énergie conservée.
  close(sim.state.vx[0], -1.5, 1e-12, "vitesse de a");
  close(sim.state.vx[1], -0.5, 1e-12, "vitesse de b");
  close(kinetic(sim), e0, 1e-12, "énergie");
  assert.ok(sim.state.x[0] > 800 && sim.state.x[0] < 1000, `a ressortie de l'autre côté : ${sim.state.x[0]}`);
});

test("plusieurs centaines de particules : aucune paire ne reste durablement imbriquée", () => {
  for (const dimensions of [2, 3]) {
    const settings = {
      epsilon: 5,
      friction: 0.99,
      range: 80,
      edges: "bounce",
      dimensions,
      depth: 300,
      collisions: true,
      types: [
        { name: "petit", color: "red", count: 400, mass: 4 },
        { name: "gros", color: "blue", count: 20, mass: 30 },
      ],
      // Attraction : les particules s'entassent et se pressent les unes
      // contre les autres.
      rules: { petit: { petit: -0.5, gros: -1 }, gros: { petit: -1, gros: -1 } },
    };
    const sim = createSimulation(settings, { width: 600, height: 400, random: seeded(11) });
    const { x, y, z, radius } = sim.state;
    // Paires imbriquées (à plus de 10 % de la somme des rayons) depuis
    // combien de pas consécutifs.
    let streak = new Map();
    let longest = 0;
    for (let k = 0; k < 200; k++) {
      sim.step();
      const next = new Map();
      for (let i = 0; i < sim.count; i++) {
        for (let j = i + 1; j < sim.count; j++) {
          const d = Math.hypot(x[j] - x[i], y[j] - y[i], z[j] - z[i]);
          if (d < 0.9 * (radius[i] + radius[j])) {
            const key = i * sim.count + j;
            const n = (streak.get(key) ?? 0) + 1;
            next.set(key, n);
            if (n > longest) longest = n;
          }
        }
      }
      streak = next;
    }
    assert.ok(allFinite(sim), `${dimensions}D : valeurs finies`);
    assert.ok(longest <= 10, `${dimensions}D : une paire est restée imbriquée ${longest} pas`);
  }
});

test("le réglage est relu à chaque pas, sans toucher aux positions ni aux vitesses", () => {
  const a = { position: [400, 500], velocity: [2, 0], mass: 4, radius: 10 };
  const b = { position: [600, 500], velocity: [-2, 0], mass: 4, radius: 10 };
  const settings = pair(a, b, { collisions: false });
  const sim = createSimulation(settings, SIZE);
  for (let k = 0; k < 40; k++) sim.step();
  const before = [sim.state.x[0], sim.state.vx[0]];
  settings.collisions = true;
  assert.deepEqual([sim.state.x[0], sim.state.vx[0]], before);
  for (let k = 0; k < 60; k++) sim.step();
  assert.ok(sim.state.x[0] < sim.state.x[1], "choc après activation");
  // Désactivées : on relance les deux corps l'un vers l'autre, ils se
  // traversent.
  settings.collisions = false;
  sim.state.vx[0] = 2;
  sim.state.vx[1] = -2;
  const gap = sim.state.x[1] - sim.state.x[0];
  for (let k = 0; k < Math.ceil(gap / 4) + 10; k++) sim.step();
  assert.ok(sim.state.x[0] > sim.state.x[1], "traversée une fois désactivées");
});

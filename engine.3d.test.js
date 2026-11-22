// Tests LIFE-12 : moteur en 3D (axe z), réglage `dimensions` et `depth`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "./engine.js";
import { defaultSettings, startSettings } from "./settings.js";

const seeded = (seed = 1) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

// Deux particules de masse 2 (rayon 3) dans un cube de 1000 px de côté ;
// positions fournies via random() (ordre de tirage en 3D : x, y, z).
const pair3d = ({ g = 1, a, b, edges, range, rules, depth = 1000 }) => {
  const coords = [a.x / 1000, a.y / 1000, a.z / depth, b.x / 1000, b.y / 1000, b.z / depth];
  let i = 0;
  const sim = createSimulation(
    {
      dimensions: 3,
      depth,
      epsilon: 10,
      friction: 1,
      edges,
      range,
      types: [
        { name: "a", color: "red", count: 1, mass: 2 },
        { name: "b", color: "blue", count: 1, mass: 2 },
      ],
      rules: rules ?? { a: { b: g }, b: { a: g } },
    },
    { width: 1000, height: 1000, random: () => coords[i++] },
  );
  return { sim, pa: sim.groups.get("a")[0], pb: sim.groups.get("b")[0] };
};

test("3D : deux particules séparées sur z se repoussent le long de z seulement", () => {
  const { sim, pa, pb } = pair3d({
    g: 1,
    a: { x: 500, y: 500, z: 400 },
    b: { x: 500, y: 500, z: 600 },
  });
  assert.equal(sim.dimensions, 3);
  assert.equal(pa.z, 400);
  sim.step();
  const d = 200 + 10;
  const expected = ((2 * 2) / d ** 2) * (200 / d) / 2;
  assert.ok(Math.abs(400 - pa.z - expected) < 1e-12);
  assert.ok(Math.abs(pb.z - 600 - expected) < 1e-12);
  assert.deepEqual([pa.x, pa.y, pb.x, pb.y], [500, 500, 500, 500]);
});

test("3D : attraction le long des trois axes, distance en 3D", () => {
  const a = { x: 400, y: 400, z: 400 };
  const b = { x: 500, y: 500, z: 500 };
  const { sim, pa } = pair3d({ g: -1, a, b });
  sim.step();
  const d = Math.sqrt(3 * 100 ** 2) + 10;
  const expected = ((2 * 2) / d ** 2) * (100 / d) / 2;
  for (const axis of ["x", "y", "z"]) {
    assert.ok(Math.abs(pa[axis] - 400 - expected) < 1e-12, axis);
  }
});

test("3D : la portée se mesure en 3D (écart en z compris)", () => {
  // Écart de 30 px en x (dans la portée de 50 en 2D) mais 100 px en z.
  const { sim, pa } = pair3d({
    range: 50,
    a: { x: 500, y: 500, z: 300 },
    b: { x: 530, y: 500, z: 400 },
  });
  sim.step();
  assert.deepEqual([pa.x, pa.y, pa.z], [500, 500, 300]);
});

test("3D : rebond sur les bords en z (devant et derrière)", () => {
  const { sim, pa, pb } = pair3d({
    rules: {},
    a: { x: 500, y: 500, z: 1 },
    b: { x: 500, y: 500, z: 999 },
  });
  pa.vz = -2;
  pb.vz = 3;
  sim.step();
  assert.equal(pa.vz, 2);
  assert.equal(pb.vz, -3);
});

test("3D : la profondeur `depth` borne z", () => {
  const { sim, pa } = pair3d({
    rules: {},
    depth: 200,
    a: { x: 500, y: 500, z: 199 },
    b: { x: 500, y: 500, z: 100 },
  });
  assert.equal(sim.depth, 200);
  assert.equal(pa.z, 199);
  pa.vz = 1;
  sim.step();
  assert.equal(pa.vz, -1);
});

test("3D : bords « wrap » sur z", () => {
  const { sim, pa, pb } = pair3d({
    rules: {},
    edges: "wrap",
    a: { x: 500, y: 500, z: 999 },
    b: { x: 500, y: 500, z: 2 },
  });
  pa.vz = 3;
  pb.vz = -5;
  sim.step();
  assert.equal(pa.z, 2);
  assert.equal(pb.z, 997);
  assert.equal(pa.vz, 3);
});

// Calcul de référence en O(n²) en 3D, même ordre de sommation (j croissant).
const referenceStep = (sim, settings, { width, height, depth }) => {
  const { x, y, z, vx, vy, vz, ax, ay, az, mass, radius } = sim.state;
  const n = sim.count;
  const range = settings.range ?? Infinity;
  const names = settings.types.map((t) => t.name);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (i === j) continue;
      const dx = x[i] - x[j];
      const dy = y[i] - y[j];
      const dz = z[i] - z[j];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > range * range) continue;
      const g =
        settings.rules[names[sim.typeIndex[i]]]?.[names[sim.typeIndex[j]]] ?? 0;
      if (g === 0) continue;
      const distance = Math.sqrt(d2) + settings.epsilon;
      const force = (g * mass[i] * mass[j]) / distance ** 2;
      ax[i] += (force * dx) / distance / mass[i];
      ay[i] += (force * dy) / distance / mass[i];
      az[i] += (force * dz) / distance / mass[i];
    }
  }
  for (let i = 0; i < n; i++) {
    const r = radius[i];
    if (x[i] + r > width || x[i] - r < 0) (vx[i] = -vx[i]), (ax[i] = -ax[i]);
    if (y[i] - r < 0 || y[i] + r > height) (vy[i] = -vy[i]), (ay[i] = -ay[i]);
    if (z[i] - r < 0 || z[i] + r > depth) (vz[i] = -vz[i]), (az[i] = -az[i]);
    vx[i] += ax[i];
    vy[i] += ay[i];
    vz[i] += az[i];
    x[i] += vx[i];
    y[i] += vy[i];
    z[i] += vz[i];
    vx[i] *= settings.friction;
    vy[i] *= settings.friction;
    vz[i] *= settings.friction;
    ax[i] = ay[i] = az[i] = 0;
  }
};

test("3D : la grille donne au bit près le calcul de référence en O(n²)", () => {
  const settings = {
    dimensions: 3,
    depth: 150,
    epsilon: 5,
    friction: 0.9,
    range: 40,
    types: [
      { name: "a", color: "red", count: 120, mass: 3 },
      { name: "b", color: "blue", count: 80 },
    ],
    rules: { a: { a: -30, b: 5 }, b: { a: -8, b: 2 } },
  };
  const options = { width: 200, height: 160 };
  const grid = createSimulation(settings, { ...options, random: seeded(7) });
  const ref = createSimulation(settings, { ...options, random: seeded(7) });
  for (let k = 0; k < 60; k++) {
    grid.step();
    referenceStep(ref, settings, { ...options, depth: 150 });
  }
  for (const field of ["x", "y", "z", "vx", "vy", "vz"]) {
    assert.deepEqual(grid.state[field], ref.state[field], field);
  }
  // Les particules se sont bien déplacées sur z.
  const zs = Array.from(grid.state.z);
  assert.ok(zs.some((v) => v !== zs[0]));
});

test("3D : portée illimitée (une seule case), résultat fini", () => {
  const settings = { ...structuredClone(defaultSettings), dimensions: 3 };
  settings.range = Infinity;
  settings.types = settings.types.map((t) => ({ ...t, count: Math.ceil(t.count / 20) }));
  const sim = createSimulation(settings, { width: 300, height: 300, random: seeded(2) });
  const z0 = Array.from(sim.state.z);
  for (let k = 0; k < 5; k++) sim.step();
  assert.ok(Array.from(sim.state.z).every(Number.isFinite));
  assert.notDeepEqual(Array.from(sim.state.z), z0);
});

test("3D : positions initiales et nouveau tirage dans le volume", () => {
  const settings = { ...structuredClone(startSettings), dimensions: 3, depth: 300 };
  const sim = createSimulation(settings, { width: 800, height: 600, random: seeded(3) });
  const inside = () =>
    Array.from(sim.state.z).every((v) => v >= 0 && v < 300) &&
    new Set(sim.state.z).size > 1;
  assert.ok(inside());
  sim.step();
  sim.reseed();
  assert.ok(inside());
  assert.ok(Array.from(sim.state.vz).every((v) => v === 0));
});

test("3D : profondeur par défaut = plus petite dimension du canevas", () => {
  const settings = { ...structuredClone(startSettings), dimensions: 3 };
  const sim = createSimulation(settings, { width: 800, height: 600, random: seeded(3) });
  assert.equal(sim.depth, 600);
  assert.ok(Array.from(sim.state.z).every((v) => v >= 0 && v < 600));
});

test("2D par défaut : z reste à 0, même résultat qu'avec dimensions: 2", () => {
  const run = (patch) => {
    const settings = { ...structuredClone(startSettings), ...patch };
    const sim = createSimulation(settings, { width: 400, height: 300, random: seeded(5) });
    for (let k = 0; k < 30; k++) sim.step();
    return sim;
  };
  const implicit = run({});
  const explicit = run({ dimensions: 2 });
  // `depth` sans 3D est sans effet.
  const withDepth = run({ dimensions: 2, depth: 50 });
  assert.equal(implicit.dimensions, 2);
  for (const sim of [implicit, explicit, withDepth]) {
    assert.ok(sim.state.z.every((v) => v === 0));
    assert.ok(sim.state.vz.every((v) => v === 0));
  }
  for (const field of ["x", "y", "vx", "vy"]) {
    assert.deepEqual(explicit.state[field], implicit.state[field]);
    assert.deepEqual(withDepth.state[field], implicit.state[field]);
  }
});

test("positions sur 3 flottants : [x, y, z] dans l'ordre d'affichage", () => {
  const settings = { ...structuredClone(startSettings), dimensions: 3 };
  const sim = createSimulation(settings, { width: 100, height: 100, random: seeded(4) });
  const out = sim.writePositions(undefined, 3);
  assert.equal(out.length, sim.count * 3);
  sim.particles.forEach((p, k) => {
    assert.equal(out[3 * k], Math.fround(p.x));
    assert.equal(out[3 * k + 1], Math.fround(p.y));
    assert.equal(out[3 * k + 2], Math.fround(p.z));
  });
});

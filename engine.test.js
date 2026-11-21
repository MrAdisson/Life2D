import { test } from "node:test";
import assert from "node:assert/strict";
import { createSimulation } from "./engine.js";
import { defaultSettings } from "./settings.js";

const size = { width: 1000, height: 1000 };

// Deux particules de masse 2 (rayon 3), positions fournies via random().
const pair = ({ g, epsilon = 10, friction = 1, rules, a, b }) => {
  const coords = [a.x, a.y, b.x, b.y].map((v) => v / 1000);
  let i = 0;
  const sim = createSimulation(
    {
      epsilon,
      friction,
      types: [
        { name: "a", color: "red", count: 1, mass: 2 },
        { name: "b", color: "blue", count: 1, mass: 2 },
      ],
      rules: rules ?? { a: { b: g }, b: { a: g } },
    },
    { ...size, random: () => coords[i++] },
  );
  return { sim, pa: sim.groups.get("a")[0], pb: sim.groups.get("b")[0] };
};

const A = { x: 400, y: 500 };
const B = { x: 600, y: 500 };

test("le nombre de particules par type suit le réglage", () => {
  const sim = createSimulation(defaultSettings, { ...size, random: () => 0.5 });
  for (const t of defaultSettings.types) {
    assert.equal(sim.groups.get(t.name).length, t.count);
  }
  assert.equal(sim.particles.length, 1585);
});

test("le réglage par défaut reprend les valeurs historiques", () => {
  assert.equal(defaultSettings.epsilon, 10);
  assert.equal(defaultSettings.friction, 1);
  const count = Object.values(defaultSettings.rules).reduce(
    (n, r) => n + Object.keys(r).length,
    0,
  );
  assert.equal(count, 16);
});

test("coefficient positif : répulsion", () => {
  const { sim, pa, pb } = pair({ g: 1, a: A, b: B });
  sim.step();
  assert.ok(pa.x < A.x && pb.x > B.x);
});

test("coefficient négatif : attraction", () => {
  const { sim, pa, pb } = pair({ g: -1, a: A, b: B });
  sim.step();
  assert.ok(pa.x > A.x && pb.x < B.x);
});

test("règle absente : aucune force", () => {
  const { sim, pa, pb } = pair({ rules: {}, a: A, b: B });
  sim.step();
  assert.deepEqual([pa.x, pa.y, pb.x, pb.y], [A.x, A.y, B.x, B.y]);
});

test("EPSILON majore la distance : l'accélération est celle attendue", () => {
  const { sim, pa } = pair({ g: 1, epsilon: 10, a: A, b: B });
  sim.step();
  const d = 200 + 10;
  // force = g*m*m/d², accélération = force*dx/d/m
  const expected = (2 * 2 / d ** 2) * (200 / d) / 2;
  assert.ok(Math.abs(A.x - pa.x - expected) < 1e-12);
});

test("EPSILON : force finie pour deux particules superposées", () => {
  const { sim, pa, pb } = pair({ g: 1, a: A, b: A });
  sim.step();
  for (const v of [pa.x, pa.y, pb.x, pb.y]) assert.ok(Number.isFinite(v));
});

test("FRICTION multiplie la vitesse à chaque pas", () => {
  const { sim, pa } = pair({ rules: {}, friction: 0.5, a: A, b: B });
  pa.vx = 8;
  sim.step();
  assert.equal(pa.vx, 4);
  sim.step();
  assert.equal(pa.vx, 2);
});

test("rebond sur les bords : vitesse inversée", () => {
  const { sim, pa } = pair({ rules: {}, a: { x: 1, y: 500 }, b: B });
  pa.vx = -2;
  sim.step();
  assert.equal(pa.vx, 2);
  const { sim: sim2, pa: pc } = pair({ rules: {}, a: { x: 500, y: 999 }, b: B });
  pc.vy = 3;
  sim2.step();
  assert.equal(pc.vy, -3);
});

test("déterminisme : même générateur, même résultat", () => {
  const run = () => {
    let s = 1;
    const random = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const sim = createSimulation(defaultSettings, { ...size, random });
    sim.step();
    return sim.particles.slice(0, 5).map((p) => [p.x, p.y]);
  };
  assert.deepEqual(run(), run());
});

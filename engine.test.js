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

// --- Réglage modifié en cours de simulation ---

test("une règle modifiée change le résultat du pas suivant", () => {
  const settings = {
    epsilon: 10,
    friction: 1,
    types: [
      { name: "a", color: "red", count: 1, mass: 2 },
      { name: "b", color: "blue", count: 1, mass: 2 },
    ],
    rules: { a: { b: 0 }, b: { a: 0 } },
  };
  const coords = [0.4, 0.5, 0.6, 0.5];
  let i = 0;
  const sim = createSimulation(settings, { ...size, random: () => coords[i++] });
  const pa = sim.groups.get("a")[0];
  sim.step();
  assert.equal(pa.x, 400);
  settings.rules.a.b = 1; // répulsion de a par b
  sim.step();
  assert.ok(pa.x < 400);
  const x = pa.x;
  settings.rules.a.b = -1; // attraction : a part vers b
  const vx = pa.vx;
  sim.step();
  assert.ok(pa.vx > vx && pa.x > x - 1);
});

test("friction 0 : les particules s'arrêtent ; friction 1 : aucune perte", () => {
  const settings = {
    epsilon: 10,
    friction: 1,
    types: [{ name: "a", color: "red", count: 1, mass: 2 }],
    rules: {},
  };
  const sim = createSimulation(settings, { ...size, random: () => 0.5 });
  const p = sim.groups.get("a")[0];
  p.vx = 3;
  sim.step();
  assert.equal(p.vx, 3);
  settings.friction = 0;
  sim.step();
  assert.equal(p.vx, 0);
  const x = p.x;
  sim.step();
  assert.equal(p.x, x);
});

test("la portée modifiée en cours de simulation est prise en compte", () => {
  const settings = {
    epsilon: 10,
    friction: 1,
    range: 50,
    types: [
      { name: "a", color: "red", count: 1, mass: 2 },
      { name: "b", color: "blue", count: 1, mass: 2 },
    ],
    rules: { a: { b: 1 }, b: { a: 1 } },
  };
  const coords = [0.4, 0.5, 0.6, 0.5];
  let i = 0;
  const sim = createSimulation(settings, { ...size, random: () => coords[i++] });
  const pa = sim.groups.get("a")[0];
  sim.step();
  assert.equal(pa.x, 400); // 200 px d'écart, portée 50
  settings.range = 300;
  sim.step();
  assert.ok(pa.x < 400);
});

test("les bords « wrap » ramènent la particule de l'autre côté", () => {
  const settings = {
    epsilon: 10,
    friction: 1,
    edges: "bounce",
    types: [{ name: "a", color: "red", count: 1, mass: 2 }],
    rules: {},
  };
  const sim = createSimulation(settings, { ...size, random: () => 0.999 });
  const p = sim.groups.get("a")[0];
  p.vx = 5;
  settings.edges = "wrap";
  sim.step();
  assert.ok(p.x >= 0 && p.x < 10 && p.vx === 5);
});

const grow = () => {
  let s = 7;
  const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const settings = structuredClone(defaultSettings);
  return { settings, sim: createSimulation(settings, { ...size, random }) };
};

test("changer le nombre d'un type ajoute ou retire ses particules seulement", () => {
  const { settings, sim } = grow();
  const blue = sim.groups.get("blue").map((p) => [p.x, p.y]);
  const red = sim.groups.get("red").map((p) => [p.x, p.y]);
  sim.step();
  const before = sim.particles.length;
  settings.types.find((t) => t.name === "red").count = 100;
  assert.equal(sim.sync(), true);
  assert.equal(sim.groups.get("red").length, 100);
  assert.equal(sim.particles.length, before + 40);
  assert.equal(sim.count, before + 40);
  assert.equal(sim.groups.get("blue").length, 1500);
  // Les particules déjà là gardent leur état.
  assert.equal(sim.groups.get("red")[0].vx !== undefined, true);
  settings.types.find((t) => t.name === "red").count = 10;
  sim.sync();
  assert.equal(sim.groups.get("red").length, 10);
  assert.equal(sim.groups.get("blue").length, 1500);
  assert.equal(sim.sync(), false);
  assert.ok(blue.length === 1500 && red.length === 60);
});

test("sync garde positions et vitesses des particules existantes", () => {
  const { settings, sim } = grow();
  for (let k = 0; k < 3; k++) sim.step();
  const snapshot = sim.groups.get("blue").map((p) => [p.x, p.y, p.vx, p.vy]);
  settings.types.find((t) => t.name === "red").count = 0;
  sim.sync();
  const after = sim.groups.get("blue").map((p) => [p.x, p.y, p.vx, p.vy]);
  assert.deepEqual(after, snapshot);
});

test("ajouter un type crée ses particules ; le retirer les supprime", () => {
  const { settings, sim } = grow();
  settings.types.push({ name: "gold", color: "gold", count: 30, mass: 7 });
  settings.rules.gold = { red: 0, gold: 0 };
  sim.sync();
  assert.equal(sim.groups.get("gold").length, 30);
  assert.equal(sim.count, 1585 + 30);
  assert.equal(sim.groups.get("gold")[0].mass, 7);
  sim.step();
  for (const p of sim.groups.get("gold")) assert.ok(Number.isFinite(p.x));
  settings.types = settings.types.filter((t) => t.name !== "red");
  delete settings.rules.red;
  for (const row of Object.values(settings.rules)) delete row.red;
  sim.sync();
  assert.equal(sim.groups.has("red"), false);
  assert.equal(sim.count, 1500 + 5 + 20 + 30);
  sim.step();
  assert.equal(sim.particles.length, sim.count);
});

test("reseed : nouvelles positions, vitesses à zéro, mêmes nombres", () => {
  const { sim } = grow();
  for (let k = 0; k < 3; k++) sim.step();
  const before = sim.groups.get("white").map((p) => p.x);
  const count = sim.count;
  sim.reseed();
  assert.equal(sim.count, count);
  assert.notDeepEqual(sim.groups.get("white").map((p) => p.x), before);
  for (const p of sim.particles) assert.ok(p.vx === 0 && p.vy === 0);
});

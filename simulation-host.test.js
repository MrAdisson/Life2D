import { test } from "node:test";
import assert from "node:assert/strict";
import { attachSimulation } from "./simulation-host.js";
import { defaultSettings, referenceSettings } from "./settings.js";

// Faux port de Worker : enregistre les messages envoyés à la page.
const fakePort = () => {
  const sent = [];
  const port = {
    postMessage: (data, transfer = []) => sent.push({ data, transfer }),
  };
  return { port, sent, send: (data) => port.onmessage({ data }) };
};

test("worker : init renvoie couleurs, rayons et positions initiales", () => {
  const { port, sent, send } = fakePort();
  attachSimulation(port, { random: () => 0.5 });
  send({ type: "init", settings: referenceSettings, width: 800, height: 600 });
  const [init, first] = sent.map((m) => m.data);
  assert.equal(init.type, "init");
  assert.equal(init.count, 20000);
  assert.deepEqual(init.palette, ["red", "blue", "green", "white"]);
  assert.equal(init.types.length, 20000);
  // Ordre d'affichage : les plus massives (vertes, rayon 52) d'abord.
  assert.equal(init.palette[init.types[0]], "green");
  assert.equal(init.radii[0], 52);
  assert.equal(first.type, "positions");
  assert.equal(first.steps, 0);
  assert.ok(first.positions instanceof Float32Array);
  assert.equal(first.positions.length, 60000);
  assert.equal(first.positions[0], 400);
  assert.equal(first.positions[2], 0); // z = 0 en 2D
  assert.equal(init.dimensions, 2);
  assert.deepEqual(sent[1].transfer, [first.positions.buffer]);
});

test("worker : chaque demande « step » calcule un pas et renvoie le tampon", () => {
  const { port, sent, send } = fakePort();
  let s = 1;
  attachSimulation(port, {
    random: () => (s = (s * 16807) % 2147483647) / 2147483647,
  });
  send({ type: "init", settings: referenceSettings, width: 800, height: 600 });
  const before = sent[1].data.positions.slice();
  const buffer = new Float32Array(60000);
  send({ type: "step", positions: buffer });
  send({ type: "step", positions: buffer });
  const last = sent.at(-1).data;
  assert.equal(last.type, "positions");
  assert.equal(last.steps, 2);
  assert.equal(last.positions, buffer);
  assert.notDeepEqual(Array.from(buffer), Array.from(before));
});

test("worker : « step » avant « init » est ignoré", () => {
  const { port, sent, send } = fakePort();
  attachSimulation(port);
  send({ type: "step", positions: new Float32Array(2) });
  assert.equal(sent.length, 0);
});

const seeded = () => {
  let s = 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

test("worker : « settings » sans changement de types ne réinitialise rien", () => {
  const { port, sent, send } = fakePort();
  attachSimulation(port, { random: seeded() });
  const settings = structuredClone(defaultSettings);
  send({ type: "init", settings, width: 800, height: 600 });
  const n = sent.length;
  const changed = structuredClone(settings);
  changed.friction = 0.5;
  changed.rules.red.blue = 0;
  send({ type: "settings", settings: changed });
  assert.equal(sent.length, n);
});

test("worker : changer un nombre renvoie « init » puis « positions » ; l'ancien tampon est ignoré", () => {
  const { port, sent, send } = fakePort();
  attachSimulation(port, { random: seeded() });
  const settings = structuredClone(defaultSettings);
  send({ type: "init", settings, width: 800, height: 600 });
  const first = sent[1].data;
  const changed = structuredClone(settings);
  changed.types[0].count = 61;
  send({ type: "settings", settings: changed });
  const [init, positions] = sent.slice(-2).map((m) => m.data);
  assert.equal(init.type, "init");
  assert.equal(init.count, 1586);
  assert.equal(init.generation, first.generation + 1);
  assert.equal(positions.positions.length, 1586 * 3);
  const n = sent.length;
  send({
    type: "step",
    positions: new Float32Array(1585 * 3),
    generation: first.generation,
  });
  assert.equal(sent.length, n); // ancienne génération : ignoré
  send({ type: "step", positions: positions.positions, generation: init.generation });
  assert.equal(sent.at(-1).data.steps, 1);
});

test("worker : « reseed » renvoie un nouvel état sans changer les nombres", () => {
  const { port, sent, send } = fakePort();
  attachSimulation(port, { random: seeded() });
  send({ type: "init", settings: structuredClone(defaultSettings), width: 800, height: 600 });
  const before = sent[1].data.positions.slice(0, 6);
  send({ type: "reseed" });
  const [init, positions] = sent.slice(-2).map((m) => m.data);
  assert.equal(init.count, 1585);
  assert.notDeepEqual(Array.from(positions.positions.slice(0, 6)), Array.from(before));
});

test("worker : changer la masse d'un type renvoie les nouveaux rayons, positions conservées", () => {
  const { port, sent, send } = fakePort();
  attachSimulation(port, { random: seeded() });
  const settings = structuredClone(defaultSettings);
  send({ type: "init", settings, width: 800, height: 600 });
  const first = sent[0].data;
  send({ type: "step", positions: sent[1].data.positions, generation: first.generation });
  const before = sent.at(-1).data.positions.slice();
  const radiiOf = (init, name) => {
    const t = settings.types.findIndex((x) => x.name === name);
    return Array.from(init.radii).filter((_, k) => init.types[k] === t);
  };
  assert.deepEqual(new Set(radiiOf(first, "red")), new Set([4]));
  const changed = structuredClone(settings);
  changed.types[0].mass = 30; // rouge : 4 -> 30
  send({ type: "settings", settings: changed });
  const [init, positions] = sent.slice(-2).map((m) => m.data);
  assert.equal(init.type, "init");
  assert.equal(init.generation, first.generation + 1);
  assert.equal(init.count, 1585);
  assert.deepEqual(new Set(radiiOf(init, "red")), new Set([17]));
  assert.deepEqual(new Set(radiiOf(init, "blue")), new Set([3]));
  // Mêmes positions (l'ordre d'affichage suit la masse : on compare les
  // ensembles de points).
  const points = (p) =>
    Array.from({ length: p.length / 3 }, (_, k) => `${p[3 * k]},${p[3 * k + 1]}`).sort();
  assert.deepEqual(points(positions.positions), points(before));
  assert.equal(positions.steps, 1);
});

test("worker : gravité et epsilon modifiés s'appliquent au pas suivant sans « init »", () => {
  const run = (patch) => {
    const { port, sent, send } = fakePort();
    attachSimulation(port, { random: seeded() });
    const settings = structuredClone(defaultSettings);
    settings.range = 60;
    send({ type: "init", settings, width: 800, height: 600 });
    const n = sent.length;
    send({ type: "settings", settings: { ...structuredClone(settings), ...patch } });
    assert.equal(sent.length, n);
    send({ type: "step", positions: sent[1].data.positions, generation: sent[0].data.generation });
    return Array.from(sent.at(-1).data.positions);
  };
  const plain = run({});
  assert.notDeepEqual(run({ gravity: 0.1 }), plain);
  assert.notDeepEqual(run({ epsilon: 1 }), plain);
});

test("worker : en 3D, le tampon transporte x, y, z et z évolue", () => {
  const { port, sent, send } = fakePort();
  attachSimulation(port, { random: seeded() });
  const settings = { ...structuredClone(defaultSettings), range: 60, dimensions: 3, depth: 400 };
  send({ type: "init", settings, width: 800, height: 600 });
  const [init, first] = sent.map((m) => m.data);
  assert.equal(init.dimensions, 3);
  assert.equal(init.depth, 400); // la vue 3D en a besoin pour la perspective
  assert.equal(first.positions.length, 1585 * 3);
  const zOf = (p) => Array.from({ length: p.length / 3 }, (_, k) => p[3 * k + 2]);
  const z0 = zOf(first.positions);
  assert.ok(z0.every((z) => z >= 0 && z < 400));
  assert.ok(new Set(z0).size > 1);
  send({ type: "step", positions: first.positions, generation: init.generation });
  assert.notDeepEqual(zOf(sent.at(-1).data.positions), z0);
});

test("worker : changer `dimensions` relance la simulation (nouvel « init »)", () => {
  const { port, sent, send } = fakePort();
  attachSimulation(port, { random: seeded() });
  const settings = structuredClone(defaultSettings);
  send({ type: "init", settings, width: 800, height: 600 });
  const first = sent[0].data;
  send({ type: "settings", settings: { ...structuredClone(settings), dimensions: 3 } });
  const [init, positions] = sent.slice(-2).map((m) => m.data);
  assert.equal(init.type, "init");
  assert.equal(init.dimensions, 3);
  assert.equal(init.depth, 600); // plus petite dimension du canevas
  assert.equal(init.generation, first.generation + 1);
  assert.equal(positions.steps, 0);
  assert.ok(positions.positions.some((v, k) => k % 3 === 2 && v !== 0));
});

test("la vue 2D lit le même nombre de flottants par particule que le worker", async () => {
  const { POSITION_STRIDE } = await import("./simulation-host.js");
  const renderer = await import("./renderer.js");
  assert.equal(POSITION_STRIDE, 3);
  assert.equal(renderer.POSITION_STRIDE, POSITION_STRIDE);
});

test("worker : taille de l'espace fixée par le réglage (`width`, `height`) dans « init »", () => {
  const { port, sent, send } = fakePort();
  attachSimulation(port, { random: () => 0.5 });
  const settings = {
    interaction: "gravity", epsilon: 1, friction: 1, dimensions: 3, depth: 50,
    width: 5000, height: 4000,
    types: [{ name: "a", color: "red", count: 1, mass: 1,
      bodies: [{ position: [4900, 3900, 25], velocity: [0, 0, 0] }] }],
  };
  send({ type: "init", settings, width: 800, height: 600 });
  const init = sent[0].data;
  assert.equal(init.width, 5000);
  assert.equal(init.height, 4000);
  assert.equal(init.depth, 50);
  // Sans `width` / `height` : la taille du canevas, comme avant.
  const other = fakePort();
  attachSimulation(other.port, { random: () => 0.5 });
  const { width, height, ...canvasSized } = settings;
  other.send({ type: "init", settings: canvasSized, width: 800, height: 600 });
  assert.equal(other.sent[0].data.width, 800);
  assert.equal(other.sent[0].data.height, 600);
});

test("worker : changer la taille de l'espace renvoie « init » sans nouveau tirage", () => {
  const { port, sent, send } = fakePort();
  attachSimulation(port, { random: () => 0.5 });
  const settings = {
    interaction: "gravity", epsilon: 1, friction: 1, dimensions: 2,
    types: [{ name: "a", color: "red", count: 1, mass: 1,
      bodies: [{ position: [50, 40], velocity: [1, 0] }] }],
  };
  send({ type: "init", settings, width: 800, height: 600 });
  send({ type: "step", positions: new Float32Array(3), generation: 1 });
  const before = sent.length;
  send({ type: "settings", settings: { ...settings, width: 300, height: 200 } });
  const [init, positions] = sent.slice(before).map((m) => m.data);
  assert.equal(init.type, "init");
  assert.deepEqual([init.width, init.height], [300, 200]);
  assert.equal(positions.type, "positions");
  // Pas de nouveau tirage : le corps a avancé d'un pas, il n'est pas revenu au départ.
  assert.ok(positions.positions[0] > 50);
  // Même taille renvoyée : rien de nouveau.
  const after = sent.length;
  send({ type: "settings", settings: { ...settings, width: 300, height: 200 } });
  assert.equal(sent.length, after);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { attachSimulation } from "./simulation-host.js";
import { referenceSettings } from "./settings.js";

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
  assert.equal(first.positions.length, 40000);
  assert.equal(first.positions[0], 400);
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
  const buffer = new Float32Array(40000);
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

import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_SUBSTEPS, frameSteps, createSimulation } from "./engine.js";
import { attachSimulation } from "./simulation-host.js";
import { setSpeed } from "./settings-edit.js";
import { formatTime } from "./stats.js";
import { validatePreset } from "./presets.js";
import { defaultSettings } from "./settings.js";

const base = () => ({
  ...structuredClone(defaultSettings),
  types: [{ name: "a", color: "red", count: 5, mass: 1 }],
  rules: { a: { a: 0 } },
});

test("vitesse 1 (ou absente) : substeps pas de dt, inchangé", () => {
  assert.deepEqual(frameSteps({}), { steps: 1, dt: 1, requested: 1, achieved: 1, limited: false });
  const f = frameSteps({ dt: 0.5, substeps: 4, speed: 1 });
  assert.equal(f.steps, 4);
  assert.equal(f.dt, 0.5);
});

test("vitesse : priorité aux sous-pas, dt agrandi seulement pour rester exact", () => {
  assert.deepEqual([frameSteps({ speed: 2 }).steps, frameSteps({ speed: 2 }).dt], [2, 1]);
  const f = frameSteps({ speed: 1.5 });
  assert.equal(f.steps, 2);
  assert.equal(f.steps * f.dt, 1.5);
  const slow = frameSteps({ speed: 0.1 });
  assert.equal(slow.steps, 1);
  assert.ok(Math.abs(slow.dt - 0.1) < 1e-12);
  const g = frameSteps({ dt: 0.5, substeps: 4, speed: 0.5 });
  assert.equal(g.steps, 2);
  assert.equal(g.steps * g.dt, 1);
});

test("plafond : au-delà de MAX_SUBSTEPS, vitesse non atteinte signalée", () => {
  const f = frameSteps({ speed: 1000 });
  assert.equal(f.steps, MAX_SUBSTEPS);
  assert.equal(f.limited, true);
  assert.equal(f.achieved, MAX_SUBSTEPS);
  assert.equal(f.requested, 1000);
  assert.equal(frameSteps({ speed: MAX_SUBSTEPS }).limited, false);
  assert.equal(frameSteps({ substeps: 10, speed: 20 }).achieved, 10);
});

test("moteur : 2× avance le temps simulé deux fois plus vite par image", () => {
  const time = (speed, frames = 10) => {
    const s = { ...base(), speed };
    const sim = createSimulation(s, { width: 200, height: 200, random: () => 0.3 });
    for (let k = 0; k < frames; k++) sim.frame();
    return sim.time;
  };
  assert.equal(time(1), 10);
  assert.equal(time(2), 20);
  assert.ok(Math.abs(time(0.5) - 5) < 1e-9);
  assert.ok(Math.abs(time(7.3) - 73) < 1e-9);
});

test("worker : 2× double le temps simulé par image, changement en direct", () => {
  const sent = [];
  const port = { postMessage: (d) => sent.push(d) };
  attachSimulation(port, { random: () => 0.3 });
  const send = (data) => port.onmessage({ data });
  send({ type: "init", settings: base(), width: 200, height: 200 });
  const step = () => {
    const last = sent.findLast((m) => m.type === "positions");
    send({ type: "step", positions: new Float32Array(15), generation: last.generation });
    return sent.findLast((m) => m.type === "positions");
  };
  const t1 = step().time;
  assert.equal(t1, 1);
  send({ type: "settings", settings: { speed: 2 } });
  const t2 = step();
  assert.equal(t2.time - t1, 2);
  assert.equal(t2.steps, 2); // pas d'image : pas de redémarrage
  send({ type: "settings", settings: { speed: 1 } });
  assert.equal(step().time - t2.time, 1);
});

test("saisie de la vitesse : nombre > 0 seulement", () => {
  const s = {};
  assert.equal(setSpeed(s, "2,5").ok, true);
  assert.equal(s.speed, 2.5);
  for (const bad of ["", "0", "-1", "abc", Infinity]) {
    assert.equal(setSpeed(s, bad).ok, false);
  }
  assert.equal(s.speed, 2.5);
});

test("temps simulé avec unité facultative", () => {
  assert.equal(formatTime(1.5, "jours"), "1,5 jours");
  assert.equal(formatTime(1.5), "1,5");
});

test("préréglage : speed et timeUnit validés", () => {
  const preset = (extra) => ({
    title: "t",
    description: "d",
    settings: { ...base(), ...extra },
  });
  const errs = (extra) => {
    const r = validatePreset(preset(extra));
    return JSON.stringify(r);
  };
  assert.doesNotMatch(errs({ speed: 2, timeUnit: "jours" }), /speed|timeUnit/);
  assert.match(errs({ speed: 0 }), /speed/);
  assert.match(errs({ timeUnit: "" }), /timeUnit/);
});

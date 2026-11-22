// Tests LIFE-15 : pas de temps `dt`, sous-pas `substeps`, intégrateur
// vitesse-Verlet en mode gravité, temps simulé.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SUBSTEPS,
  createSimulation,
  substepsOf,
  timeStepOf,
} from "./engine.js";
import { createSimulation as createLegacySimulation } from "./fixtures/legacy-engine.js";
import { validatePreset } from "./presets.js";
import { defaultSettings, startSettings } from "./settings.js";
import { setSubsteps, setTimeStep } from "./settings-edit.js";
import { attachSimulation } from "./simulation-host.js";

const seeded = (seed = 1) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

const snapshot = (sim) =>
  Object.fromEntries(
    ["x", "y", "z", "vx", "vy", "vz"].map((f) => [f, [...sim.state[f]]]),
  );

// --- Mode des règles : dt = 1 identique au bit près ---

test("mode des règles : dt = 1 et substeps = 1 identiques au bit près (2D, 3D, rebond, traversée, gravité verticale)", () => {
  const variants = [
    {},
    { dimensions: 3, depth: 400 },
    { edges: "wrap", gravity: 0.05, friction: 0.98 },
    { dimensions: 3, edges: "wrap", gravity: -0.02 },
  ];
  for (const patch of variants) {
    const base = { ...structuredClone(startSettings), ...patch };
    base.types = base.types.map((t) => ({ ...t, count: Math.min(t.count, 80) }));
    const size = { width: 700, height: 500 };
    const a = createSimulation(structuredClone(base), { ...size, random: seeded(9) });
    const b = createSimulation(
      { ...structuredClone(base), dt: 1, substeps: 1 },
      { ...size, random: seeded(9) },
    );
    for (let k = 0; k < 30; k++) {
      a.step();
      b.frame();
    }
    assert.deepEqual(snapshot(b), snapshot(a));
  }
});

test("mode des règles : dt = 1 identique au bit près à l'ancien moteur figé", () => {
  const settings = structuredClone(defaultSettings);
  settings.types = settings.types.map((t) => ({ ...t, count: Math.min(t.count, 60) }));
  const size = { width: 600, height: 400 };
  const legacy = createLegacySimulation(structuredClone(settings), { ...size, random: seeded(4) });
  const sim = createSimulation({ ...settings, dt: 1 }, { ...size, random: seeded(4) });
  for (let k = 0; k < 20; k++) {
    legacy.step();
    sim.step();
  }
  for (const { name } of settings.types) {
    for (const field of ["x", "y", "vx", "vy"]) {
      assert.deepEqual(
        sim.groups.get(name).map((p) => p[field]),
        legacy.groups.get(name).map((p) => p[field]),
      );
    }
  }
});

test("mode des règles : le déplacement d'un pas est proportionnel à dt", () => {
  const settings = {
    epsilon: 1,
    friction: 1,
    range: 50,
    dt: 0.25,
    types: [
      {
        name: "a",
        color: "white",
        count: 1,
        bodies: [{ position: [100, 100], velocity: [4, -2], mass: 1 }],
      },
    ],
    rules: {},
  };
  const sim = createSimulation(settings, { width: 1000, height: 1000, random: seeded() });
  sim.step();
  assert.equal(sim.state.x[0], 101);
  assert.equal(sim.state.y[0], 99.5);
  // Gravité verticale : accélération par unité de temps².
  settings.gravity = 8;
  sim.step();
  assert.equal(sim.state.vy[0], -2 + 8 * 0.25);
});

test("friction par unité de temps : deux pas de dt = 0,5 freinent comme un pas de 1", () => {
  const make = (dt) =>
    createSimulation(
      {
        interaction: "gravity",
        epsilon: 1,
        friction: 0.5,
        dt,
        types: [
          {
            name: "a",
            color: "white",
            count: 1,
            bodies: [{ position: [500, 500], velocity: [2, 0], mass: 1 }],
          },
        ],
      },
      { width: 1000, height: 1000, random: seeded() },
    );
  const one = make(1);
  one.step();
  const two = make(0.5);
  two.step();
  two.step();
  assert.equal(one.state.vx[0], 1);
  assert.ok(Math.abs(two.state.vx[0] - 1) < 1e-12);
});

// --- Mode gravité : vitesse-Verlet ---

const G = 1;
const M = 1000;
const m = 1;
const R = 200;
const C = 2000;

// Orbite circulaire de deux corps autour de leur centre de masse
// (v relative = sqrt(G·(M + m)/R), quantité de mouvement totale nulle).
const orbit = (patch = {}) => {
  const v = Math.sqrt((G * (M + m)) / R);
  return {
    interaction: "gravity",
    G,
    epsilon: 0.01,
    friction: 1,
    dimensions: 3,
    depth: 4000,
    types: [
      {
        name: "étoile",
        color: "yellow",
        count: 1,
        bodies: [{ position: [C, C, C], velocity: [0, (-m * v) / (M + m), 0], mass: M }],
      },
      {
        name: "planète",
        color: "blue",
        count: 1,
        bodies: [{ position: [C + R, C, C], velocity: [0, (M * v) / (M + m), 0], mass: m }],
      },
    ],
    ...patch,
  };
};

// Énergie totale : cinétique + potentielle adoucie −G·mi·mj/sqrt(d² + ε²).
const energy = (sim, settings) => {
  const s = sim.state;
  let e = 0;
  for (let i = 0; i < sim.count; i++) {
    e += 0.5 * s.mass[i] * (s.vx[i] ** 2 + s.vy[i] ** 2 + s.vz[i] ** 2);
    for (let j = i + 1; j < sim.count; j++) {
      const d2 = (s.x[j] - s.x[i]) ** 2 + (s.y[j] - s.y[i]) ** 2 + (s.z[j] - s.z[i]) ** 2;
      e -= (settings.G * s.mass[i] * s.mass[j]) / Math.sqrt(d2 + settings.epsilon ** 2);
    }
  }
  return e;
};

// Tolérance du ticket : 1 % sur 10 000 pas. Mesuré avec vitesse-Verlet :
// environ 4·10⁻⁷ % avec dt = 1 (environ 560 pas par tour), 2·10⁻⁴ % avec dt = 5.
const ENERGY_TOLERANCE = 0.01;
const ENERGY_STEPS = 10000;

test(`orbite circulaire en mode gravité : énergie à ${ENERGY_TOLERANCE * 100} % près sur ${ENERGY_STEPS} pas (2D et 3D, plusieurs dt)`, () => {
  for (const dimensions of [2, 3]) {
    for (const dt of [1, 5]) {
      const settings = orbit({ dimensions, dt });
      const sim = createSimulation(settings, { width: 4000, height: 4000, random: seeded() });
      const e0 = energy(sim, settings);
      let worst = 0;
      for (let k = 0; k < ENERGY_STEPS; k++) {
        sim.step();
        worst = Math.max(worst, Math.abs(energy(sim, settings) - e0) / Math.abs(e0));
      }
      assert.ok(
        worst < ENERGY_TOLERANCE,
        `${dimensions}D, dt = ${dt} : dérive d'énergie ${(worst * 100).toFixed(4)} %`,
      );
      // Bien plus précis que la tolérance : l'énergie ne dérive pas.
      assert.ok(worst < 1e-4, `${dimensions}D, dt = ${dt} : ${worst}`);
      // L'orbite reste circulaire.
      const s = sim.state;
      const d = Math.hypot(s.x[1] - s.x[0], s.y[1] - s.y[0], s.z[1] - s.z[0]);
      assert.ok(Math.abs(d - R) / R < 1e-3, `rayon ${d}`);
      assert.equal(sim.time, ENERGY_STEPS * dt);
    }
  }
});

test("mode gravité : des sous-pas plus fins donnent la même orbite, plus précise", () => {
  // Même temps simulé : 1 pas de 20 contre 20 pas de 1 (substeps), 50 images.
  const coarse = createSimulation(orbit({ dt: 20 }), { width: 4000, height: 4000 });
  const fineSettings = orbit({ dt: 1, substeps: 20 });
  const fine = createSimulation(fineSettings, { width: 4000, height: 4000 });
  const exact = createSimulation(orbit({ dt: 0.05 }), { width: 4000, height: 4000 });
  for (let k = 0; k < 50; k++) {
    coarse.frame();
    assert.equal(fine.frame(), 20);
  }
  for (let k = 0; k < 20000; k++) exact.step();
  assert.equal(coarse.time, 1000);
  assert.equal(fine.time, 1000);
  assert.ok(Math.abs(exact.time - 1000) < 1e-9);
  const gap = (a) => Math.hypot(a.state.x[1] - exact.state.x[1], a.state.y[1] - exact.state.y[1]);
  assert.ok(gap(fine) < gap(coarse) / 10, `écarts ${gap(fine)} / ${gap(coarse)}`);
  assert.ok(gap(fine) < 1, `écart ${gap(fine)}`);
});

test("mode gravité : G et epsilon modifiés en direct sont pris en compte au pas suivant", () => {
  const settings = orbit({ dimensions: 2, dt: 1e-9 });
  const sim = createSimulation(settings, { width: 4000, height: 4000 });
  sim.step();
  // Accélération du corps léger vers l'étoile : G·M/d².
  const close = (actual, expected) =>
    assert.ok(Math.abs(actual - expected) < 1e-6 * Math.abs(expected), `${actual} ≠ ${expected}`);
  close(sim.state.ax[1], -(1 * M) / (R * R + 1e-4) ** 1.5 * R);
  settings.G = 3;
  sim.step();
  close(sim.state.ax[1], -(3 * M) / (R * R + 1e-4) ** 1.5 * R);
  settings.epsilon = 100;
  sim.step();
  close(sim.state.ax[1], -(3 * M) / (R * R + 1e4) ** 1.5 * R);
});

test("passage du mode gravité au mode des règles puis retour : accélérations recalculées", () => {
  const settings = orbit({ dimensions: 2, range: 50, rules: {} });
  const sim = createSimulation(settings, { width: 4000, height: 4000 });
  sim.step();
  settings.interaction = "rules";
  // Aucune règle : les corps vont tout droit (pas d'accélération résiduelle).
  const [vx, vy] = [sim.state.vx[1], sim.state.vy[1]];
  sim.step();
  assert.equal(sim.state.vx[1], vx);
  assert.equal(sim.state.vy[1], vy);
  settings.interaction = "gravity";
  sim.step();
  assert.notEqual(sim.state.vx[1], vx);
  assert.ok([...sim.state.x].every(Number.isFinite));
});

// --- Temps simulé, relecture de dt et substeps ---

test("temps simulé : somme des dt, relu à chaque pas, remis à 0 par un nouveau tirage", () => {
  const settings = orbit({ dimensions: 2 });
  const sim = createSimulation(settings, { width: 4000, height: 4000 });
  assert.equal(sim.time, 0);
  sim.step();
  assert.equal(sim.time, 1);
  settings.dt = 0.5;
  sim.step();
  assert.equal(sim.time, 1.5);
  settings.substeps = 4;
  assert.equal(sim.frame(), 4);
  assert.equal(sim.time, 3.5);
  settings.dt = 2;
  settings.substeps = 3;
  assert.equal(sim.frame(), 3);
  assert.equal(sim.time, 9.5);
  // Valeurs invalides : dt = 1, un sous-pas.
  settings.dt = -1;
  settings.substeps = 0;
  assert.equal(sim.frame(), 1);
  assert.equal(sim.time, 10.5);
  sim.reseed();
  assert.equal(sim.time, 0);
});

test("dt modifié en direct change le mouvement dès le pas suivant", () => {
  const a = orbit({ dimensions: 2 });
  const b = orbit({ dimensions: 2 });
  const simA = createSimulation(a, { width: 4000, height: 4000 });
  const simB = createSimulation(b, { width: 4000, height: 4000 });
  simA.step();
  simB.step();
  assert.deepEqual(snapshot(simA), snapshot(simB));
  const y0 = simA.state.y[1];
  b.dt = 0.1;
  simA.step();
  simB.step();
  // Déplacement du pas : environ dix fois plus court.
  const ratio = (simB.state.y[1] - y0) / (simA.state.y[1] - y0);
  assert.ok(Math.abs(ratio - 0.1) < 1e-3, `rapport ${ratio}`);
});

test("timeStepOf et substepsOf : valeurs par défaut et bornes", () => {
  assert.equal(timeStepOf({}), 1);
  assert.equal(timeStepOf({ dt: 0.25 }), 0.25);
  for (const dt of [0, -1, NaN, Infinity, "2"]) assert.equal(timeStepOf({ dt }), 1);
  assert.equal(substepsOf({}), 1);
  assert.equal(substepsOf({ substeps: 7 }), 7);
  assert.equal(substepsOf({ substeps: 7.9 }), 7);
  assert.equal(substepsOf({ substeps: 1e9 }), MAX_SUBSTEPS);
  for (const substeps of [0, -3, NaN, "x"]) assert.equal(substepsOf({ substeps }), 1);
});

// --- Réglage en direct (panneau) et validation ---

test("réglage en direct du pas de temps et des sous-pas", () => {
  const settings = {};
  assert.deepEqual(setTimeStep(settings, "0,5"), { ok: true });
  assert.equal(settings.dt, 0.5);
  for (const bad of ["0", "-1", "", "abc", Infinity]) {
    assert.equal(setTimeStep(settings, bad).ok, false);
    assert.equal(settings.dt, 0.5);
  }
  assert.deepEqual(setSubsteps(settings, "8"), { ok: true });
  assert.equal(settings.substeps, 8);
  for (const bad of ["0", "2,5", "", String(MAX_SUBSTEPS + 1), "-2"]) {
    assert.equal(setSubsteps(settings, bad).ok, false);
    assert.equal(settings.substeps, 8);
  }
  assert.deepEqual(setSubsteps(settings, String(MAX_SUBSTEPS)), { ok: true });
});

test("validation : dt et substeps facultatifs, bornés", () => {
  const preset = (patch) => ({
    title: "Orbite",
    description: "Deux corps",
    vignette: "orbite.svg",
    settings: { ...orbit(), ...patch },
  });
  assert.deepEqual(validatePreset(preset({})), []);
  assert.deepEqual(validatePreset(preset({ dt: 0.1, substeps: 10 })), []);
  assert.deepEqual(validatePreset(preset({ dt: 0 })), ["`settings.dt` : pas de temps > 0 attendu"]);
  assert.deepEqual(validatePreset(preset({ dt: "1" })), ["`settings.dt` : pas de temps > 0 attendu"]);
  const substepsError = `\`settings.substeps\` : entier de 1 à ${MAX_SUBSTEPS} attendu`;
  for (const substeps of [0, 1.5, MAX_SUBSTEPS + 1, "2"]) {
    assert.deepEqual(validatePreset(preset({ substeps })), [substepsError]);
  }
});

// --- Protocole du Worker ---

const createPort = () => {
  const sent = [];
  const port = {
    postMessage: (data) => sent.push({ data }),
    onmessage: null,
  };
  attachSimulation(port, { random: seeded() });
  const send = (data) => port.onmessage({ data });
  return { sent, send };
};

test("worker : un pas d'image = substeps pas de dt, temps simulé envoyé", () => {
  const { sent, send } = createPort();
  send({ type: "init", settings: orbit({ dimensions: 2, dt: 0.5, substeps: 4 }), width: 4000, height: 4000 });
  const init = sent[0].data;
  let positions = sent[1].data;
  assert.equal(positions.time, 0);
  send({ type: "step", positions: positions.positions, generation: init.generation });
  positions = sent.at(-1).data;
  assert.equal(positions.steps, 1);
  assert.equal(positions.time, 2);
  // Réglage modifié en direct : pris en compte à l'image suivante.
  send({ type: "settings", settings: { dt: 1, substeps: 3 } });
  send({ type: "step", positions: positions.positions, generation: init.generation });
  positions = sent.at(-1).data;
  assert.equal(positions.steps, 2);
  assert.equal(positions.time, 5);
  send({ type: "reseed" });
  assert.equal(sent.at(-1).data.time, 0);
});

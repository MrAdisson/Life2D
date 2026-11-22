// Tests LIFE-19 : éléments orbitaux → positions et vitesses (orbital-elements.js),
// données du système solaire (solar-system.js) et outil de génération.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createSimulation } from "./engine.js";
import { validatePreset } from "./presets.js";
import {
  DAYS_PER_YEAR,
  GAUSS_K,
  keplerPeriod,
  perihelionState,
  systemStates,
  unitSystem,
} from "./orbital-elements.js";
import { SOLAR_SYSTEM, solarSystemBlock, solarSystemBodies } from "./solar-system.js";

const norm = (v) => Math.hypot(...v);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// Simulation du bloc généré, dans une boîte qui contient toutes les orbites.
const simulate = (block, dt) => {
  const settings = {
    interaction: "gravity",
    G: block.G,
    epsilon: block.epsilon,
    friction: 1,
    dt,
    dimensions: 3,
    depth: block.depth,
    types: block.types,
  };
  return createSimulation(settings, {
    width: block.depth,
    height: block.depth,
    random: () => 0.5,
  });
};

const vec = (s, i) => [s.x[i], s.y[i], s.z[i]];
const vel = (s, i) => [s.vx[i], s.vy[i], s.vz[i]];

// Indice moteur de chaque corps (un type par corps, une particule par type).
const indexOf = (sim, typeIndex) => {
  for (let i = 0; i < sim.count; i++) if (sim.typeIndex[i] === typeIndex) return i;
  throw new Error(`type ${typeIndex} absent`);
};

const energy = (sim, G, epsilon) => {
  const s = sim.state;
  let e = 0;
  for (let i = 0; i < sim.count; i++) {
    e += 0.5 * s.mass[i] * dot(vel(s, i), vel(s, i));
    for (let j = i + 1; j < sim.count; j++) {
      const d = [s.x[j] - s.x[i], s.y[j] - s.y[i], s.z[j] - s.z[i]];
      e -= (G * s.mass[i] * s.mass[j]) / Math.sqrt(dot(d, d) + epsilon ** 2);
    }
  }
  return e;
};

const momentum = (sim) => {
  const s = sim.state;
  const p = [0, 0, 0];
  let scale = 0;
  for (let i = 0; i < sim.count; i++) {
    for (let d = 0; d < 3; d++) p[d] += s.mass[i] * vel(s, i)[d];
    scale += s.mass[i] * norm(vel(s, i));
  }
  return { p, scale };
};

test("unités : G cohérent avec la constante de Gauss, en jours ou en années", () => {
  const day = unitSystem();
  assert.equal(day.au, 100);
  assert.equal(day.label, "jours");
  assert.equal(day.G, GAUSS_K ** 2 * 100 ** 3);
  const year = unitSystem({ au: 1, time: "year" });
  assert.equal(year.label, "années");
  // En UA, années et masses solaires : G ≈ 4π² (3ᵉ loi de Kepler : T² = a³).
  assert.ok(Math.abs(year.G / (4 * Math.PI ** 2) - 1) < 1e-4);
  assert.ok(Math.abs(keplerPeriod(1, year.G, year) - 1) < 1e-4);
  assert.ok(Math.abs(keplerPeriod(1, day.G, day) / DAYS_PER_YEAR - 1) < 1e-4);
  assert.throws(() => unitSystem({ au: 0 }), /UA/);
  assert.throws(() => unitSystem({ time: "heure" }), /day/);
});

test("vis-viva au périhélie : distance a(1−e), vitesse perpendiculaire", () => {
  const units = unitSystem({ au: 10 });
  const mu = units.G;
  const elements = { a: 2, e: 0.3, i: 20, node: 40, periapsis: 70 };
  const { position, velocity } = perihelionState(elements, mu, units);
  const r = norm(position);
  assert.ok(Math.abs(r - 2 * 10 * 0.7) < 1e-9);
  assert.ok(Math.abs(dot(position, velocity)) < 1e-9 * r * norm(velocity));
  // Énergie spécifique de l'orbite : v²/2 − mu/r = −mu/(2a).
  const specific = dot(velocity, velocity) / 2 - mu / r;
  assert.ok(Math.abs(specific / (-mu / (2 * 20)) - 1) < 1e-12);
  // Inclinaison : angle entre le moment cinétique et l'axe z.
  const h = cross(position, velocity);
  assert.ok(Math.abs(Math.acos(h[2] / norm(h)) * (180 / Math.PI) - 20) < 1e-9);
  // Sans inclinaison ni angles : périhélie sur +x, vitesse sur +y, z = 0.
  const flat = perihelionState({ a: 1, e: 0 }, mu, units);
  assert.deepEqual(flat.position.map((c) => Math.round(c * 1e9) / 1e9), [10, 0, 0]);
  assert.ok(flat.velocity[1] > 0 && Math.abs(flat.velocity[0]) < 1e-12);
  assert.throws(() => perihelionState({ a: 1, e: 1 }, mu, units), /excentricité/);
});

test("système ramené au barycentre : centre de masse au centre, quantité de mouvement nulle", () => {
  const units = unitSystem();
  const states = systemStates(solarSystemBodies(), { units, center: [5, 6, 7] });
  const com = [0, 0, 0];
  const p = [0, 0, 0];
  let total = 0;
  for (const s of states) {
    total += s.mass;
    for (let d = 0; d < 3; d++) {
      com[d] += s.mass * s.position[d];
      p[d] += s.mass * s.velocity[d];
    }
  }
  com.forEach((c, d) => assert.ok(Math.abs(c / total - [5, 6, 7][d]) < 1e-9));
  p.forEach((c) => assert.ok(Math.abs(c) < 1e-15));
  assert.throws(() => systemStates(SOLAR_SYSTEM.slice(1), { units }), /central/);
});

test("données : Soleil + 8 planètes, Pluton en option, sans Lune ; bloc valide", () => {
  const names = solarSystemBlock().types.map((t) => t.name);
  assert.deepEqual(names, [
    "Soleil", "Mercure", "Vénus", "Terre", "Mars",
    "Jupiter", "Saturne", "Uranus", "Neptune",
  ]);
  assert.equal(solarSystemBlock({ pluto: true }).types.at(-1).name, "Pluton");
  for (const body of SOLAR_SYSTEM) {
    assert.match(body.color, /^#[0-9a-f]{6}$/);
    assert.ok(body.displayRadius > 0 && body.mass > 0, body.name);
  }
  const block = solarSystemBlock({ pluto: true });
  assert.equal(block.types[0].emissive, true);
  const preset = {
    title: "Essai",
    description: "Essai.",
    vignette: "vignettes/essai.svg",
    settings: { interaction: "gravity", friction: 1, dimensions: 3, ...block },
  };
  assert.deepEqual(validatePreset(preset), []);
  // Toutes les positions sont dans la boîte [0, depth]³.
  for (const t of block.types) {
    for (const c of t.bodies[0].position) assert.ok(c > 0 && c < block.depth, t.name);
  }
});

test("3ᵉ loi de Kepler : périodes simulées de Mercure à Mars à 2 % près", () => {
  const block = solarSystemBlock();
  const dt = 0.25; // jours
  const sim = simulate(block, dt);
  const sun = indexOf(sim, 0);
  const planets = [1, 2, 3, 4].map((k) => {
    const body = SOLAR_SYSTEM[k];
    const i = indexOf(sim, k);
    const r0 = vec(sim.state, i).map((c, d) => c - vec(sim.state, sun)[d]);
    const v0 = vel(sim.state, i).map((c, d) => c - vel(sim.state, sun)[d]);
    const h = cross(r0, v0);
    const n = h.map((c) => c / norm(h));
    const units = unitSystem();
    return {
      name: body.name,
      i,
      n,
      previous: r0,
      angle: 0,
      expected: keplerPeriod(body.elements.a, units.G * (1 + body.mass), units),
      laps: [],
    };
  });
  const until = 1.1 * planets.at(-1).expected; // un peu plus d'une orbite de Mars
  let t = 0;
  while (t < until) {
    sim.step();
    t += dt;
    for (const p of planets) {
      const r = vec(sim.state, p.i).map((c, d) => c - vec(sim.state, sun)[d]);
      const step = Math.atan2(dot(cross(p.previous, r), p.n), dot(p.previous, r));
      const before = p.angle;
      p.angle += step;
      // Passage d'un tour complet : interpolation linéaire dans le pas.
      const lap = 2 * Math.PI * (p.laps.length + 1);
      if (before < lap && p.angle >= lap) {
        p.laps.push(t - dt + (dt * (lap - before)) / step);
      }
      p.previous = r;
    }
  }
  for (const p of planets) {
    assert.ok(p.laps.length >= 1, `${p.name} : aucun tour complet`);
    const period = p.laps.at(-1) / p.laps.length;
    const error = Math.abs(period / p.expected - 1);
    assert.ok(error < 0.02, `${p.name} : ${period.toFixed(2)} j au lieu de ${p.expected.toFixed(2)} j`);
  }
});

test("énergie et quantité de mouvement : variation < 1 % sur un an simulé", () => {
  const block = solarSystemBlock();
  const dt = 0.25;
  const sim = simulate(block, dt);
  const e0 = energy(sim, block.G, block.epsilon);
  const { p: p0, scale } = momentum(sim);
  const steps = Math.round(DAYS_PER_YEAR / dt);
  for (let k = 0; k < steps; k++) sim.step();
  assert.ok(Math.abs(sim.time - DAYS_PER_YEAR) < 1e-6);
  const e1 = energy(sim, block.G, block.epsilon);
  assert.ok(Math.abs(e1 / e0 - 1) < 0.01, `énergie : ${e0} → ${e1}`);
  const { p: p1 } = momentum(sim);
  const drift = norm(p1.map((c, d) => c - p0[d]));
  assert.ok(drift < 0.01 * scale, `quantité de mouvement : écart ${drift}, échelle ${scale}`);
});

test("outil : sortie déterministe, identique à solarSystemBlock", () => {
  const run = (...args) =>
    execFileSync(process.execPath, ["tools/make-solar-system.js", ...args], { encoding: "utf8" });
  const first = run();
  assert.equal(run(), first);
  assert.equal(first, `${JSON.stringify(solarSystemBlock(), null, 2)}\n`);
  const years = run("--temps", "annee", "--ua", "50", "--pluton", "--centre", "0,0,0");
  assert.equal(
    years,
    `${JSON.stringify(solarSystemBlock({ time: "year", au: 50, pluto: true, center: [0, 0, 0] }), null, 2)}\n`,
  );
  assert.deepEqual(solarSystemBlock(), solarSystemBlock());
});

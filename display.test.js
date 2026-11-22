import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TRAIL_MAX_BODIES,
  TRAIL_VERTEX_FLOATS,
  createTrails,
  displayOf,
  setDisplayFlag,
  setSizeFactor,
  setTrailLength,
  trailsAvailable,
} from "./display.js";
import { createCamera, resetCamera, viewProjection, project } from "./camera.js";
import { attachSimulation } from "./simulation-host.js";
import { validatePreset } from "./presets.js";
import { readFileSync } from "node:fs";

test("réglage d'affichage : valeurs par défaut et bornes", () => {
  assert.deepEqual(displayOf({}), {
    sizeFactor: 1,
    trails: false,
    trailLength: 100,
    labels: false,
    zoom: 1,
  });
  // Zoom de départ : borné comme celui de la caméra.
  assert.equal(displayOf({ display: { zoom: 3 } }).zoom, 3);
  assert.equal(displayOf({ display: { zoom: 1000 } }).zoom, 1);
  assert.equal(displayOf({ display: { zoom: 0 } }).zoom, 1);
  const s = {};
  assert.equal(setSizeFactor(s, "2,5").ok, true);
  assert.equal(displayOf(s).sizeFactor, 2.5);
  assert.equal(setSizeFactor(s, "0").ok, false);
  assert.equal(setSizeFactor(s, "abc").ok, false);
  assert.equal(displayOf(s).sizeFactor, 2.5);
  assert.equal(setTrailLength(s, 1).ok, false);
  assert.equal(setTrailLength(s, 501).ok, false);
  assert.equal(setTrailLength(s, 200).ok, true);
  setDisplayFlag(s, "trails", true);
  assert.deepEqual(displayOf(s), { sizeFactor: 2.5, trails: true, trailLength: 200, labels: false, zoom: 1 });
});

test("traînées réservées aux préréglages à peu de corps", () => {
  assert.equal(trailsAvailable(TRAIL_MAX_BODIES), true);
  assert.equal(trailsAvailable(TRAIL_MAX_BODIES + 1), false);
});

test("traînées : garde les N dernières positions, de la plus ancienne à la plus récente", () => {
  const trails = createTrails(2, 3);
  for (let t = 1; t <= 5; t++) trails.push(Float32Array.of(t, 0, 0, -t, 0, 0));
  assert.equal(trails.filled, 3);
  const out = new Float32Array(trails.maxVertices * TRAIL_VERTEX_FLOATS);
  const n = trails.write(out, [[1, 0, 0, 1], [0, 1, 0, 1]]);
  assert.equal(n, 2 * 2 * 2); // 2 corps × 2 segments × 2 sommets
  const xs = [];
  for (let v = 0; v < n; v++) xs.push(out[v * TRAIL_VERTEX_FLOATS]);
  assert.deepEqual(xs, [3, 4, 4, 5, -3, -4, -4, -5]);
  // opacité croissante vers le présent
  assert.ok(out[6] < out[3 * TRAIL_VERTEX_FLOATS + 6]);
  assert.equal(out[3 * TRAIL_VERTEX_FLOATS + 6], 1);
});

test("traînées : rien à dessiner avant la deuxième position", () => {
  const trails = createTrails(1, 5);
  trails.push(Float32Array.of(1, 2, 3));
  assert.equal(trails.write(new Float32Array(100), [[1, 1, 1, 1]]), 0);
});

test("caméra : suivre un corps le place au centre de l'écran", () => {
  const box = { width: 800, height: 600, depth: 600 };
  const camera = createCamera();
  camera.yaw = 0.7;
  camera.pitch = 0.3;
  camera.target = [120, 80, 40];
  const { matrix } = viewProjection(camera, box);
  const p = project(matrix, box, 120, 80, 40);
  assert.ok(Math.abs(p.x - 400) < 1e-3 && Math.abs(p.y - 300) < 1e-3);
  camera.follow = 3;
  resetCamera(camera);
  assert.equal(camera.follow, null);
  assert.equal(camera.target, null);
});

test("caméra sans cible : identique à la boîte centrée", () => {
  const box = { width: 800, height: 600, depth: 600 };
  const { matrix } = viewProjection(createCamera(), box);
  const p = project(matrix, box, 400, 300, 300);
  assert.ok(Math.abs(p.x - 400) < 1e-3 && Math.abs(p.y - 300) < 1e-3);
});

test("protocole du Worker : noms et astres émissifs", () => {
  const messages = [];
  const port = { postMessage: (m) => messages.push(m) };
  attachSimulation(port);
  const settings = {
    interaction: "gravity",
    epsilon: 1,
    friction: 1,
    dimensions: 3,
    types: [
      { name: "a", color: "red", count: 2, mass: 1, emissive: true },
      {
        name: "b",
        color: "blue",
        count: 2,
        mass: 5,
        bodies: [{ name: "Terre", position: [10, 10, 10], velocity: [0, 0, 0], emissive: false }],
      },
    ],
    rules: {},
  };
  port.onmessage({ data: { type: "init", settings, width: 100, height: 100 } });
  const init = messages.find((m) => m.type === "init");
  assert.equal(init.names.length, 4);
  assert.equal(init.names.filter((n) => n === "Terre").length, 1);
  assert.equal(init.names.filter((n) => n === null).length, 3);
  assert.equal(init.emissive.length, 4);
  // les deux particules du type « a » sont émissives, pas celles de « b »
  assert.equal(init.emissive.reduce((a, b) => a + b, 0), 2);
});

test("préréglage Système solaire : valide, avec noms, astre émissif et affichage", () => {
  const preset = JSON.parse(readFileSync("presets/systeme-solaire.json", "utf8"));
  assert.deepEqual(validatePreset(preset), []);
  const names = preset.settings.types.flatMap((t) => t.bodies.map((b) => b.name));
  assert.deepEqual(names, [
    "Soleil", "Mercure", "Vénus", "Terre", "Mars",
    "Jupiter", "Saturne", "Uranus", "Neptune",
  ]);
  assert.equal(preset.settings.types[0].emissive, true);
  assert.ok(trailsAvailable(names.length));
});

test("validation de display et emissive dans un préréglage", () => {
  const preset = JSON.parse(readFileSync("presets/systeme-solaire.json", "utf8"));
  preset.settings.display = { sizeFactor: 0, trailLength: 1.5, trails: "oui", zoom: 100 };
  preset.settings.types[0].emissive = "oui";
  const errors = validatePreset(preset).join("\n");
  assert.match(errors, /sizeFactor/);
  assert.match(errors, /trailLength/);
  assert.match(errors, /trails/);
  assert.match(errors, /zoom/);
  assert.match(errors, /emissive/);
});

test("réglage par corps : sizeFactor et label dans le protocole et la validation", () => {
  const messages = [];
  const port = { postMessage: (m) => messages.push(m) };
  attachSimulation(port);
  const settings = {
    interaction: "gravity", epsilon: 1, friction: 1, dimensions: 3, rules: {},
    types: [{ name: "a", color: "red", count: 2, mass: 1,
      bodies: [{ name: "X", position: [1, 1, 1], velocity: [0, 0, 0], sizeFactor: 3, label: false }] }],
  };
  port.onmessage({ data: { type: "init", settings, width: 100, height: 100 } });
  const init = messages.find((m) => m.type === "init");
  const k = init.names.indexOf("X");
  assert.equal(init.sizes[k], 3);
  assert.equal(init.labelled[k], 0);
  assert.equal(init.sizes[1 - k], 1);
  assert.equal(init.labelled[1 - k], 1);
  const preset = JSON.parse(readFileSync("presets/systeme-solaire.json", "utf8"));
  preset.settings.types[1].bodies[0].sizeFactor = 0;
  preset.settings.types[1].bodies[0].label = "non";
  const errors = validatePreset(preset).join("\n");
  assert.match(errors, /sizeFactor/);
  assert.match(errors, /label/);
});

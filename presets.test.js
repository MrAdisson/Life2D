import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { parsePresets, validatePreset } from "./presets.js";
import { startSettings } from "./settings.js";
import { createSimulation } from "./engine.js";

const files = readdirSync("presets").filter((f) => f.endsWith(".json"));
const load = (f) => JSON.parse(readFileSync(`presets/${f}`, "utf8"));

test("au moins 16 préréglages, tous valides", () => {
  assert.ok(files.length >= 16);
  for (const f of files) assert.deepEqual(validatePreset(load(f)), [], f);
});

test("chaque vignette existe et chaque description tient en deux phrases", () => {
  for (const f of files) {
    const p = load(f);
    assert.ok(existsSync(`presets/${p.vignette}`), `${f} : vignette`);
    const sentences = p.description.split(/[.!?…]+(?:\s|$)/).filter(Boolean);
    assert.ok(sentences.length <= 2, `${f} : ${sentences.length} phrases`);
  }
});

test("les quatre phénomènes ont un préréglage", () => {
  const titles = files.map((f) => load(f).title.toLowerCase()).join("|");
  for (const word of ["amas", "membrane", "chasseurs", "cristallisation"]) {
    assert.ok(titles.includes(word), word);
  }
});

test("les phénomènes ajoutés par LIFE-10 ont un préréglage", () => {
  const titles = files.map((f) => load(f).title.toLowerCase()).join("|");
  for (const word of ["mousse", "cristal et impuretés", "émulsion", "nageurs", "brownien"]) {
    assert.ok(titles.includes(word), word);
  }
});

test("les titres sont uniques", () => {
  const titles = files.map((f) => load(f).title.trim().toLocaleLowerCase("fr"));
  assert.equal(new Set(titles).size, titles.length);
});

// Même budget que engine.perf.test.js (50 ms par pas, médiane de 7 pas),
// mesuré pour chaque préréglage avec ses propres nombres de particules.
test("chaque préréglage tient dans le budget de 50 ms par pas", () => {
  for (const f of files) {
    const settings = load(f).settings;
    const total = settings.types.reduce((n, t) => n + t.count, 0);
    if (total > 10000) continue; // le budget porte sur 10 000 particules
    let seed = 1;
    const sim = createSimulation(settings, {
      width: 1920,
      height: 1080,
      random: () => (seed = (seed * 16807) % 2147483647) / 2147483647,
    });
    for (let k = 0; k < 3; k++) sim.step();
    const times = [];
    for (let k = 0; k < 7; k++) {
      const t0 = performance.now();
      sim.step();
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    assert.ok(times[3] < 50, `${f} : pas médian ${times[3].toFixed(1)} ms`);
  }
});

test("un fichier invalide n'empêche pas les autres", () => {
  const good = readFileSync(`presets/${files[0]}`, "utf8");
  const bad = JSON.parse(good);
  bad.settings.rules.inconnu = { [bad.settings.types[0].name]: 1 };
  const { presets, errors } = parsePresets([
    { file: "a.json", text: "{ pas du json" },
    { file: "b.json", text: good },
    { file: "c.json", text: JSON.stringify(bad) },
    { file: "d.json", text: '{"title":"x"}' },
  ]);
  assert.equal(presets.length, 1);
  assert.deepEqual(errors.map((e) => e.file), ["a.json", "c.json", "d.json"]);
  assert.match(errors[0].messages[0], /JSON mal formé/);
});

test("types et règles incohérents sont refusés", () => {
  const base = () => structuredClone(load(files[0]));
  const cases = {
    "type en double": (p) => p.settings.types.push({ ...p.settings.types[0] }),
    "nombre négatif": (p) => (p.settings.types[0].count = -1),
    "règle non numérique": (p) => {
      const [a] = Object.keys(p.settings.rules);
      p.settings.rules[a][Object.keys(p.settings.rules[a])[0]] = "fort";
    },
    "friction hors 0-1": (p) => (p.settings.friction = 2),
    "titre manquant": (p) => delete p.title,
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const p = base();
    mutate(p);
    assert.notDeepEqual(validatePreset(p), [], name);
  }
});

test("réglage de départ : préréglage « Quatre familles », portée finie de 30 à 80 px", () => {
  const p = load("quatre-familles.json");
  const { edges, ...settings } = p.settings;
  assert.equal(edges, "bounce");
  assert.deepEqual(settings, startSettings);
  assert.ok(startSettings.range >= 30 && startSettings.range <= 80);
});

test("aucun préréglage ne démarre avec une portée illimitée", () => {
  for (const f of files) assert.ok(Number.isFinite(load(f).settings.range), f);
  const p = structuredClone(load(files[0]));
  delete p.settings.range;
  assert.notDeepEqual(validatePreset(p), []);
  p.settings.range = 50;
  p.settings.gravity = "fort";
  assert.notDeepEqual(validatePreset(p), []);
  p.settings.gravity = 0.1;
  assert.deepEqual(validatePreset(p), []);
});

test("`dimensions` (2 ou 3) et `depth` (> 0) sont acceptés, le reste refusé", () => {
  const base = load("quatre-familles.json");
  const withSettings = (patch) => ({ ...base, settings: { ...base.settings, ...patch } });
  assert.deepEqual(validatePreset(withSettings({ dimensions: 2 })), []);
  assert.deepEqual(validatePreset(withSettings({ dimensions: 3, depth: 400 })), []);
  assert.deepEqual(validatePreset(withSettings({ dimensions: 3 })), []);
  for (const dimensions of [1, 4, "3", null]) {
    assert.match(validatePreset(withSettings({ dimensions })).join(), /dimensions/);
  }
  for (const depth of [0, -5, "400", Infinity]) {
    assert.match(validatePreset(withSettings({ dimensions: 3, depth })).join(), /depth/);
  }
});

test("au moins un préréglage utilise la 3D, accessible depuis la galerie", () => {
  const in3d = files.filter((f) => load(f).settings.dimensions === 3);
  assert.ok(in3d.length >= 1);
  for (const f of in3d) assert.deepEqual(validatePreset(load(f)), [], f);
});

// LIFE-20 : préréglage « Système solaire » (données de LIFE-19).
test("Système solaire : 3D, gravitation, corps de solar-system.js, traînées et étiquettes", async () => {
  const { solarSystemBlock } = await import("./solar-system.js");
  const p = load("systeme-solaire.json");
  assert.deepEqual(validatePreset(p), []);
  assert.match(p.title, /Système solaire/);
  assert.ok(existsSync(`presets/${p.vignette}`));
  const s = p.settings;
  assert.equal(s.dimensions, 3);
  assert.equal(s.interaction, "gravity");
  assert.equal(s.friction, 1);
  // Bloc identique à celui de l'outil (node tools/make-solar-system.js
  // --epaisseur 300 --preset presets/systeme-solaire.json).
  const block = solarSystemBlock({ thickness: s.depth });
  for (const key of ["G", "epsilon", "timeUnit", "width", "height", "depth", "types"]) {
    assert.deepEqual(s[key], block[key], key);
  }
  assert.deepEqual(
    s.types.map((t) => t.name),
    ["Soleil", "Mercure", "Vénus", "Terre", "Mars", "Jupiter", "Saturne", "Uranus", "Neptune"],
  );
  assert.equal(s.types[0].emissive, true);
  assert.equal(s.display.trails, true);
  assert.equal(s.display.labels, true);
  // Vitesse de départ lisible : une année terrestre en 20 à 60 s à 60 images
  // par seconde (temps simulé par image = substeps × dt, en jours).
  assert.equal(s.timeUnit, "jours");
  assert.equal(s.speed ?? 1, 1);
  const secondsPerYear = 365.25 / ((s.substeps ?? 1) * s.dt) / 60;
  assert.ok(secondsPerYear >= 20 && secondsPerYear <= 60, `${secondsPerYear.toFixed(1)} s`);
  // Toutes les orbites tiennent dans l'espace fixé par le préréglage.
  const sim = createSimulation(s, { width: 1280, height: 720, random: () => 0.5 });
  assert.equal(sim.width, s.width);
  assert.equal(sim.height, s.height);
  assert.equal(sim.depth, s.depth);
});

test("`width` et `height` (taille de l'espace) : nombres finis > 0", () => {
  const base = load("systeme-solaire.json");
  const withSettings = (patch) => ({ ...base, settings: { ...base.settings, ...patch } });
  assert.deepEqual(validatePreset(withSettings({ width: 100, height: 50 })), []);
  for (const bad of [0, -1, "100", Infinity, null]) {
    assert.match(validatePreset(withSettings({ width: bad })).join(), /width/);
    assert.match(validatePreset(withSettings({ height: bad })).join(), /height/);
  }
});

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

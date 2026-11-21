import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { parsePresets, validatePreset } from "./presets.js";
import { startSettings } from "./settings.js";

const files = readdirSync("presets").filter((f) => f.endsWith(".json"));
const load = (f) => JSON.parse(readFileSync(`presets/${f}`, "utf8"));

test("au moins 8 préréglages, tous valides", () => {
  assert.ok(files.length >= 8);
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

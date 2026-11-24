import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { CATEGORIES, groupByCategory, parsePresets, validatePreset } from "./presets.js";
import { startSettings } from "./settings.js";
import { createSimulation } from "./engine.js";

const files = readdirSync("presets").filter((f) => f.endsWith(".json"));
const load = (f) => JSON.parse(readFileSync(`presets/${f}`, "utf8"));

// LIFE-23 : 18 − 1 (fusion des amas 2D / 3D) + 3 « effet wow » + page blanche.
test("21 préréglages, tous valides", () => {
  assert.equal(files.length, 21);
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
  const good = readFileSync("presets/quatre-familles.json", "utf8");
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
  const base = () => structuredClone(load("quatre-familles.json"));
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
  const p = structuredClone(load("quatre-familles.json"));
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

// LIFE-23 : catégories (liste fermée), galerie groupée par catégorie.
test("chaque préréglage a une catégorie de la liste fermée, aucune catégorie vide", () => {
  const ids = CATEGORIES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  const used = new Set(files.map((f) => load(f).category));
  for (const f of files) assert.ok(ids.includes(load(f).category), f);
  for (const id of ids) assert.ok(used.has(id), `catégorie ${id} sans préréglage`);
});

test("catégorie manquante ou inconnue : carte d'erreur, sans bloquer les autres", () => {
  const good = load("orbites.json");
  const { category, ...missing } = good;
  assert.equal(category, "astronomie");
  const unknown = { ...good, title: "Autre", category: "cuisine" };
  const { presets, errors } = parsePresets([
    { file: "sans.json", text: JSON.stringify(missing) },
    { file: "bon.json", text: JSON.stringify(good) },
    { file: "inconnue.json", text: JSON.stringify(unknown) },
    { file: "vide.json", text: JSON.stringify({ ...good, category: "" }) },
  ]);
  assert.deepEqual(presets.map((p) => p.file), ["bon.json"]);
  assert.deepEqual(errors.map((e) => e.file), ["sans.json", "inconnue.json", "vide.json"]);
  assert.match(errors[0].messages.join(), /category/);
  assert.match(errors[1].messages.join(), /cuisine.*inconnue/);
});

test("galerie : groupes dans l'ordre des catégories, cartes triées par titre, aucun groupe vide", () => {
  const { presets, errors } = parsePresets(
    files.map((file) => ({ file, text: readFileSync(`presets/${file}`, "utf8") })),
  );
  assert.deepEqual(errors, []);
  const groups = groupByCategory(presets);
  assert.deepEqual(
    groups.map((g) => g.id),
    CATEGORIES.map((c) => c.id),
  );
  assert.equal(groups.reduce((n, g) => n + g.presets.length, 0), files.length);
  for (const g of groups) {
    assert.ok(g.presets.length > 0, g.id);
    assert.ok(g.title.trim() !== "");
    const titles = g.presets.map((p) => p.title);
    assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b, "fr")), g.id);
    for (const p of g.presets) assert.equal(p.category, g.id);
  }
  // Une catégorie sans préréglage n'est pas affichée.
  const onlyOrbits = groupByCategory(presets.filter((p) => p.file === "orbites.json"));
  assert.deepEqual(onlyOrbits.map((g) => g.id), ["astronomie"]);
});

test("amas gravitationnels : une seule carte, en 3D, que le commutateur fait passer en 2D", () => {
  const amas = files.filter((f) => /amas/i.test(load(f).title));
  assert.deepEqual(amas, ["amas-gravitationnels.json"]);
  assert.ok(!existsSync("presets/amas-gravitationnels-3d.json"));
  const s = load("amas-gravitationnels.json").settings;
  assert.equal(s.dimensions, 3);
  // Le commutateur change seulement `dimensions` : le même réglage tourne en 2D,
  // dans le budget de 50 ms par pas.
  const flat = { ...s, dimensions: 2 };
  assert.deepEqual(validatePreset({ ...load("amas-gravitationnels.json"), settings: flat }), []);
  const sim = createSimulation(flat, { width: 1920, height: 1080, random: () => 0.5 });
  assert.equal(sim.dimensions, 2);
});

test("aucune vignette orpheline dans presets/vignettes/", () => {
  const used = new Set(files.map((f) => load(f).vignette.replace(/^vignettes\//, "")));
  for (const v of readdirSync("presets/vignettes")) assert.ok(used.has(v), v);
});

test("nouveaux préréglages « effet wow » (LIFE-23) : 3D, gravitation et grand nombre", () => {
  const wow = [
    "collision-de-galaxies.json",
    "ronde-des-cinq-tribus.json",
    "gouttes-en-apesanteur.json",
  ];
  for (const f of wow) {
    const p = load(f);
    assert.deepEqual(validatePreset(p), [], f);
    assert.ok(existsSync(`presets/${p.vignette}`), f);
    assert.equal(p.settings.dimensions, 3, f);
  }
  assert.equal(load("collision-de-galaxies.json").settings.interaction, "gravity");
  // Nettement plus que le plus grand des préréglages d'avant (2 505 particules).
  const total = (f) => load(f).settings.types.reduce((n, t) => n + t.count, 0);
  assert.equal(total("ronde-des-cinq-tribus.json"), 10000);
  assert.ok(total("gouttes-en-apesanteur.json") >= 9000);
});

test("Page blanche : un seul type, aucune règle, pour partir de zéro", () => {
  const p = load("page-blanche.json");
  assert.equal(p.category, "base");
  assert.equal(p.settings.types.length, 1);
  for (const row of Object.values(p.settings.rules)) {
    for (const g of Object.values(row)) assert.equal(g, 0);
  }
});

// Budget du mode gravité (engine.perf.test.js) : 5 ms par pas à 200 corps.
test("chaque préréglage en gravitation tient dans 200 corps et 5 ms par pas", () => {
  for (const f of files) {
    const settings = load(f).settings;
    if (settings.interaction !== "gravity") continue;
    const total = settings.types.reduce((n, t) => n + t.count, 0);
    assert.ok(total <= 200, `${f} : ${total} corps`);
    const sim = createSimulation(settings, { width: 1920, height: 1080, random: () => 0.5 });
    for (let k = 0; k < 5; k++) sim.step();
    const times = [];
    for (let k = 0; k < 21; k++) {
      const t0 = performance.now();
      sim.step();
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    assert.ok(times[10] < 5, `${f} : pas médian ${times[10].toFixed(2)} ms`);
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

test("`collisions` : booléen accepté, toute autre valeur refusée avec un message clair", () => {
  const base = load("quatre-familles.json");
  const withSettings = (patch) => ({ ...base, settings: { ...base.settings, ...patch } });
  assert.deepEqual(validatePreset(withSettings({ collisions: true })), []);
  assert.deepEqual(validatePreset(withSettings({ collisions: false })), []);
  for (const collisions of ["true", 1, null, {}]) {
    assert.deepEqual(validatePreset(withSettings({ collisions })), [
      "`settings.collisions` : booléen attendu (true ou false)",
    ]);
  }
});

test("collisions activées sur « Mouvement brownien » et « Amas gravitationnels » seulement", () => {
  const withCollisions = files.filter((f) => load(f).settings.collisions === true).sort();
  assert.deepEqual(withCollisions, ["amas-gravitationnels.json", "mouvement-brownien.json"]);
  // Système solaire : rayons d'affichage exagérés, pas des tailles physiques.
  assert.equal(load("systeme-solaire.json").settings.collisions, undefined);
});

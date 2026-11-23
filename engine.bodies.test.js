// Tests LIFE-13 : corps à position et vitesse initiales explicites
// (`type.bodies`), nouveau tirage, validation et protocole du Worker.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { createSimulation } from "./engine.js";
import { validatePreset } from "./presets.js";
import { setCount } from "./settings-edit.js";
import { attachSimulation } from "./simulation-host.js";

const seeded = (seed = 1) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

const SIZE = { width: 1000, height: 800 };

// Un « soleil » immobile et deux planètes placés, plus 3 particules tirées.
const bodySettings = (patch = {}) => ({
  epsilon: 10,
  friction: 1,
  range: 400,
  edges: "wrap",
  types: [
    {
      name: "astre",
      color: "yellow",
      count: 5,
      mass: 2,
      bodies: [
        { name: "Soleil", position: [500, 400, 300], velocity: [0, 0, 0], mass: 40, radius: 12 },
        { name: "Terre", position: [700, 400, 300], velocity: [0, 1.5, -0.25] },
        { position: [500, 250], velocity: [-1, 0], radius: 4 },
      ],
    },
    { name: "poussière", color: "grey", count: 4, mass: 1 },
  ],
  rules: { astre: { astre: -0.5, poussière: 0 }, poussière: { astre: -0.1 } },
  ...patch,
});

const at = (sim, i) => {
  const s = sim.state;
  return [s.x[i], s.y[i], s.z[i], s.vx[i], s.vy[i], s.vz[i]];
};

test("corps explicites : état exact au démarrage (2D, z ignoré)", () => {
  const sim = createSimulation(bodySettings(), { ...SIZE, random: seeded() });
  assert.equal(sim.count, 9);
  assert.deepEqual(at(sim, 0), [500, 400, 0, 0, 0, 0]);
  assert.deepEqual(at(sim, 1), [700, 400, 0, 0, 1.5, 0]);
  assert.deepEqual(at(sim, 2), [500, 250, 0, -1, 0, 0]);
  // Masse : celle du corps, sinon celle du type ; rayon fixé ou dérivé.
  assert.deepEqual([...sim.state.mass.subarray(0, 3)], [40, 2, 2]);
  assert.deepEqual([...sim.state.radius.subarray(0, 3)], [12, 3, 4]);
  // Les particules sans corps sont tirées au hasard, vitesse nulle.
  for (let i = 3; i < 9; i++) {
    assert.ok(sim.state.x[i] >= 0 && sim.state.x[i] < SIZE.width);
    assert.equal(sim.state.vx[i], 0);
  }
});

test("corps explicites : état exact au démarrage en 3D", () => {
  const sim = createSimulation(bodySettings({ dimensions: 3, depth: 600 }), {
    ...SIZE,
    random: seeded(),
  });
  assert.deepEqual(at(sim, 0), [500, 400, 300, 0, 0, 0]);
  assert.deepEqual(at(sim, 1), [700, 400, 300, 0, 1.5, -0.25]);
  assert.deepEqual(at(sim, 2), [500, 250, 0, -1, 0, 0]); // [x, y] : z = 0
});

test("corps explicites : aucun tirage consommé, les autres particules inchangées", () => {
  const withBodies = createSimulation(bodySettings(), { ...SIZE, random: seeded(7) });
  const plain = bodySettings();
  plain.types[0].count = 2;
  delete plain.types[0].bodies;
  const without = createSimulation(plain, { ...SIZE, random: seeded(7) });
  // Particules 3..8 (avec corps) = particules 0..5 (sans corps).
  for (let k = 0; k < 6; k++) {
    assert.deepEqual(at(withBodies, 3 + k), at(without, k));
    assert.equal(withBodies.state.mass[3 + k], without.state.mass[k]);
  }
});

test("corps explicites : la vitesse donnée fait avancer le corps dès le premier pas", () => {
  const settings = bodySettings({ rules: {} });
  const sim = createSimulation(settings, { ...SIZE, random: seeded() });
  sim.step();
  assert.deepEqual(at(sim, 1).slice(0, 2), [700, 401.5]);
  assert.deepEqual(at(sim, 2).slice(0, 2), [499, 250]);
});

test("reseed : rétablit les corps et ne tire que les autres particules", () => {
  for (const dimensions of [2, 3]) {
    const sim = createSimulation(bodySettings({ dimensions }), { ...SIZE, random: seeded(3) });
    const start = Array.from({ length: 3 }, (_, i) => at(sim, i));
    const masses = [...sim.state.mass];
    for (let k = 0; k < 20; k++) sim.step();
    assert.notDeepEqual(at(sim, 1), start[1]);
    const before = Array.from({ length: 9 }, (_, i) => at(sim, i));
    let draws = 0;
    const random = seeded(11);
    // Remplace le générateur : on compte les tirages du nouveau tirage.
    const counting = createSimulation(bodySettings({ dimensions }), {
      ...SIZE,
      random: () => {
        draws++;
        return random();
      },
    });
    draws = 0;
    counting.reseed();
    // Seules les 6 particules sans corps sont tirées (x, y, et z en 3D).
    assert.equal(draws, 6 * dimensions, `${dimensions}D`);
    sim.reseed();
    for (let i = 0; i < 3; i++) assert.deepEqual(at(sim, i), start[i], `${dimensions}D corps ${i}`);
    for (let i = 3; i < 9; i++) {
      assert.notDeepEqual(at(sim, i), before[i]);
      assert.deepEqual(at(sim, i).slice(3), [0, 0, 0]);
    }
    assert.deepEqual([...sim.state.mass], masses);
    assert.equal(sim.state.ax[1], 0);
  }
});

test("nombre en baisse : les premiers corps sont gardés, puis recréés à leur état", () => {
  const settings = bodySettings();
  const sim = createSimulation(settings, { ...SIZE, random: seeded() });
  for (let k = 0; k < 5; k++) sim.step();
  const moved = at(sim, 0);
  setCount(settings, "astre", 1);
  assert.equal(sim.sync(), true);
  assert.equal(sim.groups.get("astre").length, 1);
  assert.deepEqual(at(sim, 0), moved); // le premier corps garde son état courant
  setCount(settings, "astre", 4);
  sim.sync();
  assert.deepEqual(at(sim, 1), [700, 400, 0, 0, 1.5, 0]); // recréé à l'état donné
  assert.deepEqual(at(sim, 2), [500, 250, 0, -1, 0, 0]);
  assert.equal(sim.state.radius[2], 4);
  assert.equal(sim.state.vx[3], 0); // 4e : tirée au hasard
  sim.reseed();
  assert.deepEqual(at(sim, 0), [500, 400, 0, 0, 0, 0]);
  // Nombre à 0 puis remonté : rien ne casse.
  setCount(settings, "astre", 0);
  sim.sync();
  sim.step();
  sim.reseed();
  assert.equal(sim.count, 4);
});

test("nouvelle masse fixe du type : un corps garde sa masse et son rayon propres", () => {
  const settings = bodySettings();
  const sim = createSimulation(settings, { ...SIZE, random: seeded() });
  settings.types[0].mass = 10;
  sim.sync();
  assert.deepEqual([...sim.state.mass.subarray(0, 4)], [40, 10, 10, 10]);
  assert.deepEqual([...sim.state.radius.subarray(0, 4)], [12, 7, 4, 7]);
});

// Empreintes de l'état (5 pas, nouveau tirage entre les deux) calculées avec
// le moteur d'avant LIFE-13 : les préréglages existants restent identiques au
// bit près. LIFE-23 a changé les nombres de particules de la plupart des
// préréglages et en a ajouté : leurs empreintes sont recalculées avec le
// moteur actuel (celles de « Cristal et impuretés » et « Quatre familles »,
// inchangés, sont toujours celles d'avant LIFE-13).
const FINGERPRINTS = {
  "amas-gravitationnels.json": "3955538e49d407f2",
  "cellules-membranes.json": "0ddc6c5a2e656d1f",
  "chasseurs-proies.json": "db3659cc18a6af6e",
  "cristal-et-impuretes.json": "1ba781a4ce82b613",
  "cristallisation.json": "419a8d6986d081f7",
  "emulsion.json": "ae0d37e249cf9a8d",
  "feu-d-artifice.json": "77d717367e2667a7",
  "gouttes-en-apesanteur.json": "e22a2cb3d4f8ce8a",
  "huile-et-eau.json": "d830a21aede02c68",
  "lucioles.json": "ff8e7d8087587f17",
  "mousse.json": "15a3b9a548c8ca83",
  "mouvement-brownien.json": "ded5956580f83a03",
  "nageurs.json": "6ec9b04ec60e10f5",
  "nebuleuse.json": "5fa72296ce89f1c6",
  "orbites.json": "80f377a701662f63",
  "page-blanche.json": "6fdb69592e1686bb",
  "quatre-familles.json": "dc22b060f57c7ae0",
  "ronde-des-cinq-tribus.json": "6fcf1bb726bde225",
  "trois-tribus.json": "2d316e7fca9fcbce",
};

const fingerprint = (settings) => {
  const sim = createSimulation(settings, { width: 1920, height: 1080, random: seeded() });
  for (let k = 0; k < 3; k++) sim.step();
  sim.reseed();
  for (let k = 0; k < 2; k++) sim.step();
  const h = createHash("sha256");
  for (const field of ["x", "y", "z", "vx", "vy", "vz", "mass", "radius"]) {
    h.update(new Uint8Array(sim.state[field].buffer));
  }
  return h.digest("hex").slice(0, 16);
};

test("préréglages existants : résultat identique au bit près (avec ou sans `bodies: []`)", () => {
  for (const [file, expected] of Object.entries(FINGERPRINTS)) {
    const settings = JSON.parse(readFileSync(`presets/${file}`, "utf8")).settings;
    assert.equal(fingerprint(settings), expected, file);
    for (const t of settings.types) t.bodies = [];
    assert.equal(fingerprint(settings), expected, `${file} avec bodies: []`);
  }
});

// --- Validation ---

const files = readdirSync("presets").filter((f) => f.endsWith(".json"));
const withBodies = (bodies, count = bodies.length) => {
  const p = JSON.parse(readFileSync("presets/quatre-familles.json", "utf8"));
  Object.assign(p.settings.types[0], { count, bodies });
  return p;
};

test("validation : un préréglage avec `bodies` valide est accepté", () => {
  assert.ok(files.length >= 16);
  assert.deepEqual(validatePreset(withBodies([{ position: [1, 2], velocity: [0, 0] }])), []);
  assert.deepEqual(
    validatePreset(
      withBodies(
        [{ name: "Terre", position: [1, 2, 3], velocity: [0.5, -1, 2], mass: 3, radius: 6 }],
        10,
      ),
    ),
    [],
  );
  assert.deepEqual(validatePreset(withBodies([], 0)), []);
});

test("validation : `bodies` incohérent est refusé avec un message en français", () => {
  const cases = [
    [withBodies("soleil"), /types\[0\]\.bodies` : liste attendue/],
    [withBodies([42]), /bodies\[0\]` : objet attendu/],
    [withBodies([{ velocity: [0, 0] }]), /bodies\[0\]\.position` : tableau de 2 ou 3 nombres attendu/],
    [withBodies([{ position: [1], velocity: [0, 0] }]), /position` : tableau de 2 ou 3 nombres/],
    [withBodies([{ position: [1, 2, 3, 4], velocity: [0, 0] }]), /position` : tableau de 2 ou 3/],
    [withBodies([{ position: [1, "2"], velocity: [0, 0] }]), /position` : tableau de 2 ou 3/],
    [withBodies([{ position: [1, 2], velocity: [0, null] }]), /velocity` : tableau de 2 ou 3/],
    [withBodies([{ position: [1, 2], velocity: [0, 0], mass: 0 }]), /mass` : nombre > 0 attendu/],
    [withBodies([{ position: [1, 2], velocity: [0, 0], radius: -1 }]), /radius` : nombre > 0 attendu/],
    [withBodies([{ name: "", position: [1, 2], velocity: [0, 0] }]), /name` : nom non vide attendu/],
    [
      withBodies([{ position: [1, 2], velocity: [0, 0] }, { position: [3, 4], velocity: [0, 0] }], 1),
      /count` : au moins 2 attendu \(un par corps de `bodies`\)/,
    ],
  ];
  for (const [preset, message] of cases) {
    assert.match(validatePreset(preset).join(" | "), message);
  }
});

// --- Protocole du Worker ---

const fakePort = () => {
  const sent = [];
  const port = { postMessage: (data) => sent.push(data) };
  return { sent, port, send: (data) => port.onmessage({ data }) };
};

// Position (x, y, z) d'une particule dans le tampon, d'après l'ordre d'affichage.
const positionOf = (init, positions, radius) => {
  const k = Array.from(init.radii).indexOf(radius);
  return Array.from(positions.subarray(3 * k, 3 * k + 3));
};

test("worker : « init » et « reseed » renvoient les corps à leur état donné", () => {
  const { sent, port, send } = fakePort();
  attachSimulation(port, { random: seeded() });
  send({ type: "init", settings: bodySettings({ dimensions: 3, depth: 600 }), ...SIZE });
  const [init, first] = sent;
  assert.equal(init.count, 9);
  assert.equal(init.radii[0], 12); // le plus massif (Soleil) d'abord
  assert.deepEqual(positionOf(init, first.positions, 12), [500, 400, 300]);
  assert.deepEqual(positionOf(init, first.positions, 4), [500, 250, 0]);
  for (let k = 0; k < 10; k++) {
    send({ type: "step", positions: new Float32Array(27), generation: init.generation });
  }
  assert.notDeepEqual(positionOf(init, sent.at(-1).positions, 4), [500, 250, 0]);
  send({ type: "reseed" });
  const [again, reset] = sent.slice(-2);
  assert.equal(again.type, "init");
  assert.equal(reset.steps, 10);
  assert.deepEqual(positionOf(again, reset.positions, 12), [500, 400, 300]);
  assert.deepEqual(positionOf(again, reset.positions, 4), [500, 250, 0]);
  // Le pas suivant applique la vitesse donnée (−1 sur x).
  send({ type: "step", positions: new Float32Array(27), generation: again.generation });
  assert.equal(positionOf(again, sent.at(-1).positions, 4)[0], 499);
});

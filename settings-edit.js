// Modifications du réglage en mémoire (utilisées par le panneau). Fonctions
// sans accès à la page. Convention des règles : rules[a][b] = g, positif =
// répulsion, négatif = attraction, règle absente = 0.

export const MAX_COUNT = 100000;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export const getRule = (settings, a, b) => settings.rules?.[a]?.[b] ?? 0;

export const setRule = (settings, a, b, value) => {
  settings.rules ??= {};
  settings.rules[a] ??= {};
  settings.rules[a][b] = clamp(Number(value) || 0, -1, 1);
};

export const setCount = (settings, name, value) => {
  const type = settings.types.find((t) => t.name === name);
  if (!type) return;
  const n = Math.floor(Number(value));
  type.count = Number.isFinite(n) ? clamp(n, 0, MAX_COUNT) : 0;
};

// Portée : nombre > 0 ; vide ou invalide : illimitée.
export const setRange = (settings, value) => {
  const n = value === "" || value === null ? NaN : Number(value);
  settings.range = n > 0 && Number.isFinite(n) ? n : Infinity;
};

// Friction : de 0 à 1.
export const setFriction = (settings, value) => {
  const n = Number(value);
  settings.friction = Number.isFinite(n) ? clamp(n, 0, 1) : settings.friction;
};

export const setEdges = (settings, value) => {
  settings.edges = value === "wrap" ? "wrap" : "bounce";
};

// Ajoute un type (nom unique, couleur, nombre, masse) ; ses règles, avec les
// autres types et avec lui-même, valent 0. Renvoie { ok: true } ou
// { ok: false, error } (message en français).
export const addType = (settings, { name, color, count, mass }) => {
  const label = String(name ?? "").trim();
  if (!label || label === "__proto__") return { ok: false, error: "Nom requis." };
  if (settings.types.some((t) => t.name === label)) {
    return { ok: false, error: "Ce nom existe déjà." };
  }
  if (!String(color ?? "").trim()) return { ok: false, error: "Couleur requise." };
  const m = Number(mass);
  if (!(m > 0) || !Number.isFinite(m)) {
    return { ok: false, error: "La masse doit être supérieure à 0." };
  }
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: "Le nombre doit être un entier positif ou nul." };
  }
  const names = settings.types.map((t) => t.name);
  settings.types.push({
    name: label,
    color: String(color).trim(),
    count: Math.min(n, MAX_COUNT),
    mass: m,
  });
  settings.rules ??= {};
  settings.rules[label] = {};
  for (const other of [...names, label]) {
    settings.rules[label][other] = 0;
    if (other !== label) settings.rules[other] ??= {};
    settings.rules[other][label] = 0;
  }
  return { ok: true };
};

// Retire un type, ses particules (via le nombre de types) et toutes les règles
// qui le citent.
export const removeType = (settings, name) => {
  settings.types = settings.types.filter((t) => t.name !== name);
  delete settings.rules?.[name];
  for (const row of Object.values(settings.rules ?? {})) delete row[name];
};

// Préréglages : validation d'un fichier de `presets/` (sans accès à la page ni
// au système de fichiers, donc testable avec node --test).
//
// Forme d'un préréglage : { title, description, vignette, settings } où
// settings a la forme de settings.js (epsilon, friction, range, types, rules ;
// edges, gravity, dimensions et depth facultatifs ; chaque type peut lister
// des corps explicites `bodies` ; interaction et G facultatifs). En mode
// "rules" (défaut), la portée est obligatoire et finie : aucune simulation ne
// démarre avec une portée illimitée (calcul lent), et les règles sont
// obligatoires. En mode "gravity" (gravitation universelle, portée toujours
// illimitée), la portée et les règles sont facultatives.
import { MAX_COUNT } from "./settings-edit.js";

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isText = (v) => typeof v === "string" && v.trim() !== "";
const isNumber = (v) => typeof v === "number" && Number.isFinite(v);

const isVector = (v) =>
  Array.isArray(v) && (v.length === 2 || v.length === 3) && v.every(isNumber);

// Corps explicites d'un type : position et vitesse de 2 ou 3 nombres, nom,
// masse et rayon facultatifs ; le type doit compter au moins ses corps.
const validateBodies = (t, at, errors) => {
  if (!Array.isArray(t.bodies)) {
    errors.push(`\`${at}.bodies\` : liste attendue`);
    return;
  }
  t.bodies.forEach((b, k) => {
    const bt = `${at}.bodies[${k}]`;
    if (!isObject(b)) return errors.push(`\`${bt}\` : objet attendu`);
    if (b.name !== undefined && !isText(b.name)) {
      errors.push(`\`${bt}.name\` : nom non vide attendu`);
    }
    for (const field of ["position", "velocity"]) {
      if (!isVector(b[field])) {
        errors.push(`\`${bt}.${field}\` : tableau de 2 ou 3 nombres attendu`);
      }
    }
    for (const field of ["mass", "radius"]) {
      if (b[field] !== undefined && !(isNumber(b[field]) && b[field] > 0)) {
        errors.push(`\`${bt}.${field}\` : nombre > 0 attendu`);
      }
    }
  });
  if (Number.isInteger(t.count) && t.count < t.bodies.length) {
    errors.push(
      `\`${at}.count\` : au moins ${t.bodies.length} attendu (un par corps de \`bodies\`)`,
    );
  }
};

// Renvoie la liste des problèmes (messages en français) ; vide = valide.
export const validatePreset = (preset) => {
  const errors = [];
  if (!isObject(preset)) return ["le fichier doit contenir un objet JSON"];
  if (!isText(preset.title)) errors.push("`title` manquant ou vide");
  if (!isText(preset.description)) errors.push("`description` manquante ou vide");
  if (!isText(preset.vignette)) errors.push("`vignette` manquante ou vide");
  const s = preset.settings;
  if (!isObject(s)) {
    errors.push("`settings` manquant (objet attendu)");
    return errors;
  }
  if (!isNumber(s.epsilon) || s.epsilon <= 0) {
    errors.push("`settings.epsilon` : nombre > 0 attendu");
  }
  if (!isNumber(s.friction) || s.friction < 0 || s.friction > 1) {
    errors.push("`settings.friction` : nombre de 0 à 1 attendu");
  }
  if (s.interaction !== undefined && s.interaction !== "rules" && s.interaction !== "gravity") {
    errors.push("`settings.interaction` : « rules » ou « gravity » attendu");
  }
  const gravitation = s.interaction === "gravity";
  if (gravitation) {
    // Portée facultative et ignorée par le moteur ; si elle est donnée, elle
    // doit rester un nombre > 0 (Infinity accepté, impossible en JSON).
    if (s.range !== undefined && s.range !== null && !(typeof s.range === "number" && s.range > 0)) {
      errors.push("`settings.range` : nombre > 0 attendu (facultatif en mode gravité)");
    }
  } else if (!(isNumber(s.range) && s.range > 0)) {
    errors.push("`settings.range` : portée finie > 0 attendue");
  }
  if (s.G !== undefined && !(isNumber(s.G) && s.G > 0)) {
    errors.push("`settings.G` : constante de gravitation > 0 attendue");
  }
  if (s.gravity !== undefined && !isNumber(s.gravity)) {
    errors.push("`settings.gravity` : nombre attendu");
  }
  if (s.edges !== undefined && s.edges !== "bounce" && s.edges !== "wrap") {
    errors.push("`settings.edges` : « bounce » ou « wrap » attendu");
  }
  if (s.dimensions !== undefined && s.dimensions !== 2 && s.dimensions !== 3) {
    errors.push("`settings.dimensions` : 2 ou 3 attendu");
  }
  if (s.depth !== undefined && !(isNumber(s.depth) && s.depth > 0)) {
    errors.push("`settings.depth` : profondeur finie > 0 attendue");
  }
  const names = new Set();
  if (!Array.isArray(s.types) || s.types.length === 0) {
    errors.push("`settings.types` : liste non vide attendue");
  } else {
    s.types.forEach((t, k) => {
      const at = `settings.types[${k}]`;
      if (!isObject(t)) return errors.push(`\`${at}\` : objet attendu`);
      if (!isText(t.name) || t.name === "__proto__") {
        errors.push(`\`${at}.name\` : nom attendu`);
      } else if (names.has(t.name)) {
        errors.push(`\`${at}.name\` : le nom « ${t.name} » est en double`);
      } else names.add(t.name);
      if (!isText(t.color)) errors.push(`\`${at}.color\` : couleur attendue`);
      if (!Number.isInteger(t.count) || t.count < 0 || t.count > MAX_COUNT) {
        errors.push(`\`${at}.count\` : entier de 0 à ${MAX_COUNT} attendu`);
      }
      if (t.mass !== undefined && !(isNumber(t.mass) && t.mass >= 0)) {
        errors.push(`\`${at}.mass\` : nombre positif ou nul attendu`);
      }
      if (t.bodies !== undefined) validateBodies(t, at, errors);
    });
  }
  if (!isObject(s.rules)) {
    if (!(gravitation && s.rules === undefined)) {
      errors.push("`settings.rules` : objet attendu");
    }
  } else {
    for (const [a, row] of Object.entries(s.rules)) {
      if (!names.has(a)) errors.push(`règle « ${a} » : type inconnu`);
      if (!isObject(row)) {
        errors.push(`règle « ${a} » : objet attendu`);
        continue;
      }
      for (const [b, g] of Object.entries(row)) {
        if (!names.has(b)) errors.push(`règle « ${a} » → « ${b} » : type inconnu`);
        if (!isNumber(g)) errors.push(`règle « ${a} » → « ${b} » : nombre attendu`);
      }
    }
  }
  return errors;
};

// entries : [{ file, text }] (contenu brut des fichiers JSON). Renvoie
// { presets: [{ file, title, description, vignette, settings }],
//   errors: [{ file, messages }] } : un fichier invalide n'empêche pas les autres.
export const parsePresets = (entries) => {
  const presets = [];
  const errors = [];
  for (const { file, text } of entries) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      errors.push({ file, messages: [`JSON mal formé : ${e.message}`] });
      continue;
    }
    const messages = validatePreset(data);
    if (messages.length) errors.push({ file, messages });
    else presets.push({ file, ...data });
  }
  presets.sort((a, b) => a.title.localeCompare(b.title, "fr"));
  return { presets, errors };
};

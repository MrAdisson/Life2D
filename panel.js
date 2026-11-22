// Panneau de réglages (page seulement) : modifie `settings` en mémoire puis
// appelle onChange() ; aucune sauvegarde. Libellés en français.
import {
  MAX_COUNT,
  MAX_SUBSTEPS,
  WARN_PARTICLES,
  addType,
  getRule,
  hasRandomMass,
  isGravitation,
  needsRangeWarning,
  parseNumber,
  removeType,
  setCount,
  setDimensions,
  setEdges,
  setEpsilon,
  setFriction,
  setGravitationalConstant,
  setGravity,
  setMass,
  setRange,
  setRule,
  setSpeed,
  setSubsteps,
  setTimeStep,
} from "./settings-edit.js";
import { MAX_SUBSTEPS as SUBSTEPS_CAP, frameSteps } from "./engine.js";
import { formatTime } from "./stats.js";
import {
  SLIDER_STEPS,
  frictionFromSlider,
  rangeFromSlider,
  speedFromSlider,
  sliderFromSpeed,
  tidy,
  sliderFromFriction,
  sliderFromRange,
} from "./scales.js";

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

// Champ avec libellé et explication (texte d'aide toujours visible).
const field = (label, input, help) =>
  el(
    "label",
    { className: "field" },
    el("span", { className: "field-label", textContent: label }),
    input,
    help ? el("span", { className: "help", textContent: help }) : "",
  );

const section = (title, intro, ...content) =>
  el(
    "section",
    { className: "card" },
    el("h3", { textContent: title }),
    intro ? el("p", { className: "help", textContent: intro }) : "",
    ...content,
  );

const errorLine = (id) => {
  const p = el("p", { className: "error", id });
  p.setAttribute("role", "alert");
  return p;
};

// Saisie exacte : `step: "any"` accepte toutes les décimales.
const numberInput = (props) => el("input", { type: "number", step: "any", ...props });

// Affichage d'une valeur : au plus 9 décimales, sans bruit d'arrondi.
const show = (v) => String(tidy(v));

// Couleur d'une cellule de la matrice : rouge = répulsion, bleu = attraction.
const heat = (v) => {
  const a = 0.12 + Math.min(1, Math.abs(v)) * 0.6;
  return v > 0
    ? `rgba(255, 99, 99, ${a})`
    : v < 0
      ? `rgba(80, 160, 255, ${a})`
      : "rgba(255, 255, 255, 0.04)";
};

// Texte court d'une règle dans la grille (la valeur exacte est dans l'éditeur).
const shortRule = (v) => {
  if (v === 0) return "0";
  const text = String(Number(v.toPrecision(2)));
  return text.replace(/^(-?)0\./, "$1.");
};

// settings : réglage modifié en place ; onChange() : à appeler après chaque
// modification ; onReseed() : nouveau tirage ; onPause(paused), onStep() :
// lecture ; open : panneau déplié au départ (par défaut oui). Renvoie
// { element, setPaused, setSteps, setTime }.
export const createPanel = (
  parent,
  { settings, onChange, onReseed, onPause, onStep, open = true },
) => {
  let paused = false;
  const root = el("aside", { className: "panel", id: "settings-panel" });
  const body = el("div", { className: "panel-body", id: "settings-body" });
  const toggle = el("button", {
    type: "button",
    className: "panel-toggle",
    title: "Replier ou déplier le panneau (la simulation continue)",
  });
  toggle.append(
    el("span", { className: "chevron", textContent: "⚙" }),
    el("span", { textContent: "Réglages" }),
  );
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-controls", "settings-body");
  toggle.onclick = () => {
    const open = body.hidden;
    body.hidden = !open;
    root.classList.toggle("collapsed", !open);
    toggle.setAttribute("aria-expanded", String(open));
  };

  // Toute modification : avertissement de performance à jour, puis envoi.
  const changed = () => {
    syncWarning();
    syncSpeedWarning();
    onChange();
  };

  // --- Lecture ---
  const status = el("span", { className: "status", id: "status" });
  const stepCount = el("output", { id: "step-count", textContent: "0" });
  const timeCount = el("output", { id: "sim-time", textContent: "0" });
  const pauseButton = el("button", {
    type: "button",
    id: "pause",
    className: "primary",
    title: "Figer ou relancer la simulation",
  });
  const stepButton = el("button", {
    type: "button",
    id: "step",
    textContent: "⏭ Pas à pas",
    title: "Avance d'une seule image : les sous-pas réglés dans « Physique » (disponible en pause)",
  });
  const reseedButton = el("button", {
    type: "button",
    id: "reseed",
    textContent: "🎲 Nouveau tirage",
    title:
      "Replace toutes les particules au hasard, vitesses à zéro ; réglages et pause inchangés",
  });
  const syncPause = () => {
    pauseButton.textContent = paused ? "▶ Reprendre" : "⏸ Pause";
    stepButton.disabled = !paused;
    status.textContent = paused ? "En pause" : "En marche";
    status.classList.toggle("paused", paused);
  };
  pauseButton.onclick = () => {
    paused = !paused;
    syncPause();
    onPause(paused);
  };
  stepButton.onclick = () => paused && onStep();
  reseedButton.onclick = () => onReseed();
  syncPause();
  const playback = section(
    "Lecture",
    "En pause, « Pas à pas » avance d'une seule image (autant de pas de temps que de sous-pas) : à faible vitesse le déplacement est minuscule, suivez le compteur de pas. Le temps simulé est la somme des pas de temps calculés ; un nouveau tirage le remet à 0.",
    el("div", { className: "row" }, pauseButton, stepButton, reseedButton),
    el(
      "div",
      { className: "row meta" },
      status,
      el("span", {}, "Pas n° ", stepCount),
      el("span", {}, "Temps simulé ", timeCount),
    ),
  );

  // --- Physique ---
  // Portée : saisie exacte + curseur logarithmique (5 à 2 000 px).
  const range = numberInput({
    id: "range",
    min: 1,
    placeholder: "illimitée",
    value: Number.isFinite(settings.range) ? settings.range : "",
  });
  range.setAttribute("aria-label", "Portée exacte en pixels");
  const rangeSlider = el("input", {
    type: "range",
    id: "range-slider",
    min: 0,
    max: SLIDER_STEPS,
    step: 1,
    value: sliderFromRange(settings.range ?? Infinity),
  });
  rangeSlider.setAttribute("aria-label", "Curseur de portée (échelle logarithmique)");
  range.oninput = () => {
    setRange(settings, range.value);
    rangeSlider.value = sliderFromRange(settings.range);
    changed();
  };
  range.onchange = () => {
    range.value = Number.isFinite(settings.range) ? show(settings.range) : "";
  };
  rangeSlider.oninput = () => {
    const v = rangeFromSlider(Number(rangeSlider.value));
    setRange(settings, v);
    range.value = show(settings.range);
    changed();
  };
  const warning = el("p", {
    className: "warning",
    id: "range-warning",
    textContent: `⚠ Portée illimitée avec ${WARN_PARTICLES.toLocaleString("fr-FR")} particules ou plus : chaque particule agit sur toutes les autres, le calcul devient très lent. Donnez une portée (par exemple 60 px) ou réduisez le nombre de particules.`,
  });
  warning.setAttribute("role", "status");
  const syncWarning = () => {
    warning.hidden = !needsRangeWarning(settings);
  };

  // Friction : saisie exacte (0 à 1, toutes décimales) + curseur plus fin
  // près de 0 et près de 1.
  const friction = numberInput({
    id: "friction",
    min: 0,
    max: 1,
    value: show(settings.friction),
  });
  friction.setAttribute("aria-label", "Friction exacte");
  const frictionSlider = el("input", {
    type: "range",
    id: "friction-slider",
    min: 0,
    max: SLIDER_STEPS,
    step: 1,
    value: sliderFromFriction(settings.friction),
  });
  frictionSlider.setAttribute("aria-label", "Curseur de friction (plus fin près de 0 et de 1)");
  friction.oninput = () => {
    if (!Number.isFinite(parseNumber(friction.value))) return; // ignorée
    setFriction(settings, friction.value);
    frictionSlider.value = sliderFromFriction(settings.friction);
    changed();
  };
  // En quittant le champ, il affiche la valeur appliquée (ramenée dans 0…1).
  friction.onchange = () => {
    friction.value = show(settings.friction);
  };
  frictionSlider.oninput = () => {
    setFriction(settings, frictionFromSlider(Number(frictionSlider.value)));
    friction.value = show(settings.friction);
    changed();
  };

  // Epsilon : nombre > 0.
  const epsilon = numberInput({ id: "epsilon", min: 0, value: show(settings.epsilon) });
  const epsilonError = errorLine("epsilon-error");
  epsilon.oninput = () => {
    const result = setEpsilon(settings, epsilon.value);
    epsilonError.textContent = result.ok
      ? ""
      : `${result.error} Valeur conservée : ${show(settings.epsilon)}.`;
    if (result.ok) changed();
  };
  epsilon.onchange = () => {
    if (!Number.isFinite(parseNumber(epsilon.value)) || !(parseNumber(epsilon.value) > 0)) {
      epsilon.value = show(settings.epsilon);
    }
  };

  // Gravité : accélération constante vers le bas (négative : vers le haut).
  const gravity = numberInput({ id: "gravity", value: show(settings.gravity ?? 0) });
  gravity.setAttribute("aria-label", "Gravité exacte");
  const gravitySlider = el("input", {
    type: "range",
    id: "gravity-slider",
    min: -0.2,
    max: 0.2,
    step: 0.001,
    value: settings.gravity ?? 0,
  });
  gravitySlider.setAttribute("aria-label", "Curseur de gravité (−0,2 à 0,2)");
  const gravityError = errorLine("gravity-error");
  gravity.oninput = () => {
    if (gravity.value === "" || gravity.value === "-") return;
    const result = setGravity(settings, gravity.value);
    gravityError.textContent = result.ok ? "" : result.error;
    if (!result.ok) return;
    gravitySlider.value = settings.gravity;
    changed();
  };
  gravity.onchange = () => {
    gravity.value = show(settings.gravity ?? 0);
    gravityError.textContent = "";
  };
  gravitySlider.oninput = () => {
    setGravity(settings, tidy(Number(gravitySlider.value)));
    gravity.value = show(settings.gravity);
    gravityError.textContent = "";
    changed();
  };

  // Constante de gravitation G (mode gravitation universelle seulement).
  const gravitation = isGravitation(settings);
  const constant = numberInput({ id: "gravitational-constant", min: 0, value: show(settings.G ?? 1) });
  constant.setAttribute("aria-label", "Constante de gravitation G");
  const constantError = errorLine("gravitational-constant-error");
  constant.oninput = () => {
    const result = setGravitationalConstant(settings, constant.value);
    constantError.textContent = result.ok
      ? ""
      : `${result.error} Valeur conservée : ${show(settings.G ?? 1)}.`;
    if (result.ok) changed();
  };
  constant.onchange = () => {
    if (!(parseNumber(constant.value) > 0) || !Number.isFinite(parseNumber(constant.value))) {
      constant.value = show(settings.G ?? 1);
    }
  };

  // Pas de temps dt (nombre > 0) et sous-pas par image (entier).
  const timeStep = numberInput({ id: "time-step", min: 0, value: show(settings.dt ?? 1) });
  const timeStepError = errorLine("time-step-error");
  timeStep.oninput = () => {
    const result = setTimeStep(settings, timeStep.value);
    timeStepError.textContent = result.ok
      ? ""
      : `${result.error} Valeur conservée : ${show(settings.dt ?? 1)}.`;
    if (result.ok) changed();
  };
  timeStep.onchange = () => {
    if (!(parseNumber(timeStep.value) > 0) || !Number.isFinite(parseNumber(timeStep.value))) {
      timeStep.value = show(settings.dt ?? 1);
    }
  };
  const substeps = numberInput({
    id: "substeps",
    min: 1,
    max: MAX_SUBSTEPS,
    step: 1,
    value: String(settings.substeps ?? 1),
  });
  const substepsError = errorLine("substeps-error");
  substeps.oninput = () => {
    const result = setSubsteps(settings, substeps.value);
    substepsError.textContent = result.ok
      ? ""
      : `${result.error} Valeur conservée : ${settings.substeps ?? 1}.`;
    if (result.ok) changed();
  };
  substeps.onchange = () => {
    substeps.value = String(settings.substeps ?? 1);
  };

  // Vitesse de simulation : curseur logarithmique + champ exact.
  const speed = numberInput({ id: "speed", min: 0, value: show(settings.speed ?? 1) });
  speed.setAttribute("aria-label", "Vitesse de simulation exacte (multiplicateur)");
  const speedSlider = el("input", {
    type: "range",
    id: "speed-slider",
    min: 0,
    max: SLIDER_STEPS,
    step: 1,
    value: sliderFromSpeed(settings.speed ?? 1),
  });
  speedSlider.setAttribute("aria-label", "Curseur de vitesse (échelle logarithmique)");
  const speedError = errorLine("speed-error");
  const speedWarning = el("p", { className: "warning", id: "speed-warning" });
  speedWarning.setAttribute("role", "status");
  const syncSpeedWarning = () => {
    const f = frameSteps(settings);
    speedWarning.hidden = !f.limited;
    if (f.limited) {
      speedWarning.textContent = `⚠ Vitesse demandée non atteinte : plafond de ${SUBSTEPS_CAP} sous-pas par image, vitesse obtenue ≈ ${show(Number(f.achieved.toPrecision(3)))}× au lieu de ${show(f.requested)}×. Réduisez la vitesse ou les sous-pas par image.`;
    }
  };
  syncSpeedWarning();
  speed.oninput = () => {
    const result = setSpeed(settings, speed.value);
    speedError.textContent = result.ok
      ? ""
      : `${result.error} Valeur conservée : ${show(settings.speed ?? 1)}.`;
    if (result.ok) {
      speedSlider.value = sliderFromSpeed(settings.speed);
      syncSpeedWarning();
      changed();
    }
  };
  speed.onchange = () => {
    if (!(parseNumber(speed.value) > 0) || !Number.isFinite(parseNumber(speed.value))) {
      speed.value = show(settings.speed ?? 1);
    }
  };
  speedSlider.oninput = () => {
    setSpeed(settings, speedFromSlider(Number(speedSlider.value)));
    speed.value = show(settings.speed);
    speedError.textContent = "";
    syncSpeedWarning();
    changed();
  };

  const edgeButtons = [
    ["bounce", "Rebond", "La particule rebondit sur les bords du canevas"],
    ["wrap", "Traversée", "La particule ressort par le bord opposé"],
  ].map(([value, label, title]) => {
    const b = el("button", { type: "button", textContent: label, title });
    b.dataset.edges = value;
    b.onclick = () => {
      setEdges(settings, value);
      syncEdges();
      changed();
    };
    return b;
  });
  const syncEdges = () => {
    const current = settings.edges === "wrap" ? "wrap" : "bounce";
    for (const b of edgeButtons) {
      b.classList.toggle("active", b.dataset.edges === current);
      b.setAttribute("aria-pressed", String(b.dataset.edges === current));
    }
  };
  syncEdges();
  const dimensionButtons = [
    [2, "2D", "Espace plan : z reste à 0"],
    [3, "3D", "Espace en volume, vue orbitale : la simulation repart d'un nouveau tirage"],
  ].map(([value, label, title]) => {
    const b = el("button", { type: "button", textContent: label, title });
    b.dataset.dimensions = String(value);
    b.onclick = () => {
      if ((settings.dimensions === 3 ? 3 : 2) === value) return;
      setDimensions(settings, value);
      syncDimensions();
      changed();
    };
    return b;
  });
  const syncDimensions = () => {
    const current = settings.dimensions === 3 ? 3 : 2;
    for (const b of dimensionButtons) {
      const on = b.dataset.dimensions === String(current);
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    }
  };
  syncDimensions();
  // En tête du panneau : c'est le choix qui change le plus la simulation.
  const space = section(
    "Espace",
    "2D : plan. 3D : volume que l'on fait tourner à la souris (glisser, molette, double-clic pour recentrer). Changer de mode relance un nouveau tirage.",
    el(
      "div",
      { className: "field" },
      el("span", { className: "field-label", textContent: "Dimensions" }),
      el("div", { className: "segmented" }, ...dimensionButtons),
    ),
  );
  const physics = section(
    "Physique",
    "Appliqué dès le pas suivant, sans réinitialiser les particules. Chaque curseur a un champ pour la valeur exacte.",
    ...(gravitation
      ? [
          field(
            "Constante G",
            constant,
            "Gravitation universelle : chaque corps attire tous les autres, sans limite de distance, avec une force G·m₁·m₂/d². Plus G est grand, plus l'attraction est forte. Nombre supérieur à 0.",
          ),
          constantError,
        ]
      : [
          field(
            "Portée (px)",
            el("div", { className: "slider" }, rangeSlider, range),
            "Au-delà de cette distance, deux particules n'interagissent plus. Champ vide = illimitée (calcul beaucoup plus lent). Curseur : 5 à 2000 px, plus fin pour les petites portées.",
          ),
          warning,
        ]),
    field(
      "Vitesse de simulation (×)",
      el("div", { className: "slider" }, speedSlider, speed),
      "Multiplicateur du temps simulé par seconde réelle (1 par défaut). Le calcul ajoute des sous-pas (jusqu'à " + MAX_SUBSTEPS + " par image) : 2× fait avancer le temps deux fois plus vite sans perdre en précision. Curseur : 0,1× à 1000× ; le champ accepte toute valeur > 0. Les réglages avancés ci-dessous (pas de temps, sous-pas) donnent la base à vitesse 1.",
    ),
    speedError,
    speedWarning,
    field(
      "Pas de temps (avancé, vitesse 1)",
      timeStep,
      gravitation
        ? "Temps simulé à chaque pas de calcul (1 par défaut). Plus petit : orbites plus précises, mouvement plus lent à l'écran. Plus grand : temps accéléré, moins précis (compensez avec des sous-pas). Nombre supérieur à 0."
        : "Temps simulé à chaque pas de calcul (1 par défaut) : plus petit, le mouvement est plus lent et plus fin ; plus grand, plus rapide et plus heurté. Nombre supérieur à 0.",
    ),
    timeStepError,
    field(
      "Sous-pas par image (avancé, vitesse 1)",
      substeps,
      `Nombre de pas de temps calculés avant chaque image (1 par défaut) : le temps avance plus vite à l'écran sans perdre en précision, mais le calcul de chaque image est d'autant plus long. Entier de 1 à ${MAX_SUBSTEPS}.`,
    ),
    substepsError,
    field(
      "Friction",
      el("div", { className: "slider" }, frictionSlider, friction),
      "Facteur appliqué à la vitesse par unité de temps (à chaque pas avec un pas de temps de 1), de 0 à 1 : 1 = aucune perte, 0 = arrêt immédiat. Près de 1, chaque décimale compte (0,999 freine dix fois moins que 0,99) : le curseur est plus fin près de 0 et de 1, le champ accepte toutes les décimales (ex. 0,9995).",
    ),
    field(
      "Epsilon (px)",
      epsilon,
      gravitation
        ? "Adoucissement : la distance d est remplacée par √(d² + ε²), ce qui évite une force infinie quand deux corps se touchent. Gardez-le petit devant les distances entre corps pour ne pas fausser les orbites. Nombre supérieur à 0."
        : "Ajouté à la distance entre deux particules dans le calcul de la force : plus petit, les rencontres proches sont plus violentes ; plus grand, les forces sont adoucies. Nombre supérieur à 0.",
    ),
    epsilonError,
    field(
      "Gravité verticale (px/pas²)",
      el("div", { className: "slider" }, gravitySlider, gravity),
      "Accélération constante (par unité de temps², donc par pas² avec un pas de temps de 1) ajoutée à toutes les particules, vers le bas (négative : vers le haut). 0 = aucune. Curseur : −0,2 à 0,2 ; le champ accepte toute valeur.",
    ),
    gravityError,
    el(
      "div",
      { className: "field" },
      el("span", { className: "field-label", textContent: "Bords" }),
      el("div", { className: "segmented" }, ...edgeButtons),
      el("span", {
        className: "help",
        textContent: "Comportement d'une particule qui atteint le bord.",
      }),
    ),
  );

  // --- Types, nombres, masses et matrice : reconstruits quand les types changent ---
  const typesBox = el("div", { className: "types" });
  const matrixBox = el("div", { className: "matrix-box" });
  const renderTypes = () => {
    typesBox.replaceChildren(
      el(
        "div",
        { className: "type-row type-head" },
        el("span", { className: "swatch-space" }),
        el("span", { className: "type-name", textContent: "Type" }),
        el("span", { className: "col", textContent: "Nombre" }),
        el("span", { className: "col", textContent: "Masse" }),
        el("span", { className: "remove-space" }),
      ),
      ...settings.types.map((type) => {
        const count = el("input", {
          type: "number",
          min: 0,
          max: MAX_COUNT,
          step: 1,
          value: type.count,
        });
        count.dataset.type = type.name;
        count.setAttribute("aria-label", `Nombre de particules ${type.name}`);
        // Corps placés (préréglage) : les premières particules du type.
        const placed = Array.isArray(type.bodies) ? type.bodies.length : 0;
        if (placed > 0) {
          count.title = `Les ${placed} premières particules sont des corps placés à une position et une vitesse données ; en baissant le nombre, les premiers sont gardés.`;
        }
        count.oninput = () => {
          if (count.value === "") return;
          setCount(settings, type.name, count.value);
          changed();
        };

        // Masse : nombre > 0 ; masse aléatoire (absente ou 0) : champ vide.
        const mass = numberInput({
          min: 0,
          placeholder: "aléatoire",
          value: hasRandomMass(type) ? "" : show(type.mass),
          title: "Masse de chaque particule du type (plus lourd = plus gros)",
        });
        mass.dataset.mass = type.name;
        mass.setAttribute("aria-label", `Masse des particules ${type.name}`);
        const massError = errorLine("");
        massError.dataset.massError = type.name;
        const randomNote = el("span", {
          className: "random-note",
          textContent:
            "Masse aléatoire : chaque particule a sa propre masse, tirée entre 0 et 50. Saisissez une masse pour l'imposer à toutes.",
        });
        const syncMass = () => {
          randomNote.hidden = !hasRandomMass(type);
        };
        syncMass();
        mass.oninput = () => {
          const result = setMass(settings, type.name, mass.value);
          if (!result.ok) {
            massError.textContent = hasRandomMass(type)
              ? `${result.error} La masse reste aléatoire.`
              : `${result.error} Masse conservée : ${show(type.mass)}.`;
            return;
          }
          massError.textContent = "";
          syncMass();
          changed();
        };
        mass.onchange = () => {
          mass.value = hasRandomMass(type) ? "" : show(type.mass);
        };

        const remove = el("button", {
          type: "button",
          className: "remove",
          textContent: "✕",
          title: `Retirer le type ${type.name} (supprime ses particules et ses règles)`,
        });
        remove.setAttribute("aria-label", `Retirer le type ${type.name}`);
        remove.onclick = () => {
          removeType(settings, type.name);
          render();
          changed();
        };
        const swatch = el("span", { className: "swatch" });
        swatch.style.background = type.color;
        return el(
          "div",
          { className: "type-block" },
          el(
            "div",
            { className: "type-row" },
            swatch,
            el("span", { className: "type-name", textContent: type.name, title: type.name }),
            count,
            mass,
            remove,
          ),
          randomNote,
          massError,
        );
      }),
    );
  };

  // Grille compacte : une case colorée par règle, toujours à la largeur du
  // panneau quel que soit le nombre de types ; la case choisie se règle dans
  // l'éditeur en dessous (curseur −1…1 et valeur exacte libre).
  let selected = null; // [a, b]
  const renderMatrix = () => {
    const names = settings.types.map((t) => t.name);
    const colorOf = new Map(settings.types.map((t) => [t.name, t.color]));
    if (!selected || !names.includes(selected[0]) || !names.includes(selected[1])) {
      selected = names.length ? [names[0], names[0]] : null;
    }
    const dot = (name) => {
      const d = el("span", { className: "swatch", title: name });
      d.style.background = colorOf.get(name);
      return d;
    };
    const grid = el("div", { className: "matrix-grid", id: "matrix-grid" });
    grid.style.setProperty("--n", names.length);
    grid.setAttribute("role", "grid");
    grid.append(el("span", { className: "corner", textContent: "subit ↓ / exerce →" }));
    for (const b of names) {
      grid.append(el("span", { className: "head col-head" }, dot(b)));
    }
    const cells = new Map();
    for (const a of names) {
      grid.append(
        el(
          "span",
          { className: "head row-head" },
          dot(a),
          el("span", { className: "head-name", textContent: a }),
        ),
      );
      for (const b of names) {
        const value = getRule(settings, a, b);
        const cell = el("button", {
          type: "button",
          className: "rule-cell",
          textContent: shortRule(value),
          title: `${a} subit ${b} : ${show(value)} (cliquer pour régler)`,
        });
        cell.dataset.a = a;
        cell.dataset.b = b;
        cell.setAttribute("aria-label", `Règle : ${a} subit ${b}, valeur ${show(value)}`);
        cell.style.background = heat(value);
        cell.onclick = () => {
          selected = [a, b];
          syncSelection();
          showEditor();
        };
        cells.set(`${a}\u0000${b}`, cell);
        grid.append(cell);
      }
    }

    // Éditeur de la règle choisie.
    const editorTitle = el("div", { className: "editor-title" });
    const slider = el("input", {
      type: "range",
      id: "rule-slider",
      min: -1,
      max: 1,
      step: 0.01,
    });
    slider.setAttribute("aria-label", "Curseur de la règle choisie (−1 à 1)");
    const exact = numberInput({ id: "rule-exact" });
    exact.setAttribute("aria-label", "Valeur exacte de la règle choisie");
    const refreshCell = (a, b) => {
      const v = getRule(settings, a, b);
      const cell = cells.get(`${a}\u0000${b}`);
      cell.textContent = shortRule(v);
      cell.title = `${a} subit ${b} : ${show(v)} (cliquer pour régler)`;
      cell.setAttribute("aria-label", `Règle : ${a} subit ${b}, valeur ${show(v)}`);
      cell.style.background = heat(v);
    };
    const syncSelection = () => {
      for (const cell of cells.values()) {
        const on = selected && cell.dataset.a === selected[0] && cell.dataset.b === selected[1];
        cell.classList.toggle("selected", Boolean(on));
        cell.setAttribute("aria-pressed", String(Boolean(on)));
      }
    };
    const showEditor = () => {
      if (!selected) return;
      const [a, b] = selected;
      const v = getRule(settings, a, b);
      editorTitle.replaceChildren(
        dot(a),
        el("strong", { textContent: a }),
        " subit ",
        dot(b),
        el("strong", { textContent: b }),
      );
      slider.value = Math.max(-1, Math.min(1, v));
      exact.value = show(v);
    };
    slider.oninput = () => {
      const [a, b] = selected;
      setRule(settings, a, b, tidy(Number(slider.value)));
      exact.value = show(getRule(settings, a, b));
      refreshCell(a, b);
      changed();
    };
    exact.oninput = () => {
      if (!Number.isFinite(parseNumber(exact.value))) return; // vide, « - »…
      const [a, b] = selected;
      setRule(settings, a, b, exact.value);
      const v = getRule(settings, a, b);
      slider.value = Math.max(-1, Math.min(1, v));
      refreshCell(a, b);
      changed();
    };
    exact.onchange = () => showEditor();
    syncSelection();
    showEditor();

    matrixBox.replaceChildren(
      el(
        "div",
        { className: "legend" },
        el("span", { className: "attract", textContent: "◀ attraction (négatif)" }),
        el("span", { textContent: "0 aucune" }),
        el("span", { className: "repulse", textContent: "répulsion (positif) ▶" }),
      ),
      names.length
        ? grid
        : el("p", { className: "help", textContent: "Aucun type : ajoutez-en un ci-dessous." }),
      names.length
        ? el(
            "div",
            { className: "rule-editor", id: "rule-editor" },
            editorTitle,
            el("div", { className: "slider" }, slider, exact),
            el("span", {
              className: "help",
              textContent:
                "Curseur : −1 à 1. Le champ accepte toute valeur exacte, plus forte si besoin (ex. 2 ou −5) : le curseur reste alors en butée.",
            }),
          )
        : "",
    );
  };
  const render = () => {
    renderTypes();
    renderMatrix();
  };

  const types = section(
    "Particules par type",
    "Changer un nombre ajoute ou retire des particules de ce type, sans toucher aux autres. Changer une masse l'applique aussi aux particules déjà présentes (taille comprise), sans les déplacer.",
    typesBox,
  );
  const matrix = gravitation
    ? section(
        "Interactions",
        "Gravitation universelle : tous les corps s'attirent selon leur masse, la matrice de règles ne sert pas. Réglez la constante G dans « Physique ».",
      )
    : section(
        "Interactions",
        "Chaque ligne est le type qui subit la force, chaque colonne celui qui l'exerce. Cliquez sur une case pour la régler.",
        matrixBox,
      );

  // --- Ajout d'un type ---
  const newName = el("input", {
    type: "text",
    id: "new-name",
    placeholder: "ex. or",
  });
  const newColor = el("input", {
    type: "color",
    id: "new-color",
    value: "#ffa500",
  });
  const newCount = el("input", {
    type: "number",
    id: "new-count",
    min: 0,
    max: MAX_COUNT,
    value: 100,
  });
  const newMass = numberInput({ id: "new-mass", min: 0, value: 5 });
  const error = errorLine("new-error");
  const add = el("button", {
    type: "button",
    id: "add-type",
    className: "primary",
    textContent: "＋ Ajouter le type",
  });
  add.onclick = () => {
    const result = addType(settings, {
      name: newName.value,
      color: newColor.value,
      count: newCount.value,
      mass: newMass.value,
    });
    error.textContent = result.ok ? "" : result.error;
    if (!result.ok) return;
    newName.value = "";
    render();
    changed();
  };
  const adder = section(
    "Nouveau type",
    gravitation
      ? "Ses particules attirent et sont attirées par tous les corps, selon leur masse."
      : "Ses règles démarrent à 0 : aucune interaction, à régler ensuite dans la grille.",
    el(
      "div",
      { className: "grid2" },
      field("Nom", newName, "Unique."),
      field("Couleur", newColor),
      field("Nombre", newCount, "Particules créées."),
      field("Masse", newMass, "Plus lourd = plus gros."),
    ),
    add,
    error,
  );

  render();
  syncWarning();
  body.append(space, playback, physics, types, matrix, adder);
  root.append(toggle, body);
  parent.appendChild(root);

  if (!open) {
    body.hidden = true;
    root.classList.add("collapsed");
    toggle.setAttribute("aria-expanded", "false");
  }

  return {
    element: root,
    setPaused(value) {
      paused = value;
      syncPause();
    },
    setSteps(n) {
      const text = String(n);
      if (stepCount.textContent !== text) stepCount.textContent = text;
    },
    setTime(t) {
      const text = formatTime(t, settings.timeUnit);
      if (timeCount.textContent !== text) timeCount.textContent = text;
    },
  };
};

// Panneau de réglages (page seulement) : modifie `settings` en mémoire puis
// appelle onChange() ; aucune sauvegarde. Libellés en français.
import {
  MAX_COUNT,
  addType,
  getRule,
  removeType,
  setCount,
  setEdges,
  setFriction,
  setRange,
  setRule,
} from "./settings-edit.js";

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

// Couleur d'une cellule de la matrice : rouge = répulsion, bleu = attraction.
const heat = (v) => {
  const a = Math.min(1, Math.abs(v)) * 0.55;
  return v > 0
    ? `rgba(255, 99, 99, ${a})`
    : v < 0
      ? `rgba(80, 160, 255, ${a})`
      : "transparent";
};

// settings : réglage modifié en place ; onChange() : à appeler après chaque
// modification ; onReseed() : nouveau tirage ; onPause(paused), onStep() :
// lecture ; open : panneau déplié au départ (par défaut oui). Renvoie
// { element, setPaused, setSteps }.
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

  // --- Lecture ---
  const status = el("span", { className: "status", id: "status" });
  const stepCount = el("output", { id: "step-count", textContent: "0" });
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
    title: "Avance d'un seul pas de calcul (disponible en pause)",
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
    "En pause, « Pas à pas » avance d'un seul pas : à faible vitesse le déplacement est minuscule, suivez le compteur de pas.",
    el("div", { className: "row" }, pauseButton, stepButton, reseedButton),
    el(
      "div",
      { className: "row meta" },
      status,
      el("span", {}, "Pas n° ", stepCount),
    ),
  );

  // --- Physique ---
  const range = el("input", {
    type: "number",
    id: "range",
    min: 1,
    step: 1,
    placeholder: "illimitée",
    value: Number.isFinite(settings.range) ? settings.range : "",
  });
  range.oninput = () => {
    setRange(settings, range.value);
    onChange();
  };
  const frictionOut = el("output", { textContent: String(settings.friction) });
  const friction = el("input", {
    type: "range",
    id: "friction",
    min: 0,
    max: 1,
    step: 0.01,
    value: settings.friction,
  });
  friction.oninput = () => {
    setFriction(settings, friction.value);
    frictionOut.textContent = Number(friction.value).toFixed(2);
    onChange();
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
      onChange();
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
  const physics = section(
    "Physique",
    "Appliqué dès le pas suivant, sans réinitialiser les particules.",
    field(
      "Portée (px)",
      range,
      "Au-delà de cette distance, deux particules n'interagissent plus. Vide = illimitée (calcul plus lent).",
    ),
    field(
      "Friction",
      el("div", { className: "slider" }, friction, frictionOut),
      "Facteur appliqué à la vitesse à chaque pas : 1 = aucune perte, 0 = arrêt immédiat.",
    ),
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
  frictionOut.textContent = Number(settings.friction).toFixed(2);

  // --- Types, nombres et matrice : reconstruits quand les types changent ---
  const typesBox = el("div", { className: "types" });
  const matrixBox = el("div", { className: "matrix-box" });
  const renderTypes = () => {
    typesBox.replaceChildren(
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
        count.oninput = () => {
          if (count.value === "") return;
          setCount(settings, type.name, count.value);
          onChange();
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
          onChange();
        };
        const swatch = el("span", { className: "swatch" });
        swatch.style.background = type.color;
        return el(
          "div",
          { className: "type-row" },
          swatch,
          el("span", { className: "type-name", textContent: type.name }),
          count,
          remove,
        );
      }),
    );
  };
  const renderMatrix = () => {
    const names = settings.types.map((t) => t.name);
    const head = el(
      "tr",
      {},
      el("th", {}),
      ...names.map((n) => el("th", { textContent: n, scope: "col" })),
    );
    const rows = names.map((a) =>
      el(
        "tr",
        {},
        el("th", { textContent: a, scope: "row" }),
        ...names.map((b) => {
          const value = getRule(settings, a, b);
          const cell = el("td", {});
          cell.style.background = heat(value);
          const title = `${a} subit ${b} : positif repousse, négatif attire`;
          const slider = el("input", {
            type: "range",
            min: -1,
            max: 1,
            step: 0.05,
            value: Math.max(-1, Math.min(1, value)),
            title,
          });
          slider.setAttribute("aria-label", `Curseur : ${a} subit ${b}`);
          // Saisie libre : accepte toute valeur, hors −1…1 comprise.
          const exact = el("input", {
            type: "number",
            step: 0.05,
            value: Number(value.toFixed(3)),
            title: "Valeur exacte (tout nombre accepté)",
          });
          exact.setAttribute("aria-label", `Valeur exacte : ${a} subit ${b}`);
          const refresh = (v) => {
            slider.value = Math.max(-1, Math.min(1, v));
            if (document.activeElement !== exact) exact.value = Number(v.toFixed(3));
            cell.style.background = heat(v);
          };
          slider.oninput = () => {
            setRule(settings, a, b, slider.value);
            refresh(getRule(settings, a, b));
            onChange();
          };
          exact.oninput = () => {
            if (exact.value === "" || exact.value === "-") return;
            setRule(settings, a, b, exact.value);
            refresh(getRule(settings, a, b));
            cell.style.background = heat(getRule(settings, a, b));
            onChange();
          };
          cell.append(slider, exact);
          return cell;
        }),
      ),
    );
    matrixBox.replaceChildren(
      el(
        "div",
        { className: "legend" },
        el("span", { className: "attract", textContent: "◀ attraction" }),
        el("span", { textContent: "0 aucune" }),
        el("span", { className: "repulse", textContent: "répulsion ▶" }),
      ),
      el(
        "p",
        { className: "help" },
        "Curseur : −1 à 1. Pour une valeur plus forte (ex. 2 ou −5), tapez-la dans le champ à droite.",
      ),
      el("div", { className: "matrix-scroll" }, el("table", { className: "matrix" }, head, ...rows)),
    );
  };
  const render = () => {
    renderTypes();
    renderMatrix();
  };

  const types = section(
    "Particules par type",
    "Changer un nombre ajoute ou retire des particules de ce type, sans toucher aux autres.",
    typesBox,
  );
  const matrix = section(
    "Interactions",
    "Chaque ligne est le type qui subit la force, chaque colonne celui qui l'exerce.",
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
  const newMass = el("input", {
    type: "number",
    id: "new-mass",
    min: 1,
    value: 5,
  });
  const error = el("p", { className: "error", id: "new-error" });
  error.setAttribute("role", "alert");
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
    onChange();
  };
  const adder = section(
    "Nouveau type",
    "Ses règles démarrent à 0 : aucune interaction, à régler ensuite dans la grille.",
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
  body.append(playback, physics, types, matrix, adder);
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
  };
};

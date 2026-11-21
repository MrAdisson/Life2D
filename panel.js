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

const field = (label, input) => el("label", { className: "field" }, label, input);

// settings : réglage modifié en place ; onChange() : à appeler après chaque

// tirage ; onPause(paused), onStep() : lecture. Renvoie { setPaused }.
export const createPanel = (
  parent,
  { settings, onChange, onReseed, onPause, onStep },
) => {
  let paused = false;
  const root = el("aside", { className: "panel", id: "settings-panel" });
  const body = el("div", { className: "panel-body", id: "settings-body" });
  const toggle = el("button", {
    type: "button",
    className: "panel-toggle",
    textContent: "Réglages",
  });
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-controls", "settings-body");
  toggle.onclick = () => {
    const open = body.hidden;
    body.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  };

  // Lecture
  const pauseButton = el("button", { type: "button", id: "pause" });
  const stepButton = el("button", {
    type: "button",
    id: "step",
    textContent: "Pas à pas",
  });
  const reseedButton = el("button", {
    type: "button",
    id: "reseed",
    textContent: "Nouveau tirage",
  });
  const syncPause = () => {
    pauseButton.textContent = paused ? "Reprendre" : "Pause";
    stepButton.disabled = !paused;
  };
  pauseButton.onclick = () => {
    paused = !paused;
    syncPause();
    onPause(paused);
  };
  stepButton.onclick = () => paused && onStep();
  reseedButton.onclick = () => onReseed();
  syncPause();
  const controls = el(
    "div",
    { className: "row" },
    pauseButton,
    stepButton,
    reseedButton,
  );

  // Portée, friction, bords
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
  const friction = el("input", {
    type: "number",
    id: "friction",
    min: 0,
    max: 1,
    step: 0.01,
    value: settings.friction,
  });
  friction.oninput = () => {
    if (friction.value === "") return;
    setFriction(settings, friction.value);
    onChange();
  };
  const edges = el(
    "select",
    { id: "edges" },
    el("option", { value: "bounce", textContent: "Rebond" }),
    el("option", { value: "wrap", textContent: "Passage de l'autre côté" }),
  );
  edges.value = settings.edges === "wrap" ? "wrap" : "bounce";
  edges.onchange = () => {
    setEdges(settings, edges.value);
    onChange();
  };
  const physics = el(
    "div",
    { className: "row" },
    field("Portée (px)", range),
    field("Friction (0 à 1)", friction),
    field("Bords", edges),
  );

  // Types, nombres et matrice : reconstruits quand les types changent.
  const typesBox = el("div");
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
          textContent: "Retirer",
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
      el("th", { textContent: "subit ↓ / de →" }),
      ...names.map((n) => el("th", { textContent: n })),
    );
    const rows = names.map((a) =>
      el(
        "tr",
        {},
        el("th", { textContent: a }),
        ...names.map((b) => {
          const value = getRule(settings, a, b);
          const out = el("output", { textContent: value.toFixed(2) });
          const slider = el("input", {
            type: "range",
            min: -1,
            max: 1,
            step: 0.05,
            value,
          });
          slider.dataset.from = b;
          slider.dataset.to = a;
          slider.setAttribute("aria-label", `Règle de ${a} envers ${b}`);
          slider.oninput = () => {
            setRule(settings, a, b, slider.value);
            out.textContent = Number(slider.value).toFixed(2);
            onChange();
          };
          return el("td", {}, slider, out);
        }),
      ),
    );
    matrixBox.replaceChildren(
      el("p", {
        className: "hint",
        textContent:
          "Positif : répulsion ; négatif : attraction ; 0 : aucune interaction.",
      }),
      el("table", { className: "matrix" }, head, ...rows),
    );
  };
  const render = () => {
    renderTypes();
    renderMatrix();
  };

  // Ajout d'un type
  const newName = el("input", { type: "text", id: "new-name", size: 8 });
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
    textContent: "Ajouter le type",
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
  const adder = el(
    "div",
    { className: "row" },
    field("Nom", newName),
    field("Couleur", newColor),
    field("Nombre", newCount),
    field("Masse", newMass),
    add,
  );

  render();
  body.append(
    controls,
    physics,
    el("h3", { textContent: "Particules par type" }),
    typesBox,
    el("h3", { textContent: "Matrice d'attraction" }),
    matrixBox,
    el("h3", { textContent: "Nouveau type" }),
    adder,
    error,
  );
  root.append(toggle, body);
  parent.appendChild(root);

  return {
    setPaused(value) {
      paused = value;
      syncPause();
    },
  };
};

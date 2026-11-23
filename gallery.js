// Galerie de préréglages (page seulement). Les fichiers de `presets/` sont
// découverts au build (ou au redémarrage de `npm run dev`) : ajouter un
// préréglage ne demande aucune modification de code.
import { groupByCategory, parsePresets } from "./presets.js";

const files = import.meta.glob("./presets/*.json", {
  query: "?raw",
  import: "default",
  eager: true,
});
const images = import.meta.glob("./presets/**/*.{svg,png,jpg,jpeg,webp,gif}", {
  query: "?url",
  import: "default",
  eager: true,
});

const { presets, errors } = parsePresets(
  Object.entries(files).map(([path, text]) => ({
    file: path.replace("./presets/", ""),
    text,
  })),
);
for (const { file, messages } of errors) {
  console.error(`Préréglage ignoré (presets/${file}) : ${messages.join(" ; ")}`);
}

// Adresse de la vignette : son chemin est relatif au dossier presets/.
const vignetteUrl = (preset) => {
  const { pathname } = new URL(preset.vignette, "http://x/presets/");
  const url = images[`.${decodeURIComponent(pathname)}`];
  if (!url) {
    console.warn(
      `Vignette introuvable (presets/${preset.file}) : ${preset.vignette}`,
    );
  }
  return url;
};

const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

// onLaunch(settings, { edit }) : lance la simulation avec une copie des
// réglages du préréglage ; edit = true ouvre le panneau de réglages.
export const createGallery = (parent, { onLaunch }) => {
  const root = el("main", { className: "gallery" });
  root.append(
    el("h1", { textContent: "Simulations préréglées" }),
    el("p", {
      className: "gallery-intro",
      textContent:
        "Choisissez un réglage pour lancer la simulation, ou partez-en pour le modifier.",
    }),
  );
  // Une section par catégorie (titre, puis cartes triées par titre) ; les
  // catégories sans préréglage valide n'apparaissent pas.
  const card = (preset) => {
    const url = vignetteUrl(preset);
    const thumb = url
      ? el("img", { src: url, alt: "", loading: "lazy" })
      : el("div", { className: "thumb-missing", textContent: "Pas de vignette" });
    const launch = el(
      "button",
      { type: "button", className: "card-launch" },
      thumb,
      el("h3", { textContent: preset.title }),
      el("p", { textContent: preset.description }),
    );
    launch.dataset.preset = preset.file;
    launch.onclick = () =>
      onLaunch(structuredClone(preset.settings), { edit: false });
    const edit = el("button", {
      type: "button",
      className: "card-edit",
      textContent: "✎ Modifier",
      title:
        "Lance la simulation avec ces réglages et ouvre le panneau pour les changer (le fichier n'est jamais modifié)",
    });
    edit.setAttribute("aria-label", `Modifier le préréglage ${preset.title}`);
    edit.onclick = () =>
      onLaunch(structuredClone(preset.settings), { edit: true });
    return el("article", { className: "card-preset" }, launch, edit);
  };
  for (const group of groupByCategory(presets)) {
    const heading = el("h2", {
      className: "gallery-section-title",
      id: `categorie-${group.id}`,
      textContent: group.title,
    });
    const section = el(
      "section",
      { className: "gallery-section" },
      heading,
      el("div", { className: "cards" }, ...group.presets.map(card)),
    );
    section.dataset.category = group.id;
    section.setAttribute("aria-labelledby", heading.id);
    root.append(section);
  }
  // Fichiers invalides (catégorie manquante ou inconnue comprise) : une carte
  // d'erreur chacun, dans une dernière section.
  if (errors.length) {
    const list = el("div", { className: "cards" });
    for (const { file, messages } of errors) {
      list.append(
        el(
          "article",
          { className: "card-preset card-error" },
          el("h3", { textContent: `Préréglage invalide : ${file}` }),
          el("ul", {}, ...messages.map((m) => el("li", { textContent: m }))),
        ),
      );
    }
    root.append(
      el(
        "section",
        { className: "gallery-section gallery-errors" },
        el("h2", { className: "gallery-section-title", textContent: "Préréglages invalides" }),
        list,
      ),
    );
  }
  parent.appendChild(root);
  return { element: root };
};

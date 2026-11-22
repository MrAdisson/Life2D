import "./style.css";
import { createGallery } from "./gallery.js";
import { createPanel } from "./panel.js";
import { createRenderer } from "./renderer.js";
import { createCamera } from "./camera.js";
import { attachOrbitControls } from "./orbit-controls.js";
import { displayOf } from "./display.js";
import { countParticles, createStatsMeter, formatStats } from "./stats.js";

// Thread principal : affichage seulement. Le calcul tourne dans le Worker.
// La page montre la galerie de préréglages ou une simulation, jamais les deux :
// lancer un préréglage remplace la simulation en cours.

let stopCurrent = null; // arrête et retire la simulation affichée

const showGallery = () => {
  stopCurrent?.();
  stopCurrent = null;
  const gallery = createGallery(document.body, { onLaunch: launch });
  stopCurrent = () => gallery.element.remove();
};

// settings : réglage modifiable en mémoire (copie du préréglage : le fichier
// de presets/ n'est jamais changé) ; edit : panneau de réglages déplié.
const launch = (settings, { edit = false } = {}) => {
  stopCurrent?.();

  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.border = "1px solid white";
  document.body.appendChild(canvas);

  const counter = document.createElement("div");
  counter.className = "stats";
  document.body.appendChild(counter);

  // Vue 3D : caméra orbitale (gardée d'un passage en 3D à l'autre pendant la
  // simulation) et aide affichée en bas de l'écran.
  const camera = createCamera({ zoom: displayOf(settings).zoom });
  canvas.tabIndex = 0;
  canvas.setAttribute("aria-label", "Simulation");
  attachOrbitControls(canvas, camera, {
    enabled: () => !!renderer?.view3d,
    box: () => renderer.box,
  });
  const hint = document.createElement("div");
  hint.className = "view-hint";
  hint.textContent =
    "Vue 3D : glisser pour tourner · clic droit ou deux doigts pour déplacer · molette ou pincer pour zoomer · double-clic pour recentrer (clavier : flèches, Maj + flèches, + / −, 0)";
  hint.hidden = true;
  document.body.appendChild(hint);
  const syncView = () => {
    const on = !!renderer?.view3d;
    hint.hidden = !on;
    canvas.classList.toggle("orbit", on);
  };

  // Étiquettes : un élément par corps nommé, replacé à chaque image (vue 3D).
  const labelLayer = document.createElement("div");
  labelLayer.className = "labels";
  document.body.appendChild(labelLayer);
  let bodyLabelled = []; // 0 : le corps masque son étiquette
  let bodyNames = []; // nom de chaque particule (ordre d'affichage) ou null
  let labelNodes = []; // [indice, élément]
  const buildLabels = () => {
    labelLayer.replaceChildren();
    labelNodes = [];
    bodyNames.forEach((name, k) => {
      if (!name || bodyLabelled[k] === 0) return;
      const node = document.createElement("div");
      node.className = "label";
      node.textContent = name;
      node.hidden = true;
      labelLayer.appendChild(node);
      labelNodes.push([k, node]);
    });
  };
  const placeLabels = () => {
    const show = !!renderer?.view3d && displayOf(settings).labels;
    for (const [k, node] of labelNodes) {
      const at = show ? renderer.screenPosition(k) : null;
      node.hidden = !at;
      if (at) {
        node.style.transform = `translate(${at.x}px, ${at.y - at.radius - 6}px) translate(-50%, -100%)`;
      }
    }
  };

  // Suivre un corps : choisi dans la liste du panneau ou cliqué sur le canevas
  // (un clic sans glisser, sur un corps nommé). Le corps est retrouvé par son
  // nom quand la description des particules change.
  const follow = (index) => {
    camera.follow = index;
    camera.panX = camera.panY = 0;
    followName = index === null ? null : bodyNames[index];
  };
  let followName = null;
  let downAt = null;
  canvas.addEventListener("pointerdown", (event) => {
    downAt = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener("click", (event) => {
    if (!renderer?.view3d || !downAt) return;
    if (Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 4) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const y = ((event.clientY - rect.top) * canvas.height) / rect.height;
    let best = null;
    let bestDistance = Infinity;
    for (const [k] of labelNodes) {
      const at = renderer.screenPosition(k);
      if (!at) continue;
      const d = Math.hypot(at.x - x, at.y - y);
      if (d <= Math.max(at.radius, 8) + 6 && d < bestDistance) {
        best = k;
        bestDistance = d;
      }
    }
    if (best !== null) {
      follow(best);
      panel.setFollow(best);
    }
  });

  const back = document.createElement("button");
  back.type = "button";
  back.className = "back";
  back.textContent = "← Galerie";
  back.title = "Arrêter la simulation et revenir à la galerie";
  back.onclick = showGallery;
  document.body.appendChild(back);

  let particles = countParticles(settings);
  const meter = createStatsMeter();
  counter.textContent = formatStats({ fps: 0, stepsPerSecond: 0, particles });

  const worker = new Worker(
    new URL("./simulation.worker.js", import.meta.url),
    { type: "module" },
  );

  let renderer = null;
  let received = null; // dernières positions reçues, pas encore renvoyées au Worker
  let uploaded = false; // `received` est déjà envoyé au rendu
  let generation = 0; // description des particules en cours (voir le Worker)
  let steps = 0;
  let time = 0; // temps simulé du dernier état reçu
  let failed = false;
  let stopped = false;
  let paused = false;
  let pendingSteps = 0; // pas demandés pendant la pause

  const fail = (message) => {
    failed = true;
    counter.textContent = message;
    worker.terminate();
  };

  worker.onerror = (event) => fail(`Erreur de simulation : ${event.message}`);

  worker.onmessage = ({ data }) => {
    if (stopped) return;
    if (data.type === "init") {
      generation = data.generation;
      received = null; // tampon de l'ancienne taille
      uploaded = false;
      bodyNames = data.names ?? [];
      bodyLabelled = data.labelled ?? [];
      buildLabels();
      const kept = followName === null ? -1 : bodyNames.indexOf(followName);
      camera.follow = kept >= 0 ? kept : null;
      if (kept < 0) followName = null;
      panel?.setBodies(bodyNames, camera.follow);
      if (renderer) renderer.load(data);
      else {
        renderer = createRenderer(canvas, data);
        if (!renderer) fail("WebGL 2 n'est pas disponible dans ce navigateur.");
        else {
          renderer.setCamera(camera);
          renderer.setDisplay(() => settings.display);
          requestAnimationFrame(loop);
        }
      }
      syncView();
    } else if (data.type === "positions" && data.generation === generation) {
      received = data.positions;
      uploaded = false;
      steps = data.steps;
      time = data.time ?? 0;
    }
  };

  const loop = (now) => {
    if (failed || stopped) return;
    if (received) {
      if (!uploaded) {
        renderer.upload(received);
        uploaded = true;
      }
      // En marche, le tampon repart au Worker, qui calcule le pas suivant
      // pendant que cette image s'affiche. En pause, il est gardé : l'image ne
      // change plus ; chaque pas demandé le renvoie une fois.
      if (!paused || pendingSteps > 0) {
        if (paused) pendingSteps--;
        worker.postMessage({ type: "step", positions: received, generation }, [
          received.buffer,
        ]);
        received = null;
      }
    }
    renderer.draw();
    // Double-clic ou « 0 » : la caméra a perdu son corps suivi.
    if (camera.follow === null && followName !== null) followName = null;
    panel.setFollow(camera.follow);
    placeLabels();
    panel.setSteps(steps);
    panel.setTime(time);
    const stats = meter.frame(now, steps);
    if (stats) counter.textContent = formatStats({ ...stats, particles });
    requestAnimationFrame(loop);
  };

  // Le réglage modifié part au Worker : pris en compte au pas suivant.
  const sendSettings = () => {
    particles = countParticles(settings);
    worker.postMessage({ type: "settings", settings });
  };

  const panel = createPanel(document.body, {
    settings,
    open: edit,
    viewport: { width: canvas.width, height: canvas.height },
    onChange: sendSettings,
    onReseed: () => worker.postMessage({ type: "reseed" }),
    onPause: (value) => {
      paused = value;
      pendingSteps = 0;
    },
    onStep: () => {
      if (paused) pendingSteps++;
    },
    onFollow: follow,
  });

  stopCurrent = () => {
    stopped = true;
    worker.terminate();
    renderer?.dispose();
    canvas.remove();
    counter.remove();
    hint.remove();
    back.remove();
    labelLayer.remove();
    panel.element.remove();
  };

  worker.postMessage({
    type: "init",
    settings,
    width: canvas.width,
    height: canvas.height,
  });
};

showGallery();

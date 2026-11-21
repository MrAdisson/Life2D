import "./style.css";
import { createGallery } from "./gallery.js";
import { createPanel } from "./panel.js";
import { createRenderer } from "./renderer.js";
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
      if (renderer) renderer.load(data);
      else {
        renderer = createRenderer(canvas, data);
        if (!renderer) fail("WebGL 2 n'est pas disponible dans ce navigateur.");
        else requestAnimationFrame(loop);
      }
    } else if (data.type === "positions" && data.generation === generation) {
      received = data.positions;
      uploaded = false;
      steps = data.steps;
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
    panel.setSteps(steps);
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
    onChange: sendSettings,
    onReseed: () => worker.postMessage({ type: "reseed" }),
    onPause: (value) => {
      paused = value;
      pendingSteps = 0;
    },
    onStep: () => {
      if (paused) pendingSteps++;
    },
  });

  stopCurrent = () => {
    stopped = true;
    worker.terminate();
    renderer?.dispose();
    canvas.remove();
    counter.remove();
    back.remove();
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

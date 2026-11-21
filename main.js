import "./style.css";
import { referenceSettings as settings } from "./settings.js";
import { createRenderer } from "./renderer.js";
import { countParticles, createStatsMeter, formatStats } from "./stats.js";

// Thread principal : affichage seulement. Le calcul tourne dans le Worker.

const canvas = document.createElement("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvas.style.border = "1px solid white";
document.body.appendChild(canvas);

const counter = document.createElement("div");
counter.className = "stats";
document.body.appendChild(counter);

const particles = countParticles(settings);
const meter = createStatsMeter();
counter.textContent = formatStats({ fps: 0, stepsPerSecond: 0, particles });

const worker = new Worker(new URL("./simulation.worker.js", import.meta.url), {
  type: "module",
});

let renderer = null;
let received = null; // dernières positions reçues, pas encore affichées
let steps = 0;

const fail = (message) => {
  counter.textContent = message;
  worker.terminate();
};

worker.onerror = (event) => fail(`Erreur de simulation : ${event.message}`);

worker.onmessage = ({ data }) => {
  if (data.type === "init") {
    renderer = createRenderer(canvas, data);
    if (!renderer) fail("WebGL 2 n'est pas disponible dans ce navigateur.");
    else requestAnimationFrame(loop);
  } else if (data.type === "positions") {
    received = data.positions;
    steps = data.steps;
  }
};

const loop = (now) => {
  if (received) {
    renderer.upload(received);
    // Le tampon repart au Worker, qui calcule le pas suivant pendant que
    // cette image s'affiche.
    worker.postMessage({ type: "step", positions: received }, [
      received.buffer,
    ]);
    received = null;
  }
  renderer.draw();
  const stats = meter.frame(now, steps);
  if (stats) counter.textContent = formatStats({ ...stats, particles });
  requestAnimationFrame(loop);
};

worker.postMessage({
  type: "init",
  settings,
  width: canvas.width,
  height: canvas.height,
});

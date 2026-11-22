// Commandes de la caméra orbitale (vue 3D) sur le canevas : glisser pour
// tourner, molette pour zoomer, double-clic pour recentrer ; au clavier
// (canevas sélectionné) : flèches, + / −, 0. Actives seulement quand
// `enabled()` est vrai (vue 3D). Les calculs sont dans camera.js.
import { orbit, resetCamera, zoomBy } from "./camera.js";

const KEY_STEP = 15; // « pixels » de rotation par appui sur une flèche

export const attachOrbitControls = (canvas, camera, { enabled }) => {
  let dragging = null; // { id, x, y } du pointeur qui glisse

  canvas.addEventListener("pointerdown", (event) => {
    if (!enabled() || event.button !== 0) return;
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("dragging");
    canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!dragging || event.pointerId !== dragging.id) return;
    orbit(camera, event.clientX - dragging.x, event.clientY - dragging.y);
    dragging.x = event.clientX;
    dragging.y = event.clientY;
  });
  const stop = (event) => {
    if (!dragging || event.pointerId !== dragging.id) return;
    dragging = null;
    canvas.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!enabled()) return;
      event.preventDefault();
      zoomBy(camera, Math.exp(-event.deltaY * 0.001));
    },
    { passive: false },
  );
  canvas.addEventListener("dblclick", () => {
    if (enabled()) resetCamera(camera);
  });
  canvas.addEventListener("keydown", (event) => {
    if (!enabled()) return;
    const moves = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    if (moves[event.key]) orbit(camera, ...moves[event.key]);
    else if (event.key === "+" || event.key === "=") zoomBy(camera, 1.1);
    else if (event.key === "-") zoomBy(camera, 1 / 1.1);
    else if (event.key === "0") resetCamera(camera);
    else return;
    event.preventDefault();
  });
};

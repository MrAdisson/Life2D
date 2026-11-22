// Commandes de la caméra orbitale (vue 3D) sur le canevas :
// - un pointeur (souris bouton gauche, doigt, stylet) qui glisse : tourner ;
// - clic droit (ou Maj + glisser) : déplacement latéral ;
// - deux doigts : pincer pour zoomer, glisser ensemble pour déplacer ;
// - molette : zoom ; double-clic : recentrer ;
// - clavier (canevas sélectionné) : flèches, Maj + flèches (déplacer),
//   + / −, 0.
// Actives seulement quand `enabled()` est vrai (vue 3D). `box()` donne la boîte
// { width, height, depth } pour convertir les pixels en déplacement. Les
// calculs sont dans camera.js.
import { orbit, pan, resetCamera, zoomBy } from "./camera.js";

const KEY_STEP = 15; // « pixels » de rotation ou de déplacement par appui

export const attachOrbitControls = (canvas, camera, { enabled, box }) => {
  const pointers = new Map(); // id -> { x, y, type }
  let mode = null; // "orbit" | "pan" (un pointeur) | "pinch" (deux doigts)
  let pinch = null; // { distance, x, y } au dernier événement

  const pinchState = () => {
    const [a, b] = [...pointers.values()];
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
  };

  canvas.addEventListener("contextmenu", (event) => {
    if (enabled()) event.preventDefault();
  });
  canvas.addEventListener("pointerdown", (event) => {
    if (!enabled()) return;
    const touch = event.pointerType !== "mouse";
    if (!touch && event.button !== 0 && event.button !== 2) return;
    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("dragging");
    canvas.focus({ preventScroll: true });
    if (pointers.size === 2) {
      mode = "pinch";
      pinch = pinchState();
    } else if (pointers.size === 1) {
      mode = event.button === 2 || event.shiftKey ? "pan" : "orbit";
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    const p = pointers.get(event.pointerId);
    if (!p) return;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    p.x = event.clientX;
    p.y = event.clientY;
    if (mode === "pinch" && pointers.size === 2) {
      const now = pinchState();
      if (pinch.distance > 0 && now.distance > 0) {
        zoomBy(camera, now.distance / pinch.distance);
      }
      pan(camera, now.x - pinch.x, now.y - pinch.y, box());
      pinch = now;
    } else if (mode === "pan") {
      pan(camera, dx, dy, box());
    } else if (mode === "orbit") {
      orbit(camera, dx, dy);
    }
  });
  const stop = (event) => {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size === 0) {
      mode = null;
      canvas.classList.remove("dragging");
    } else if (pointers.size === 1) {
      // Un doigt levé : le doigt restant fait tourner (sans saut).
      mode = "orbit";
    }
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
    if (moves[event.key]) {
      if (event.shiftKey) pan(camera, ...moves[event.key], box());
      else orbit(camera, ...moves[event.key]);
    } else if (event.key === "+" || event.key === "=") zoomBy(camera, 1.1);
    else if (event.key === "-") zoomBy(camera, 1 / 1.1);
    else if (event.key === "0") resetCamera(camera);
    else return;
    event.preventDefault();
  });
};

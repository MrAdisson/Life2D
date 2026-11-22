// Tests de la caméra orbitale de la vue 3D (camera.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PITCH,
  MAX_ZOOM,
  MIN_ZOOM,
  createCamera,
  orbit,
  pan,
  project,
  resetCamera,
  viewProjection,
  zoomBy,
} from "./camera.js";

const box = { width: 800, height: 600, depth: 600 };
const near = (a, b, eps = 1e-3) => Math.abs(a - b) < eps;

const at = (camera, x, y, z) =>
  project(viewProjection(camera, box).matrix, box, x, y, z);

test("caméra par défaut : de face, la face avant remplit la fenêtre", () => {
  const camera = createCamera();
  const center = at(camera, 400, 300, 300);
  assert.ok(near(center.x, 400) && near(center.y, 300));
  // Coins de la face avant (z = 0) aux coins de l'écran, y vers le bas.
  const topLeft = at(camera, 0, 0, 0);
  const bottomRight = at(camera, 800, 600, 0);
  assert.ok(near(topLeft.x, 0) && near(topLeft.y, 0), JSON.stringify(topLeft));
  assert.ok(near(bottomRight.x, 800) && near(bottomRight.y, 600));
  // Le fond (z = profondeur) est plus loin, donc plus près du centre.
  const back = at(camera, 0, 0, 600);
  assert.ok(back.w > topLeft.w);
  assert.ok(back.x > 0 && back.y > 0);
});

test("toute la boîte reste devant la caméra et entre les plans de découpe", () => {
  for (const [yaw, pitch, zoom] of [[0, 0, 1], [2, 1.2, 1], [-1, -1.5, MAX_ZOOM], [3, 0.3, MIN_ZOOM]]) {
    const camera = { yaw, pitch, zoom };
    const view = viewProjection(camera, box);
    for (const x of [0, 800]) for (const y of [0, 600]) for (const z of [0, 600]) {
      const p = project(view.matrix, box, x, y, z);
      if (zoom <= 1) {
        assert.ok(p.w >= view.near && p.w <= view.far, `${yaw},${pitch}`);
      }
      assert.ok(p.w <= view.far);
    }
  }
});

test("tourner d'un demi-tour montre la boîte de dos (gauche et droite inversées)", () => {
  const camera = createCamera();
  orbit(camera, Math.PI / 0.01, 0); // yaw = π
  const left = at(camera, 0, 300, 300);
  const right = at(camera, 800, 300, 300);
  assert.ok(left.x > right.x);
  // Le fond est maintenant devant.
  assert.ok(at(camera, 400, 300, 600).w < at(camera, 400, 300, 0).w);
});

test("incliner vers le bas fait voir le dessus ; l'inclinaison est bornée", () => {
  const camera = createCamera();
  orbit(camera, 0, 50); // pitch > 0
  // La face du haut (y = 0) se rapproche, celle du bas s'éloigne.
  assert.ok(at(camera, 400, 0, 300).w < at(camera, 400, 600, 300).w);
  orbit(camera, 0, 10000);
  assert.equal(camera.pitch, MAX_PITCH);
  orbit(camera, 0, -100000);
  assert.equal(camera.pitch, -MAX_PITCH);
});

test("zoom borné, double-clic (reset) : retour à la vue de face", () => {
  const camera = createCamera();
  const before = at(camera, 0, 0, 0);
  zoomBy(camera, 2);
  const zoomed = at(camera, 0, 0, 0);
  assert.ok(zoomed.x < before.x - 1); // le coin sort de l'écran
  zoomBy(camera, 1000);
  assert.equal(camera.zoom, MAX_ZOOM);
  zoomBy(camera, 1e-6);
  assert.equal(camera.zoom, MIN_ZOOM);
  zoomBy(camera, NaN);
  assert.equal(camera.zoom, MIN_ZOOM);
  orbit(camera, 123, 45);
  resetCamera(camera);
  assert.deepEqual(camera, createCamera());
  const back = at(camera, 0, 0, 0);
  assert.ok(near(back.x, before.x) && near(back.y, before.y));
});

test("la vue 3D (camera.js) ne dépend ni du moteur ni du navigateur", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("./camera.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /engine\.js|document|window/);
});

test("glisser vers la droite amène la face avant vers la droite", () => {
  const camera = createCamera();
  orbit(camera, 30, 0);
  assert.ok(at(camera, 400, 300, 0).x > 400);
  assert.ok(at(camera, 400, 300, 600).x < 400);
});

test("déplacement latéral : la boîte suit le glisser, la réinitialisation le remet", () => {
  const camera = createCamera();
  const before = at(camera, 400, 300, 300);
  pan(camera, 50, -20, box);
  const after = at(camera, 400, 300, 300);
  assert.ok(near(after.x - before.x, 50, 0.05), String(after.x - before.x));
  assert.ok(near(after.y - before.y, -20, 0.05), String(after.y - before.y));
  // Le déplacement est borné.
  pan(camera, 1e7, 0, box);
  assert.ok(camera.panX <= 800);
  resetCamera(camera);
  assert.deepEqual(camera, { yaw: 0, pitch: 0, zoom: 1, home: 1, panX: 0, panY: 0, follow: null, target: null });
});

test("zoom de départ donné par le préréglage : rétabli par la réinitialisation", () => {
  const camera = createCamera({ zoom: 3 });
  assert.equal(camera.zoom, 3);
  zoomBy(camera, 2);
  orbit(camera, 10, 10);
  resetCamera(camera);
  assert.equal(camera.zoom, 3);
  assert.deepEqual(camera, createCamera({ zoom: 3 }));
});

test("espace plus grand que l'écran : la face avant tient dans l'écran, centrée", () => {
  // Espace carré de 6 000 unités, écran de 800 × 600 pixels.
  const world = { width: 6000, height: 6000, depth: 300, screen: { width: 800, height: 600 } };
  const view = viewProjection(createCamera(), world);
  const centre = project(view.matrix, world, 3000, 3000, 150);
  assert.ok(near(centre.x, 400) && near(centre.y, 300), JSON.stringify(centre));
  // Face avant : la hauteur remplit l'écran, les proportions sont gardées
  // (carré de 600 × 600 pixels au centre).
  const topLeft = project(view.matrix, world, 0, 0, 0);
  const bottomRight = project(view.matrix, world, 6000, 6000, 0);
  assert.ok(near(topLeft.x, 100) && near(topLeft.y, 0), JSON.stringify(topLeft));
  assert.ok(near(bottomRight.x, 700) && near(bottomRight.y, 600), JSON.stringify(bottomRight));
  // Le déplacement latéral suit toujours le doigt, en pixels d'écran.
  const camera = createCamera();
  pan(camera, 40, 0, world);
  const moved = project(viewProjection(camera, world).matrix, world, 3000, 3000, 150);
  assert.ok(near(moved.x - 400, 40, 0.05), String(moved.x));
});

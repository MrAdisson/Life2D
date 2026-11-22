// Caméra orbitale de la vue 3D : tourne autour du centre de la boîte de
// simulation (largeur × hauteur × profondeur). Sans accès à la page : calculs
// seulement, testables avec node --test.
//
// Repère de la simulation : x vers la droite, y vers le bas (comme l'écran),
// z vers le fond (z = 0 : face avant). Caméra par défaut : de face, la face
// avant de la boîte remplit à peu près la fenêtre (même cadrage que la vue 2D).

export const FOV = Math.PI / 4; // champ vertical de 45°
const FOCAL = 1 / Math.tan(FOV / 2);
export const MAX_PITCH = Math.PI / 2 - 0.01; // pas de retournement par le pôle
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 5;
// Radians par pixel glissé.
export const ORBIT_SPEED = 0.01;

export const createCamera = () => ({ yaw: 0, pitch: 0, zoom: 1 });

export const resetCamera = (camera) => {
  camera.yaw = 0;
  camera.pitch = 0;
  camera.zoom = 1;
  return camera;
};

// Glisser de (dx, dy) pixels : tourne autour de l'axe vertical (dx) et
// incline (dy), inclinaison bornée à ±90°.
export const orbit = (camera, dx, dy) => {
  camera.yaw += dx * ORBIT_SPEED;
  camera.yaw = Math.atan2(Math.sin(camera.yaw), Math.cos(camera.yaw));
  camera.pitch = Math.max(
    -MAX_PITCH,
    Math.min(MAX_PITCH, camera.pitch + dy * ORBIT_SPEED),
  );
  return camera;
};

// factor > 1 : rapproche (zoom avant) ; borné à MIN_ZOOM…MAX_ZOOM.
export const zoomBy = (camera, factor) => {
  if (!(factor > 0)) return camera;
  camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * factor));
  return camera;
};

// Distance de la caméra au centre de la boîte au zoom 1 : la face avant
// (width × height) tient dans le champ.
const baseDistance = ({ width, height, depth }) => {
  const aspect = width / height;
  const halfFit = Math.max(height / 2, width / 2 / aspect);
  return halfFit * FOCAL + depth / 2;
};

// Matrice 4×4 (colonnes d'abord, comme WebGL) qui envoie un point (x, y, z)
// de la simulation dans l'espace de découpe, et données utiles au rendu :
// focal (pixels écran par unité à distance 1, pour la taille des disques),
// near/far (plans de découpe, la boîte entière tient entre les deux), shade.
export const viewProjection = (camera, { width, height, depth }) => {
  const aspect = width / height;
  const distance = baseDistance({ width, height, depth }) / camera.zoom;
  const radius = Math.hypot(width, height, depth) / 2;
  const near = Math.max(1, distance - radius * 1.5);
  const far = distance + radius * 1.5;
  const cy = Math.cos(camera.yaw);
  // Signes choisis pour « attraper » la boîte : glisser vers la droite
  // amène la face avant vers la droite, vers le bas montre le dessus
  // (pitch > 0 : caméra au-dessus).
  const sy = -Math.sin(camera.yaw);
  const cp = Math.cos(camera.pitch);
  const sp = -Math.sin(camera.pitch);
  // Point centré, y vers le haut : p = (x - w/2, h/2 - y, z - d/2).
  // Rotation R = Rx(pitch) · Ry(yaw), puis recul de `distance` le long de z
  // (profondeur vue = v.z, positive devant la caméra).
  // Ry : (x, y, z) -> (cy x + sy z, y, -sy x + cy z)
  // Rx : (x, y, z) -> (x, cp y - sp z, sp y + cp z)
  const R = [
    [cy, 0, sy],
    [sp * sy, cp, -sp * cy],
    [-cp * sy, sp, cp * cy],
  ];
  // Affine A : p = A·(x, y, z, 1).
  const A = [
    [1, 0, 0, -width / 2],
    [0, -1, 0, height / 2],
    [0, 0, 1, -depth / 2],
  ];
  // V = R·A + (0, 0, distance).
  const V = R.map((row, i) =>
    [0, 1, 2, 3].map(
      (k) =>
        row[0] * A[0][k] + row[1] * A[1][k] + row[2] * A[2][k] +
        (i === 2 && k === 3 ? distance : 0),
    ),
  );
  // Projection : clip = (f/aspect·vx, f·vy, a·vz + b, vz).
  const a = (far + near) / (far - near);
  const b = (-2 * far * near) / (far - near);
  const rows = [
    V[0].map((v) => (v * FOCAL) / aspect),
    V[1].map((v) => v * FOCAL),
    V[2].map((v, k) => v * a + (k === 3 ? b : 0)),
    V[2],
  ];
  const matrix = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) matrix[c * 4 + r] = rows[r][c];
  }
  return {
    matrix,
    focal: (FOCAL * height) / 2,
    near,
    far,
    distance,
    // Distances du point de la boîte le plus proche et du plus lointain (au
    // plus) : teinte des particules selon la profondeur.
    shade: [Math.max(0, distance - radius), distance + radius],
  };
};

// Projette un point de la simulation en pixels écran (tests, outils) :
// { x, y, w } avec w = profondeur vue (> 0 devant la caméra).
export const project = (matrix, { width, height }, x, y, z) => {
  const m = matrix;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
  const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return {
    x: ((cx / w + 1) / 2) * width,
    y: ((1 - cy / w) / 2) * height,
    w,
  };
};

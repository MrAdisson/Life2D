// Moteur de simulation : indépendant du navigateur (aucun accès à la page ni au
// rendu), exécutable tel quel par node --test.
// Réglage : voir settings.js.
//
// L'état des particules vit dans des Float64Array (une case par particule).
// Les particules sont numérotées type par type, dans l'ordre de settings.types.
// Les objets de `particles` et `groups` sont des vues sur ces tableaux.

const FIELDS = [
  "x", "y", "z", "vx", "vy", "vz", "ax", "ay", "az", "mass", "radius",
];

// Cases de la grille : côté = portée / CELLS_PER_RANGE (des cases plus petites
// que la portée réduisent le nombre de paires examinées).
const CELLS_PER_RANGE = 2;

// Plafond du nombre de cases de la grille (une portée minuscule ne doit pas
// allouer une grille gigantesque : des cases plus grandes restent correctes).
const MAX_CELLS = 1 << 20;

export class ParticleView {
  constructor(state, index, color, type) {
    this.state = state;
    this.index = index;
    this.color = color;
    this.type = type;
  }
}
for (const field of FIELDS) {
  Object.defineProperty(ParticleView.prototype, field, {
    get() {
      return this.state[field][this.index];
    },
    set(value) {
      this.state[field][this.index] = value;
    },
  });
}

// settings : réglage ; width/height : dimensions de l'espace ;
// depth : profondeur de l'espace en 3D si le réglage n'a pas de `depth`
// (par défaut : la plus petite de width et height) ;
// random : générateur [0,1[ (Math.random par défaut, injectable pour les tests).
//
// Le réglage est lu par référence : friction, portée, bords, epsilon, gravité
// et règles sont relus à chaque pas, donc modifiables en cours de simulation.
// Les types, leurs nombres et leurs masses sont pris en compte par sync() (à
// appeler après les avoir modifiés) ; reseed() tire de nouvelles positions.
//
// settings.dimensions (2 par défaut, ou 3) est lu une fois, à la création. En
// 2D, z, vz et az restent à 0 et le calcul est exactement celui d'avant l'axe z
// (même code, mêmes tirages aléatoires) ; en 3D, la distance, la grille et les
// bords portent sur les trois axes, la profondeur (settings.depth, relue à
// chaque pas) bornant z.
// Corps explicites : un type peut lister `bodies` ([{ name, position,
// velocity, mass, radius }], voir settings.js) ; ses premières particules
// prennent cet état exact au lieu d'un tirage. En 2D, la composante z donnée
// est ignorée (z et vz restent à 0) ; un tableau de deux nombres donne z = 0.
//
// settings.interaction (relu à chaque pas) : "rules" (par défaut) applique la
// matrice de règles dans la portée (grille spatiale) ; "gravity" applique la
// gravitation universelle G·mi·mj/(d² + ε²) entre toutes les paires (G =
// settings.G, 1 par défaut ; ε = settings.epsilon), sans portée ni règles. À
// ne pas confondre avec settings.gravity (accélération verticale constante),
// qui s'applique dans les deux modes.
//
// Pas de temps : settings.dt (nombre > 0, 1 par défaut), relu à chaque pas ;
// step() fait avancer le temps simulé (`time`) de dt. Mode "rules" : même
// intégration qu'avant (Euler semi-implicite : vitesse puis position), avec dt
// en facteur (dt = 1 : calcul identique au bit près). Mode "gravity" :
// intégrateur symplectique vitesse-Verlet (demi-pas de vitesse, pas de
// position, nouvelles forces, demi-pas de vitesse), qui ne dérive pas en
// énergie sur une orbite. La friction est un facteur par unité de temps
// (friction^dt par pas) et la gravité verticale une accélération par unité de
// temps². frame() enchaîne settings.substeps pas de dt (entier de 1 à
// MAX_SUBSTEPS, 1 par défaut, relu à chaque image) : c'est un pas d'image.
const component = (values, k) => {
  const v = Array.isArray(values) ? values[k] : undefined;
  return Number.isFinite(v) ? v : 0;
};

// "gravity" : gravitation universelle entre tous les corps ; sinon "rules".
export const interactionOf = (settings) =>
  settings.interaction === "gravity" ? "gravity" : "rules";

export const dimensionsOf = (settings) => (settings.dimensions === 3 ? 3 : 2);

// Plafond du nombre de sous-pas par image (le temps de calcul d'une image est
// proportionnel au nombre de sous-pas).
export const MAX_SUBSTEPS = 100;

// Pas de temps : nombre fini > 0, sinon 1.
export const timeStepOf = (settings) =>
  settings.dt > 0 && Number.isFinite(settings.dt) ? settings.dt : 1;

// Sous-pas par image : entier de 1 à MAX_SUBSTEPS (partie entière ; absent ou
// invalide : 1).
export const substepsOf = (settings) => {
  const n = Math.floor(settings.substeps);
  return n >= 1 ? Math.min(n, MAX_SUBSTEPS) : 1;
};

export const createSimulation = (
  settings,
  { width, height, depth: defaultDepth, random = Math.random },
) => {
  const is3d = dimensionsOf(settings) === 3;
  const fallbackDepth = defaultDepth ?? Math.min(width, height);
  const readDepth = () =>
    settings.depth > 0 && Number.isFinite(settings.depth)
      ? settings.depth
      : fallbackDepth;
  let depth = readDepth();

  // Position et vitesse de départ du corps ; accélération à zéro.
  const placeBody = (target, n, body) => {
    target.x[n] = component(body.position, 0);
    target.y[n] = component(body.position, 1);
    target.vx[n] = component(body.velocity, 0);
    target.vy[n] = component(body.velocity, 1);
    target.ax[n] = target.ay[n] = 0;
    if (is3d) {
      target.z[n] = component(body.position, 2);
      target.vz[n] = component(body.velocity, 2);
      target.az[n] = 0;
    }
  };
  let count = 0;
  let state = {};
  for (const field of FIELDS) state[field] = new Float64Array(0);
  let typeIndex = new Uint16Array(0);
  let groups = new Map();
  let particles = [];
  let drawOrder = new Uint32Array(0);
  // Disposition courante : nom, nombre et masse de chaque type, dans l'ordre.
  let layout = [];
  // Corps explicite de chaque particule (entrée de `type.bodies`), ou null.
  let bodyOf = [];

  // Grille et coefficients (réalloués quand la taille change).
  let cellOf, cellItems, cellX, cellY, cellZ, cellType;
  let cellStart = new Uint32Array(0);
  let cellCursor = new Uint32Array(0);
  let T = 0;
  let GT = new Float64Array(0);
  let range = Infinity;
  let range2 = Infinity;
  let cols = 1;
  let rows = 1;
  let layers = 1;
  let reach = 0;
  let inv = 0;
  let epsilon = settings.epsilon;
  // Mode d'interaction : "rules" (matrice de règles, par défaut) ou
  // "gravity" (gravitation universelle entre tous les corps), relu à chaque pas.
  let gravityMode = false;
  let G = 1;
  // Vitesse-Verlet (mode gravité) : ax, ay, az gardent d'un pas à l'autre
  // l'accélération aux positions courantes. Elle est recalculée quand elle
  // n'est plus valable : création, sync(), reseed(), passage du mode des
  // règles au mode gravité, changement de G ou d'epsilon.
  let accelReady = false;
  let accelG = NaN;
  let accelEpsilon = NaN;
  let wasGravity = false;
  // Temps simulé écoulé depuis la création ou le dernier reseed().
  let time = 0;

  const sameLayout = () =>
    layout.length === settings.types.length &&
    layout.every(
      (l, t) =>
        l.name === settings.types[t].name &&
        l.count === settings.types[t].count &&
        l.mass === (settings.types[t].mass || 0),
    );

  // Reconstruit les tableaux d'après settings.types. Une particule d'un type
  // qui existait déjà garde son état ; les premières sont conservées si le
  // nombre baisse, de nouvelles sont tirées s'il monte ; un type disparu perd
  // ses particules. Si la masse fixe d'un type change, ses particules déjà
  // présentes prennent la nouvelle masse et le rayon qui en dépend (positions
  // et vitesses conservées). Les `bodies.length` premières particules d'un type
  // à corps explicites (`type.bodies`) sont créées à l'état donné ; un corps
  // retiré (nombre en baisse) puis rajouté repart de cet état. Renvoie false
  // si rien n'a changé.
  const sync = () => {
    if (sameLayout()) return false;
    accelReady = false;
    const { types } = settings;
    const old = { state, typeIndex };
    const oldStart = new Map();
    {
      let o = 0;
      for (const l of layout) {
        oldStart.set(l.name, { start: o, count: l.count, mass: l.mass });
        o += l.count;
      }
    }
    const total = types.reduce((n, t) => n + t.count, 0);
    const next = {};
    for (const field of FIELDS) next[field] = new Float64Array(total);
    const nextType = new Uint16Array(total);
    const nextBodies = new Array(total);
    const nextGroups = new Map();
    const views = [];
    let n = 0;
    types.forEach((type, t) => {
      const group = [];
      const previous = oldStart.get(type.name);
      const kept = previous ? Math.min(previous.count, type.count) : 0;
      // Nouvelle masse fixe : appliquée aux particules conservées. Masse
      // aléatoire (absente ou 0) : chaque particule garde la sienne.
      const remass =
        previous && type.mass > 0 && type.mass !== previous.mass;
      const bodies = Array.isArray(type.bodies) ? type.bodies : [];
      for (let k = 0; k < type.count; k++, n++) {
        const body = k < bodies.length ? bodies[k] : null;
        nextBodies[n] = body;
        if (k < kept) {
          for (const field of FIELDS) {
            next[field][n] = old.state[field][previous.start + k];
          }
          if (remass) {
            // Un corps garde sa masse et son rayon propres s'il en a.
            if (!(body?.mass > 0)) next.mass[n] = type.mass;
            if (!(body?.radius > 0)) next.radius[n] = next.mass[n] / 2 + 2;
          }
        } else if (body) {
          // Corps explicite : état donné, aucun tirage aléatoire (sauf une
          // masse si ni le corps ni son type n'en fixent).
          placeBody(next, n, body);
          next.mass[n] = body.mass > 0 ? body.mass : type.mass || random() * 50;
          next.radius[n] =
            body.radius > 0 ? body.radius : next.mass[n] / 2 + 2;
        } else {
          // Même ordre de tirage que la version précédente (x, y, masse) ;
          // en 3D, z est tiré juste après y.
          next.x[n] = random() * width;
          next.y[n] = random() * height;
          if (is3d) next.z[n] = random() * depth;
          next.mass[n] = type.mass || random() * 50;
          next.radius[n] = next.mass[n] / 2 + 2;
        }
        nextType[n] = t;
        const view = new ParticleView(next, n, type.color, type.name);
        group.push(view);
        views.push(view);
      }
      nextGroups.set(type.name, group);
    });
    state = next;
    typeIndex = nextType;
    bodyOf = nextBodies;
    groups = nextGroups;
    count = total;
    layout = types.map((t) => ({ name: t.name, count: t.count, mass: t.mass || 0 }));
    // Ordre d'affichage (et de `particles`) : masse décroissante, stable.
    particles = views.slice().sort((a, b) => b.mass - a.mass);
    drawOrder = Uint32Array.from(particles, (p) => p.index);
    cellOf = new Uint32Array(count);
    cellItems = new Uint32Array(count);
    cellX = new Float64Array(count);
    cellY = new Float64Array(count);
    cellZ = is3d ? new Float64Array(count) : null;
    cellType = new Uint32Array(count);
    return true;
  };

  // Nouveau tirage : positions au hasard, vitesses et accélérations à zéro
  // (comme au démarrage) ; nombres, masses et règles inchangés. Les corps
  // explicites reprennent leur position et leur vitesse de départ (sans
  // tirage : les autres particules reçoivent les mêmes tirages que s'ils
  // n'existaient pas).
  const reseed = () => {
    const { x, y, z, vx, vy, vz, ax, ay, az } = state;
    for (let i = 0; i < count; i++) {
      if (bodyOf[i]) {
        placeBody(state, i, bodyOf[i]);
        continue;
      }
      x[i] = random() * width;
      y[i] = random() * height;
      if (is3d) {
        z[i] = random() * depth;
        vz[i] = az[i] = 0;
      }
      vx[i] = vy[i] = ax[i] = ay[i] = 0;
    }
    accelReady = false;
    time = 0;
  };

  // Relit portée, epsilon, règles et dimensions de la grille.
  const prepare = () => {
    const { types, rules = {} } = settings;
    epsilon = settings.epsilon;
    gravityMode = interactionOf(settings) === "gravity";
    if (gravityMode) {
      // Gravitation : portée illimitée, pas de règles ni de grille.
      G = Number.isFinite(settings.G) ? settings.G : 1;
      epsilon = epsilon >= 0 && Number.isFinite(epsilon) ? epsilon : 0;
      range = range2 = Infinity;
      if (G !== accelG || epsilon !== accelEpsilon) accelReady = false;
      return;
    }
    range = settings.range ?? Infinity;
    if (!(range >= 0)) range = Infinity;
    range2 = range * range;
    // GT[b * T + a] = coefficient appliqué au type a du fait du type b
    // (règle absente : 0).
    T = types.length;
    if (GT.length !== T * T) GT = new Float64Array(T * T);
    for (let a = 0; a < T; a++) {
      for (let b = 0; b < T; b++) {
        GT[b * T + a] = rules[types[a].name]?.[types[b].name] ?? 0;
      }
    }
    // Grille spatiale : toute paire dans la portée est séparée d'au plus
    // `reach` cases sur chaque axe. Portée illimitée : une seule case (toutes
    // les paires sont examinées).
    let cellSize;
    if (is3d) {
      depth = readDepth();
      cellSize = Math.max(
        range / CELLS_PER_RANGE,
        Math.cbrt((width * height * depth) / MAX_CELLS),
      );
    } else {
      cellSize = Math.max(
        range / CELLS_PER_RANGE,
        Math.sqrt((width * height) / MAX_CELLS),
      );
    }
    if (!(cellSize > 0)) cellSize = Infinity;
    cols = Math.max(1, Math.min(MAX_CELLS, Math.ceil(width / cellSize)));
    rows = Math.max(1, Math.min(MAX_CELLS, Math.ceil(height / cellSize)));
    layers = is3d
      ? Math.max(1, Math.min(MAX_CELLS, Math.ceil(depth / cellSize)))
      : 1;
    reach = Number.isFinite(cellSize) ? Math.ceil(range / cellSize) : 0;
    inv = 1 / cellSize;
    const cells = cols * rows * layers;
    if (cellStart.length !== cells + 1) {
      cellStart = new Uint32Array(cells + 1);
      cellCursor = new Uint32Array(cells);
    }
  };

  const cellCoord = (v, size) => {
    const c = Math.floor(v * inv);
    if (!(c >= 0)) return 0; // négatif, NaN
    return c >= size ? size - 1 : c;
  };

  const fillGrid = () => {
    const { x, y } = state;
    cellStart.fill(0);
    for (let i = 0; i < count; i++) {
      const c = cellCoord(y[i], rows) * cols + cellCoord(x[i], cols);
      cellOf[i] = c;
      cellStart[c + 1]++;
    }
    for (let c = 0; c < cols * rows; c++) cellStart[c + 1] += cellStart[c];
    // Tri par case, stable : indices croissants dans chaque case.
    cellCursor.set(cellStart.subarray(0, cols * rows));
    for (let i = 0; i < count; i++) {
      const s = cellCursor[cellOf[i]]++;
      cellItems[s] = i;
      cellX[s] = x[i];
      cellY[s] = y[i];
      cellType[s] = typeIndex[i];
    }
  };

  // Forces. Pour chaque particule i, les contributions des autres particules j
  // sont ajoutées par j croissant, comme dans le calcul en O(n²) : le résultat
  // est identique au bit près à un calcul de référence limité à la portée.
  const applyForces = () => {
    const { x, y, ax, ay, mass } = state;
    fillGrid();
    for (let j = 0; j < count; j++) {
      const xj = x[j];
      const yj = y[j];
      const mj = mass[j];
      const gRow = typeIndex[j] * T;
      const cj = cellOf[j];
      const cx = cj % cols;
      const cy = (cj - cx) / cols;
      const c0 = cx > reach ? cx - reach : 0;
      const c1 = cx + reach < cols ? cx + reach : cols - 1;
      const r0 = cy > reach ? cy - reach : 0;
      const r1 = cy + reach < rows ? cy + reach : rows - 1;
      for (let r = r0; r <= r1; r++) {
        const end = cellStart[r * cols + c1 + 1];
        for (let s = cellStart[r * cols + c0]; s < end; s++) {
          const dx = cellX[s] - xj;
          const dy = cellY[s] - yj;
          const d2 = dx * dx + dy * dy;
          if (d2 > range2) continue; // hors de portée : aucune force
          const g = GT[gRow + cellType[s]];
          if (g === 0) continue;
          const i = cellItems[s];
          if (i === j) continue;
          const mi = mass[i];
          const distance = Math.sqrt(d2) + epsilon;
          const force = (g * mi * mj) / distance ** 2;
          ax[i] += (force * dx) / distance / mi;
          ay[i] += (force * dy) / distance / mi;
        }
      }
    }
  };

  // Friction hors de 0…1 ramenée dans la plage ; non numérique : 1. Facteur
  // par unité de temps : friction^dt pour un pas de dt (dt = 1 : inchangée).
  const frictionFor = (dt) => {
    const f = settings.friction;
    const friction = f >= 0 ? (f <= 1 ? f : 1) : f < 0 ? 0 : 1;
    return dt === 1 ? friction : friction ** dt;
  };
  // Gravité : accélération constante vers le bas (négative : vers le haut),
  // en pixels par unité de temps², la même pour toutes les particules.
  const verticalGravity = () =>
    Number.isFinite(settings.gravity) ? settings.gravity : 0;

  // Euler semi-implicite (mode des règles) : vitesse, puis position, dt en
  // facteur (multiplier par 1 est exact : dt = 1 donne le calcul d'avant).
  const update = (dt) => {
    const { x, y, vx, vy, ax, ay, radius } = state;
    const friction = frictionFor(dt);
    const gravity = verticalGravity();
    const wrap = settings.edges === "wrap";
    for (let i = 0; i < count; i++) {
      const r = radius[i];
      if (!wrap) {
        // Rebond sur les bords
        if (x[i] + r > width || x[i] - r < 0) {
          vx[i] = -vx[i];
          ax[i] = -ax[i];
        }
        if (y[i] - r < 0 || y[i] + r > height) {
          vy[i] = -vy[i];
          ay[i] = -ay[i];
        }
      }
      vx[i] += ax[i] * dt;
      vy[i] += ay[i] * dt;
      if (gravity !== 0) vy[i] += gravity * dt;
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      if (wrap) {
        // Bords qui se rejoignent : sortie d'un côté, retour par l'autre.
        x[i] = ((x[i] % width) + width) % width;
        y[i] = ((y[i] % height) + height) % height;
      }
      vx[i] *= friction;
      vy[i] *= friction;
      ax[i] = 0;
      ay[i] = 0;
    }
  };

  // --- 3D : mêmes calculs avec l'axe z (code séparé : le chemin 2D reste
  // inchangé, au bit près et en temps de calcul). ---

  const fillGrid3d = () => {
    const { x, y, z } = state;
    const cells = cols * rows * layers;
    cellStart.fill(0);
    for (let i = 0; i < count; i++) {
      const c =
        (cellCoord(z[i], layers) * rows + cellCoord(y[i], rows)) * cols +
        cellCoord(x[i], cols);
      cellOf[i] = c;
      cellStart[c + 1]++;
    }
    for (let c = 0; c < cells; c++) cellStart[c + 1] += cellStart[c];
    cellCursor.set(cellStart.subarray(0, cells));
    for (let i = 0; i < count; i++) {
      const s = cellCursor[cellOf[i]]++;
      cellItems[s] = i;
      cellX[s] = x[i];
      cellY[s] = y[i];
      cellZ[s] = z[i];
      cellType[s] = typeIndex[i];
    }
  };

  const applyForces3d = () => {
    const { x, y, z, ax, ay, az, mass } = state;
    fillGrid3d();
    const plane = cols * rows;
    for (let j = 0; j < count; j++) {
      const xj = x[j];
      const yj = y[j];
      const zj = z[j];
      const mj = mass[j];
      const gRow = typeIndex[j] * T;
      const cj = cellOf[j];
      const cx = cj % cols;
      const cyz = (cj - cx) / cols;
      const cy = cyz % rows;
      const cz = (cyz - cy) / rows;
      const c0 = cx > reach ? cx - reach : 0;
      const c1 = cx + reach < cols ? cx + reach : cols - 1;
      const r0 = cy > reach ? cy - reach : 0;
      const r1 = cy + reach < rows ? cy + reach : rows - 1;
      const l0 = cz > reach ? cz - reach : 0;
      const l1 = cz + reach < layers ? cz + reach : layers - 1;
      for (let l = l0; l <= l1; l++) {
        for (let r = r0; r <= r1; r++) {
          const base = l * plane + r * cols;
          const end = cellStart[base + c1 + 1];
          for (let s = cellStart[base + c0]; s < end; s++) {
            const dx = cellX[s] - xj;
            const dy = cellY[s] - yj;
            const dz = cellZ[s] - zj;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > range2) continue;
            const g = GT[gRow + cellType[s]];
            if (g === 0) continue;
            const i = cellItems[s];
            if (i === j) continue;
            const mi = mass[i];
            const distance = Math.sqrt(d2) + epsilon;
            const force = (g * mi * mj) / distance ** 2;
            ax[i] += (force * dx) / distance / mi;
            ay[i] += (force * dy) / distance / mi;
            az[i] += (force * dz) / distance / mi;
          }
        }
      }
    }
  };

  const update3d = (dt) => {
    const { x, y, z, vx, vy, vz, ax, ay, az, radius } = state;
    const friction = frictionFor(dt);
    const gravity = verticalGravity();
    const wrap = settings.edges === "wrap";
    for (let i = 0; i < count; i++) {
      const r = radius[i];
      if (!wrap) {
        if (x[i] + r > width || x[i] - r < 0) {
          vx[i] = -vx[i];
          ax[i] = -ax[i];
        }
        if (y[i] - r < 0 || y[i] + r > height) {
          vy[i] = -vy[i];
          ay[i] = -ay[i];
        }
        if (z[i] - r < 0 || z[i] + r > depth) {
          vz[i] = -vz[i];
          az[i] = -az[i];
        }
      }
      vx[i] += ax[i] * dt;
      vy[i] += ay[i] * dt;
      vz[i] += az[i] * dt;
      if (gravity !== 0) vy[i] += gravity * dt;
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      z[i] += vz[i] * dt;
      if (wrap) {
        x[i] = ((x[i] % width) + width) % width;
        y[i] = ((y[i] % height) + height) % height;
        z[i] = ((z[i] % depth) + depth) % depth;
      }
      vx[i] *= friction;
      vy[i] *= friction;
      vz[i] *= friction;
      ax[i] = 0;
      ay[i] = 0;
      az[i] = 0;
    }
  };

  // --- Gravitation universelle (interaction: "gravity") ---
  // Calcul direct sur toutes les paires (n(n-1)/2), prévu pour quelques
  // centaines de corps au plus. Accélération de i due à j :
  // G·mj·(rj − ri) / (d² + ε²)^(3/2), toujours attractive (adoucissement
  // quadratique : pas de singularité quand d → 0, loi en 1/d² dès que d ≫ ε).
  // En 2D, z vaut 0 partout : dz = 0 et az reste à 0.
  const applyGravity = () => {
    const { x, y, z, ax, ay, az, mass } = state;
    const eps2 = epsilon * epsilon;
    for (let i = 0; i < count; i++) {
      const xi = x[i];
      const yi = y[i];
      const zi = z[i];
      const mi = mass[i];
      let axi = 0;
      let ayi = 0;
      let azi = 0;
      for (let j = i + 1; j < count; j++) {
        const dx = x[j] - xi;
        const dy = y[j] - yi;
        const dz = z[j] - zi;
        const s2 = dx * dx + dy * dy + dz * dz + eps2;
        if (!(s2 > 0)) continue; // corps confondus sans adoucissement
        const k = G / (s2 * Math.sqrt(s2));
        const kj = k * mass[j];
        const ki = k * mi;
        axi += kj * dx;
        ayi += kj * dy;
        azi += kj * dz;
        ax[j] -= ki * dx;
        ay[j] -= ki * dy;
        az[j] -= ki * dz;
      }
      ax[i] += axi;
      ay[i] += ayi;
      az[i] += azi;
    }
  };

  // Accélérations gravitationnelles aux positions courantes.
  const computeGravity = () => {
    const { ax, ay, az } = state;
    ax.fill(0, 0, count);
    ay.fill(0, 0, count);
    az.fill(0, 0, count);
    applyGravity();
    accelReady = true;
    accelG = G;
    accelEpsilon = epsilon;
  };

  // Vitesse-Verlet (« kick-drift-kick ») : symplectique, l'énergie d'une
  // orbite oscille sans dériver. La gravité verticale s'ajoute à
  // l'accélération ; la friction est appliquée en fin de pas. Rebond : la
  // vitesse est inversée avant le demi-pas (l'accélération, qui dépend
  // seulement des positions, reste celle des forces).
  const updateVerlet = (dt) => {
    const { x, y, z, vx, vy, vz, ax, ay, az, radius } = state;
    if (!accelReady) computeGravity();
    const half = dt / 2;
    const friction = frictionFor(dt);
    const gravity = verticalGravity();
    const wrap = settings.edges === "wrap";
    for (let i = 0; i < count; i++) {
      const r = radius[i];
      if (!wrap) {
        if (x[i] + r > width || x[i] - r < 0) vx[i] = -vx[i];
        if (y[i] - r < 0 || y[i] + r > height) vy[i] = -vy[i];
        if (is3d && (z[i] - r < 0 || z[i] + r > depth)) vz[i] = -vz[i];
      }
      vx[i] += ax[i] * half;
      vy[i] += (ay[i] + gravity) * half;
      x[i] += vx[i] * dt;
      y[i] += vy[i] * dt;
      if (is3d) {
        vz[i] += az[i] * half;
        z[i] += vz[i] * dt;
      }
      if (wrap) {
        x[i] = ((x[i] % width) + width) % width;
        y[i] = ((y[i] % height) + height) % height;
        if (is3d) z[i] = ((z[i] % depth) + depth) % depth;
      }
    }
    computeGravity();
    for (let i = 0; i < count; i++) {
      vx[i] = (vx[i] + ax[i] * half) * friction;
      vy[i] = (vy[i] + (ay[i] + gravity) * half) * friction;
      if (is3d) vz[i] = (vz[i] + az[i] * half) * friction;
    }
  };

  // Un pas de dt (settings.dt, relu à chaque pas).
  const step = () => {
    const dt = timeStepOf(settings);
    prepare();
    if (gravityMode) {
      if (!wasGravity) accelReady = false;
      updateVerlet(dt);
    } else {
      if (wasGravity) {
        // Les accélérations gardées par Verlet ne valent pas pour les règles.
        state.ax.fill(0, 0, count);
        state.ay.fill(0, 0, count);
        state.az.fill(0, 0, count);
      }
      if (is3d) {
        applyForces3d();
        update3d(dt);
      } else {
        applyForces();
        update(dt);
      }
    }
    wasGravity = gravityMode;
    time += dt;
  };

  // Un pas d'image : settings.substeps pas de dt (relu à chaque image).
  // Renvoie le nombre de pas calculés.
  const frame = () => {
    const n = substepsOf(settings);
    for (let k = 0; k < n; k++) step();
    return n;
  };

  // Copie les positions dans l'ordre d'affichage : [x0, y0, x1, y1, ...]
  // (stride 2) ou [x0, y0, z0, x1, y1, z1, ...] (stride 3 ; z = 0 en 2D).
  const writePositions = (target, stride = 2) => {
    target ??= new Float32Array(count * stride);
    const { x, y, z } = state;
    if (stride === 3) {
      for (let k = 0; k < count; k++) {
        const i = drawOrder[k];
        target[3 * k] = x[i];
        target[3 * k + 1] = y[i];
        target[3 * k + 2] = z[i];
      }
    } else {
      for (let k = 0; k < count; k++) {
        const i = drawOrder[k];
        target[2 * k] = x[i];
        target[2 * k + 1] = y[i];
      }
    }
    return target;
  };

  sync();
  prepare();

  return {
    get count() {
      return count;
    },
    get range() {
      return range;
    },
    get dimensions() {
      return is3d ? 3 : 2;
    },
    get depth() {
      return is3d ? depth : 0;
    },
    get state() {
      return state;
    },
    get typeIndex() {
      return typeIndex;
    },
    get drawOrder() {
      return drawOrder;
    },
    get particles() {
      return particles;
    },
    get groups() {
      return groups;
    },
    // Temps simulé écoulé (somme des dt des pas calculés) depuis la création
    // ou le dernier reseed().
    get time() {
      return time;
    },
    step,
    frame,
    sync,
    reseed,
    writePositions,
  };
};

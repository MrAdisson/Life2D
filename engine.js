// Moteur de simulation : indépendant du navigateur (aucun accès à la page ni au
// rendu), exécutable tel quel par node --test.
// Réglage : voir settings.js.
//
// L'état des particules vit dans des Float64Array (une case par particule).
// Les particules sont numérotées type par type, dans l'ordre de settings.types.
// Les objets de `particles` et `groups` sont des vues sur ces tableaux.

const FIELDS = ["x", "y", "vx", "vy", "ax", "ay", "mass", "radius"];

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
// random : générateur [0,1[ (Math.random par défaut, injectable pour les tests).
export const createSimulation = (
  settings,
  { width, height, random = Math.random },
) => {
  const { epsilon, friction, types, rules = {} } = settings;
  const range = settings.range ?? Infinity;
  const range2 = range * range;
  const count = types.reduce((n, t) => n + t.count, 0);

  const state = {};
  for (const field of FIELDS) state[field] = new Float64Array(count);
  const { x, y, vx, vy, ax, ay, mass, radius } = state;
  const typeIndex = new Uint16Array(count);

  // Création : même ordre de tirage que la version précédente (x, y, masse).
  const groups = new Map();
  const views = [];
  let n = 0;
  types.forEach((type, t) => {
    const group = [];
    for (let k = 0; k < type.count; k++, n++) {
      x[n] = random() * width;
      y[n] = random() * height;
      mass[n] = type.mass || random() * 50;
      radius[n] = mass[n] / 2 + 2;
      typeIndex[n] = t;
      const view = new ParticleView(state, n, type.color, type.name);
      group.push(view);
      views.push(view);
    }
    groups.set(type.name, group);
  });

  // Coefficients : G[a * T + b] = rules[a][b] (0 si absent).
  const T = types.length;
  const G = new Float64Array(T * T);
  for (let a = 0; a < T; a++) {
    for (let b = 0; b < T; b++) {
      G[a * T + b] = rules[types[a].name]?.[types[b].name] ?? 0;
    }
  }

  // Ordre d'affichage (et de `particles`) : masse décroissante, stable.
  const particles = views.slice().sort((a, b) => b.mass - a.mass);
  const drawOrder = Uint32Array.from(particles, (p) => p.index);

  // Grille spatiale : toute paire dans la portée est séparée d'au plus
  // `reach` cases sur chaque axe.
  let cellSize = Math.max(
    range / CELLS_PER_RANGE,
    Math.sqrt((width * height) / MAX_CELLS),
  );
  if (!(cellSize > 0)) cellSize = Infinity;
  const cols = Math.max(1, Math.min(MAX_CELLS, Math.ceil(width / cellSize)));
  const rows = Math.max(1, Math.min(MAX_CELLS, Math.ceil(height / cellSize)));
  const reach = Number.isFinite(cellSize) ? Math.ceil(range / cellSize) : 0;
  const inv = 1 / cellSize;
  const cellOf = new Uint32Array(count);
  const cellStart = new Uint32Array(cols * rows + 1);
  const cellCursor = new Uint32Array(cols * rows);
  // Contenu des cases, trié par case puis par indice croissant ; copies des
  // positions et des types dans ce même ordre (lecture contiguë).
  const cellItems = new Uint32Array(count);
  const cellX = new Float64Array(count);
  const cellY = new Float64Array(count);
  const cellType = new Uint32Array(count);

  // GT[b * T + a] = coefficient appliqué au type a du fait du type b.
  const GT = new Float64Array(T * T);
  for (let a = 0; a < T; a++) {
    for (let b = 0; b < T; b++) GT[b * T + a] = G[a * T + b];
  }

  const cellCoord = (v, size) => {
    const c = Math.floor(v * inv);
    if (!(c >= 0)) return 0; // négatif, NaN
    return c >= size ? size - 1 : c;
  };

  const fillGrid = () => {
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

  const update = () => {
    for (let i = 0; i < count; i++) {
      const r = radius[i];
      // Rebond sur les bords
      if (x[i] + r > width || x[i] - r < 0) {
        vx[i] = -vx[i];
        ax[i] = -ax[i];
      }
      if (y[i] - r < 0 || y[i] + r > height) {
        vy[i] = -vy[i];
        ay[i] = -ay[i];
      }
      vx[i] += ax[i];
      vy[i] += ay[i];
      x[i] += vx[i];
      y[i] += vy[i];
      vx[i] *= friction;
      vy[i] *= friction;
      ax[i] = 0;
      ay[i] = 0;
    }
  };

  const step = () => {
    applyForces();
    update();
  };

  // Copie les positions dans l'ordre d'affichage : [x0, y0, x1, y1, ...].
  const writePositions = (target = new Float32Array(count * 2)) => {
    for (let k = 0; k < count; k++) {
      const i = drawOrder[k];
      target[2 * k] = x[i];
      target[2 * k + 1] = y[i];
    }
    return target;
  };

  return {
    count,
    range,
    state,
    typeIndex,
    drawOrder,
    particles,
    groups,
    step,
    writePositions,
  };
};

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
//
// Le réglage est lu par référence : friction, portée, bords, epsilon, gravité
// et règles sont relus à chaque pas, donc modifiables en cours de simulation.
// Les types, leurs nombres et leurs masses sont pris en compte par sync() (à
// appeler après les avoir modifiés) ; reseed() tire de nouvelles positions.
export const createSimulation = (
  settings,
  { width, height, random = Math.random },
) => {
  let count = 0;
  let state = {};
  for (const field of FIELDS) state[field] = new Float64Array(0);
  let typeIndex = new Uint16Array(0);
  let groups = new Map();
  let particles = [];
  let drawOrder = new Uint32Array(0);
  // Disposition courante : nom, nombre et masse de chaque type, dans l'ordre.
  let layout = [];

  // Grille et coefficients (réalloués quand la taille change).
  let cellOf, cellItems, cellX, cellY, cellType;
  let cellStart = new Uint32Array(0);
  let cellCursor = new Uint32Array(0);
  let T = 0;
  let GT = new Float64Array(0);
  let range = Infinity;
  let range2 = Infinity;
  let cols = 1;
  let rows = 1;
  let reach = 0;
  let inv = 0;
  let epsilon = settings.epsilon;

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
  // et vitesses conservées). Renvoie false si rien n'a changé.
  const sync = () => {
    if (sameLayout()) return false;
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
      for (let k = 0; k < type.count; k++, n++) {
        if (k < kept) {
          for (const field of FIELDS) {
            next[field][n] = old.state[field][previous.start + k];
          }
          if (remass) {
            next.mass[n] = type.mass;
            next.radius[n] = type.mass / 2 + 2;
          }
        } else {
          // Même ordre de tirage que la version précédente (x, y, masse).
          next.x[n] = random() * width;
          next.y[n] = random() * height;
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
    cellType = new Uint32Array(count);
    return true;
  };

  // Nouveau tirage : positions au hasard, vitesses et accélérations à zéro
  // (comme au démarrage) ; nombres, masses et règles inchangés.
  const reseed = () => {
    const { x, y, vx, vy, ax, ay } = state;
    for (let i = 0; i < count; i++) {
      x[i] = random() * width;
      y[i] = random() * height;
      vx[i] = vy[i] = ax[i] = ay[i] = 0;
    }
  };

  // Relit portée, epsilon, règles et dimensions de la grille.
  const prepare = () => {
    const { types, rules = {} } = settings;
    epsilon = settings.epsilon;
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
    // `reach` cases sur chaque axe.
    let cellSize = Math.max(
      range / CELLS_PER_RANGE,
      Math.sqrt((width * height) / MAX_CELLS),
    );
    if (!(cellSize > 0)) cellSize = Infinity;
    cols = Math.max(1, Math.min(MAX_CELLS, Math.ceil(width / cellSize)));
    rows = Math.max(1, Math.min(MAX_CELLS, Math.ceil(height / cellSize)));
    reach = Number.isFinite(cellSize) ? Math.ceil(range / cellSize) : 0;
    inv = 1 / cellSize;
    if (cellStart.length !== cols * rows + 1) {
      cellStart = new Uint32Array(cols * rows + 1);
      cellCursor = new Uint32Array(cols * rows);
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

  const update = () => {
    const { x, y, vx, vy, ax, ay, radius } = state;
    // Friction hors de 0…1 ramenée dans la plage ; non numérique : 1.
    const f = settings.friction;
    const friction = f >= 0 ? (f <= 1 ? f : 1) : f < 0 ? 0 : 1;
    // Gravité : accélération constante vers le bas (négative : vers le haut),
    // en pixels par pas², la même pour toutes les particules.
    const gravity = Number.isFinite(settings.gravity) ? settings.gravity : 0;
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
      vx[i] += ax[i];
      vy[i] += ay[i];
      if (gravity !== 0) vy[i] += gravity;
      x[i] += vx[i];
      y[i] += vy[i];
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

  const step = () => {
    prepare();
    applyForces();
    update();
  };

  // Copie les positions dans l'ordre d'affichage : [x0, y0, x1, y1, ...].
  const writePositions = (target = new Float32Array(count * 2)) => {
    const { x, y } = state;
    for (let k = 0; k < count; k++) {
      const i = drawOrder[k];
      target[2 * k] = x[i];
      target[2 * k + 1] = y[i];
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
    step,
    sync,
    reseed,
    writePositions,
  };
};

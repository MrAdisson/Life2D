// Éléments orbitaux → positions et vitesses initiales pour le moteur (mode
// `interaction: "gravity"`). Module sans accès à la page (testable avec
// `node --test`), sans hasard : mêmes entrées, mêmes sorties.
//
// Système d'unités du moteur :
//   distance : 1 UA = `au` unités du moteur (100 par défaut) ;
//   masse    : masses solaires (Soleil = 1) ;
//   temps    : 1 unité de temps du moteur = 1 jour ("day") ou 1 année julienne
//              de 365,25 jours ("year") ; `dt` s'exprime dans cette unité.
// La constante de gravitation cohérente vient de la constante de Gauss
// k = 0,01720209895 UA^(3/2)·M☉^(-1/2)·jour⁻¹ (k² = G·M☉ en UA³/jour²) :
//   G = k² · T² · au³  (T = durée de l'unité de temps en jours).
// Une vitesse en UA/jour vaut donc v · au · T unités du moteur.

export const GAUSS_K = 0.01720209895;
export const DAYS_PER_YEAR = 365.25;
export const DEFAULT_AU = 100;

const TIME_UNITS = {
  day: { days: 1, label: "jours" },
  year: { days: DAYS_PER_YEAR, label: "années" },
};

// Unités du moteur : { au, time, days, label, G }.
export const unitSystem = ({ au = DEFAULT_AU, time = "day" } = {}) => {
  if (!(Number.isFinite(au) && au > 0)) {
    throw new Error("échelle de distance : nombre d'unités par UA > 0 attendu");
  }
  const unit = TIME_UNITS[time];
  if (!unit) throw new Error("unité de temps : « day » ou « year » attendu");
  const G = GAUSS_K ** 2 * unit.days ** 2 * au ** 3;
  return { au, time, days: unit.days, label: unit.label, G };
};

const RAD = Math.PI / 180;

// État au périhélie, relatif au corps central, en unités du moteur.
// elements : { a (UA), e, i (degrés), node Ω (degrés, 0 par défaut),
// periapsis ω (argument du périhélie, degrés, 0 par défaut) } ;
// mu = G·(M + m) en unités du moteur (problème à deux corps).
// Vis-viva au périhélie : r = a(1 − e), v = sqrt(mu·(1 + e) / r), la vitesse
// étant perpendiculaire au rayon. Le plan x,y est le plan de référence
// (écliptique), z pointe vers son pôle nord ; l'orbite est tournée par
// Rz(Ω)·Rx(i)·Rz(ω).
export const perihelionState = (elements, mu, units) => {
  const { a, e, i = 0, node = 0, periapsis = 0 } = elements;
  if (!(a > 0)) throw new Error("demi-grand axe > 0 attendu");
  if (!(e >= 0 && e < 1)) throw new Error("excentricité de 0 à moins de 1 attendue");
  const r = a * units.au * (1 - e);
  const v = Math.sqrt((mu * (1 + e)) / r);
  const cO = Math.cos(node * RAD);
  const sO = Math.sin(node * RAD);
  const cw = Math.cos(periapsis * RAD);
  const sw = Math.sin(periapsis * RAD);
  const ci = Math.cos(i * RAD);
  const si = Math.sin(i * RAD);
  return {
    position: [r * (cO * cw - sO * sw * ci), r * (sO * cw + cO * sw * ci), r * sw * si],
    velocity: [v * (-cO * sw - sO * cw * ci), v * (-sO * sw + cO * cw * ci), v * cw * si],
  };
};

// Période képlérienne (3ᵉ loi de Kepler) en unités de temps du moteur.
export const keplerPeriod = (a, mu, units) =>
  2 * Math.PI * Math.sqrt((a * units.au) ** 3 / mu);

// États de tout un système : un corps central (sans `elements`, le premier
// de la liste) et des corps en orbite autour de lui, chacun à son périhélie.
// Les états sont ramenés au barycentre (centre de masse immobile à `center`,
// quantité de mouvement totale nulle). Renvoie [{ body, mass, position,
// velocity }] dans l'ordre de `bodies`.
export const systemStates = (bodies, { units, center = [0, 0, 0] }) => {
  const central = bodies[0];
  if (!central || central.elements) {
    throw new Error("le premier corps doit être le corps central (sans éléments orbitaux)");
  }
  const states = bodies.map((body, k) => {
    if (k === 0) return { body, mass: body.mass, position: [0, 0, 0], velocity: [0, 0, 0] };
    if (!body.elements) throw new Error(`${body.name} : éléments orbitaux attendus`);
    const mu = units.G * (central.mass + body.mass);
    return { body, mass: body.mass, ...perihelionState(body.elements, mu, units) };
  });
  let total = 0;
  const com = [0, 0, 0];
  const vcom = [0, 0, 0];
  for (const s of states) {
    total += s.mass;
    for (let d = 0; d < 3; d++) {
      com[d] += s.mass * s.position[d];
      vcom[d] += s.mass * s.velocity[d];
    }
  }
  for (const s of states) {
    for (let d = 0; d < 3; d++) {
      s.position[d] += center[d] - com[d] / total;
      s.velocity[d] -= vcom[d] / total;
    }
  }
  return states;
};

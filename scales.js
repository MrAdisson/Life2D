// Échelles des curseurs du panneau (fonctions pures, testées par
// scales.test.js). Un curseur va de 0 à SLIDER_STEPS (entiers) ; la valeur
// appliquée est toujours arrondie pour être exactement celle affichée.

export const SLIDER_STEPS = 1000;

// Décades couvertes de chaque côté de la friction : près de 0 et près de 1,
// le curseur règle l'écart jusqu'à 0,5 × 10⁻⁴ (0,99995, 0,00005).
const FRICTION_DECADES = 4;

// Arrondi à `digits` chiffres significatifs.
const significant = (v, digits) => Number(v.toPrecision(digits));

// Arrondi à 9 décimales : supprime le bruit d'arrondi (« 0,30000000000000004 »)
// en gardant toutes les valeurs que produisent les curseurs.
export const tidy = (v) => Number(v.toFixed(9));

// Friction depuis la position du curseur : symétrique, logarithmique vers les
// deux bouts (0 et 1 exactement aux extrémités, 0,5 au milieu).
export const frictionFromSlider = (position) => {
  const t = Math.min(1, Math.max(0, position / SLIDER_STEPS));
  if (t === 0) return 0;
  if (t === 1) return 1;
  const s = 2 * Math.min(t, 1 - t); // 0 au bord, 1 au milieu
  const gap = significant(0.5 * 10 ** (-FRICTION_DECADES * (1 - s)), 3);
  return tidy(t < 0.5 ? gap : 1 - gap);
};

// Position du curseur pour une friction (inverse approché de la précédente).
export const sliderFromFriction = (friction) => {
  const f = Math.min(1, Math.max(0, Number(friction) || 0));
  const gap = Math.min(f, 1 - f);
  if (gap <= 0) return f < 0.5 ? 0 : SLIDER_STEPS;
  const s = Math.min(1, Math.max(0, 1 + Math.log10(gap / 0.5) / FRICTION_DECADES));
  const t = f < 0.5 ? s / 2 : 1 - s / 2;
  return Math.round(t * SLIDER_STEPS);
};

// Portée : échelle logarithmique de RANGE_MIN à RANGE_MAX pixels (plus fine
// pour les petites portées, où l'effet de quelques pixels est le plus fort).
export const RANGE_MIN = 5;
export const RANGE_MAX = 2000;

export const rangeFromSlider = (position) => {
  const t = Math.min(1, Math.max(0, position / SLIDER_STEPS));
  return significant(RANGE_MIN * (RANGE_MAX / RANGE_MIN) ** t, 2);
};

// Portée illimitée : curseur en butée à droite.
export const sliderFromRange = (range) => {
  if (!Number.isFinite(range)) return SLIDER_STEPS;
  const r = Math.min(RANGE_MAX, Math.max(RANGE_MIN, range));
  return Math.round(
    (Math.log(r / RANGE_MIN) / Math.log(RANGE_MAX / RANGE_MIN)) * SLIDER_STEPS,
  );
};

// Vitesse de simulation : échelle logarithmique de SPEED_MIN à SPEED_MAX (×),
// quatre décades ; 1× à un quart de la course.
export const SPEED_MIN = 0.1;
export const SPEED_MAX = 1000;

export const speedFromSlider = (position) => {
  const t = Math.min(1, Math.max(0, position / SLIDER_STEPS));
  if (t === 0) return SPEED_MIN;
  if (t === 1) return SPEED_MAX;
  return significant(SPEED_MIN * (SPEED_MAX / SPEED_MIN) ** t, 2);
};

export const sliderFromSpeed = (speed) => {
  const v = Math.min(SPEED_MAX, Math.max(SPEED_MIN, Number(speed) || 1));
  return Math.round(
    (Math.log(v / SPEED_MIN) / Math.log(SPEED_MAX / SPEED_MIN)) * SLIDER_STEPS,
  );
};

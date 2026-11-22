// Compteur d'images par seconde, de pas de simulation par seconde et de
// particules. Logique pure (sans navigateur), testée par stats.test.js.

export const countParticles = (settings) =>
  settings.types.reduce((n, t) => n + t.count, 0);

// frame(now, steps) à chaque image affichée (now en ms, steps : nombre total
// de pas calculés). Renvoie { fps, stepsPerSecond } une fois par intervalle,
// null sinon.
export const createStatsMeter = ({ interval = 500 } = {}) => {
  let start = null;
  let startSteps = 0;
  let frames = 0;
  return {
    frame(now, steps = 0) {
      if (start === null) {
        start = now;
        startSteps = steps;
        return null;
      }
      frames++;
      const elapsed = now - start;
      if (elapsed < interval) return null;
      const result = {
        fps: (frames * 1000) / elapsed,
        stepsPerSecond: ((steps - startSteps) * 1000) / elapsed,
      };
      start = now;
      startSteps = steps;
      frames = 0;
      return result;
    },
  };
};

const format = (n) => Math.round(n).toLocaleString("fr-FR");

// Temps simulé (unités de temps du moteur) : au plus deux décimales.
// `unit` : unité facultative donnée par le préréglage (« jours »...).
export const formatTime = (t, unit) => {
  const text = (Number.isFinite(t) ? t : 0).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  });
  return unit ? `${text} ${unit}` : text;
};

export const formatStats = ({ fps, stepsPerSecond, particles }) =>
  `${format(fps)} images/s · ${format(particles)} particules · ` +
  `${format(stepsPerSecond)} pas/s`;

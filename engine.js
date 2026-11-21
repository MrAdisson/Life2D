// Moteur de simulation : aucune dépendance au navigateur (ni canevas, ni DOM, ni window).
// Réglage : voir settings.js.

export class ParticleElement {
  constructor({ x, y, color, mass = 1, type }) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type;
    this.vx = 0; // velocity
    this.vy = 0;
    this.ax = 0; // acceleration
    this.ay = 0;
    this.mass = mass;
    this.radius = mass / 2 + 2;
  }

  update({ width, height, friction }) {
    // Rebond sur les bords
    if (this.x + this.radius > width || this.x - this.radius < 0) {
      this.vx = -this.vx;
      this.ax = -this.ax;
    }
    if (this.y - this.radius < 0 || this.y + this.radius > height) {
      this.vy = -this.vy;
      this.ay = -this.ay;
    }
    this.vx += this.ax;
    this.vy += this.ay;
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= friction;
    this.vy *= friction;
    this.ax = 0;
    this.ay = 0;
  }
}

// settings : réglage ; width/height : dimensions de l'espace ;
// random : générateur [0,1[ (Math.random par défaut, injectable pour les tests).
export const createSimulation = (
  settings,
  { width, height, random = Math.random },
) => {
  const { epsilon, friction, types, rules = {} } = settings;
  const groups = new Map();
  const particles = [];

  for (const type of types) {
    const group = [];
    for (let i = 0; i < type.count; i++) {
      const x = random() * width;
      const y = random() * height;
      group.push(
        new ParticleElement({
          x,
          y,
          color: type.color,
          mass: type.mass || random() * 50,
          type: type.name,
        }),
      );
    }
    groups.set(type.name, group);
    particles.push(...group);
  }

  const applyRule = (group, otherGroup, g) => {
    for (const particle of group) {
      for (const other of otherGroup) {
        if (particle === other) continue;
        const dx = particle.x - other.x;
        const dy = particle.y - other.y;
        const distance = Math.sqrt(dx * dx + dy * dy) + epsilon;
        const force = (g * particle.mass * other.mass) / distance ** 2;
        particle.ax += (force * dx) / distance / particle.mass;
        particle.ay += (force * dy) / distance / particle.mass;
      }
    }
  };

  const step = () => {
    for (const type of types) {
      for (const other of types) {
        const g = rules[type.name]?.[other.name] ?? 0;
        if (g === 0) continue;
        applyRule(groups.get(type.name), groups.get(other.name), g);
      }
    }
    // Tri par masse décroissante (ordre de mise à jour et d'affichage)
    particles.sort((a, b) => b.mass - a.mass);
    for (const particle of particles) {
      particle.update({ width, height, friction });
    }
  };

  return { particles, groups, step };
};

import "./style.css";

// APPEND 500 x 500 CANVAS TO BODY

const canvas = document.createElement("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvas.style.border = "1px solid white";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d");

const EPSILON = 10;

const FRICTION = 1;

class ParticleElement {
  constructor({ x, y, color, mass = 1 }) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = 0; //VELOCITY X
    this.vy = 0; //VELOCITY Y
    this.ax = 0; //ACCELERATION X
    this.ay = 0; //ACCELERATION Y
    this.mass = mass;
    this.radius = mass / 2 + 2;
  }
  update() {
    if (this.x + this.radius > canvas.width || this.x - this.radius < 0) {
      this.vx = -this.vx;
      this.ax = -this.ax;
    }
    if (this.y - this.radius < 0 || this.y + this.radius > canvas.height) {
      this.vy = -this.vy;
      this.ay = -this.ay;
    }
    // UPDATE VELOCITY WITH ACCELERATION
    this.vx += this.ax;
    this.vy += this.ay;
    // UPDATE POSITION WITH VELOCITY
    this.x += this.vx;
    this.y += this.vy;
    // BOUNCE ON CANVAS BORDERS:

    // FRICTION
    this.vx *= FRICTION;
    this.vy *= FRICTION;
    // RESET ACCELERATION
    this.ax = 0;
    this.ay = 0;
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
    ctx.fill();
  }
}

const particles = [];

const create = (number, color, mass) => {
  const group = [];
  for (let i = 0; i < number; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const particle = new ParticleElement({
      x,
      y,
      color,
      mass: mass || Math.random() * 50,
    });
    group.push(particle);
    particles.push(particle);
  }
  return group;
};

const group1 = create(60, "red", 4);
const group2 = create(1500, "blue", 2);
const group3 = create(5, "green", 100);
const group4 = create(20, "white", 15);

// LOOP

const rules = (particleGroup, otherParticleGroup, g) => {
  // LOOP THROUGH FIRST GROUP
  particleGroup.forEach((particle) => {
    // LOOP THROUGH SECOND GROUP
    otherParticleGroup.forEach((otherParticle) => {
      if (particle === otherParticle) return;
      // CALCULATE DISTANCE BETWEEN PARTICLES
      const dx = particle.x - otherParticle.x; // HORIZONTAL DISTANCE
      const dy = particle.y - otherParticle.y; // VERTICAL DISTANCE
      const distance = Math.sqrt(dx * dx + dy * dy) + EPSILON;

      // CALCULATE FORCE
      const force = (g * particle.mass * otherParticle.mass) / distance ** 2;

      // CALCULATE ACCELERATION: F = MA
      const ax = (force * dx) / distance / particle.mass;
      const ay = (force * dy) / distance / particle.mass;

      // UPDATE PARTICLE ACCELERATION
      particle.ax += ax;
      particle.ay += ay;
    });
  });
};

const loop = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // DEFINE RULES
  // GROUP 1 - ELECTRON
  rules(group1, group1, 1);
  rules(group1, group2, 1);
  rules(group1, group3, -1);
  rules(group1, group4, -3);

  // GROUP 2 - WATER
  rules(group2, group1, 2);
  rules(group2, group2, 2);
  rules(group2, group3, 2);
  rules(group2, group4, 2);

  // GROUP 3 - NUCLEUS
  rules(group3, group1, 1);
  rules(group3, group2, 1);
  rules(group3, group3, -1);
  rules(group3, group4, 1);

  // GROUP 4 - PROTON
  rules(group4, group1, -5);
  rules(group4, group2, 1);
  rules(group4, group3, -1);
  rules(group4, group4, 1);

  particles
    .sort((a, b) => b.mass - a.mass)
    .forEach((particle) => {
      particle.update();
      particle.draw(ctx);
    });
  requestAnimationFrame(loop);
};

loop();

import "./style.css";

// APPEND 500 x 500 CANVAS TO BODY

const canvas = document.createElement("canvas");
canvas.width = window.innerHeight;
canvas.height = window.innerHeight;
canvas.style.border = "1px solid white";

const DEFAULT_MAX_DISTANCE = 1000;
const FRICTION = 0.2;
const EPSILON = 5;

document.body.appendChild(canvas);

const ctx = canvas.getContext("2d");

const particles = [];
class Particle {
  // same with object destructuring
  constructor({ x, y, color, vx, vy }) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.vx = vx;
    this.vy = vy;
    this.mass = 1;
    this.ax = 0;
    this.ay = 0;
  }
  update() {
    // FRICITION
    this.vx = this.ax;
    this.vy = this.ay;

    this.x += this.vx;
    this.y += this.vy;
    if (this.x > canvas.width || this.x < 0) {
      this.vx = -this.vx;
      this.ax = -this.ax;
    }
    if (this.y < 0 || this.y > canvas.height) {
      this.vy = -this.vy;
      this.ay = -this.ay;
    }
    this.vx *= FRICTION;
    this.vy *= FRICTION;
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 10, 0, 2 * Math.PI);
    ctx.fill();
  }
}
// GENERATE 500 RANDOM PARTICLES

const create = (number, color) => {
  const group = [];
  for (let i = 0; i < number; i++) {
    group.push(
      new Particle({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        color: color,
        vx: 0,
        vy: 0,
        ax: 0,
        ay: 0,
      })
    );
  }
  particles.push(...group);
  return group;
};

const yellowParticles = create(30, "yellow");
const blueParticles = create(1000, "blue");
const purpleParticles = create(20, "purple");

const rule = (
  particles1,
  particles2,
  g
  // maxDistance = DEFAULT_MAX_DISTANCE
) => {
  particles1.forEach((particle1) => {
    let fx = 0;
    let fy = 0;

    particles2.forEach((particle2) => {
      if (particle1 !== particle2) {
        // APPLY MAGNETIC FORCE:
        const dx = particle1.x - particle2.x;
        const dy = particle1.y - particle2.y;
        const distance = Math.sqrt(dx * dx + dy * dy) + EPSILON;
        const force = (g * particle1.mass * particle2.mass) / distance ** 2;
        fx += force * (dx / distance);
        fy += force * (dy / distance);
      }
    });
    particle1.ax += (fx * 1) / 1; // WHEN MASS IS INTEGRATED
    particle1.ay += (fy * 1) / 1; // WHEN MASS IS INTEGRATED
  });
};

const update = () => {
  rule(yellowParticles, yellowParticles, -10);
  rule(yellowParticles, blueParticles, 50);
  // rule(yellowParticles, purpleParticles, -1);
  rule(blueParticles, yellowParticles, 50);
  rule(blueParticles, blueParticles, 5);
  // rule(blueParticles, purpleParticles, -0.5);
  // rule(purpleParticles, yellowParticles, 1);
  // rule(purpleParticles, blueParticles, 1);
  // rule(purpleParticles, purpleParticles, 1);

  particles.forEach((particle) => {
    particle.update();
  });
};

const loop = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  update();
  particles.forEach((particle) => {
    particle.draw(ctx);
  });
  requestAnimationFrame(loop);
};

loop();

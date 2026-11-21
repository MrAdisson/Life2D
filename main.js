import "./style.css";
import { createSimulation } from "./engine.js";
import { defaultSettings } from "./settings.js";

const canvas = document.createElement("canvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvas.style.border = "1px solid white";
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d");

const simulation = createSimulation(defaultSettings, {
  width: canvas.width,
  height: canvas.height,
});

const loop = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  simulation.step();
  for (const particle of simulation.particles) {
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, 2 * Math.PI);
    ctx.fill();
  }
  requestAnimationFrame(loop);
};

loop();

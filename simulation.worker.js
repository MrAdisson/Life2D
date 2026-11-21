// Web Worker de la simulation : tout le calcul tourne ici, hors du thread
// principal (voir simulation-host.js pour le protocole).
import { attachSimulation } from "./simulation-host.js";

attachSimulation(self);

// Côté Worker : fait tourner le moteur et renvoie les positions au thread
// principal. Séparé de simulation.worker.js pour être testable sans navigateur.
//
// Protocole (messages) :
//   page -> worker  { type: "init", settings, width, height }
//   worker -> page  { type: "init", count, palette, types, radii }
//                   palette : couleur CSS de chaque type du réglage ;
//                   types, radii : type et rayon de chaque particule, dans
//                   l'ordre d'affichage (les plus massives d'abord).
//   page -> worker  { type: "step", positions }   (Float32Array à remplir, transféré)
//   worker -> page  { type: "positions", positions, steps }   (transféré)
//
// Le premier message "positions" (état initial) suit "init" sans pas de calcul ;
// ensuite, chaque demande "step" fait avancer la simulation d'un pas.
import { createSimulation } from "./engine.js";

export const attachSimulation = (port, { random } = {}) => {
  let simulation = null;
  let steps = 0;

  const send = (positions) => {
    simulation.writePositions(positions);
    port.postMessage({ type: "positions", positions, steps }, [
      positions.buffer,
    ]);
  };

  port.onmessage = ({ data }) => {
    if (data.type === "init") {
      const { settings, width, height } = data;
      simulation = createSimulation(settings, { width, height, random });
      steps = 0;
      const { count, drawOrder, typeIndex, state } = simulation;
      const palette = settings.types.map((t) => t.color);
      const types = Uint16Array.from(drawOrder, (i) => typeIndex[i]);
      const radii = Float32Array.from(drawOrder, (i) => state.radius[i]);
      port.postMessage({ type: "init", count, palette, types, radii }, [
        types.buffer,
        radii.buffer,
      ]);
      send(new Float32Array(count * 2));
    } else if (data.type === "step" && simulation) {
      simulation.step();
      steps++;
      send(data.positions);
    }
  };
};

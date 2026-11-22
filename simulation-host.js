// Côté Worker : fait tourner le moteur et renvoie les positions au thread
// principal. Séparé de simulation.worker.js pour être testable sans navigateur.
//
// Protocole (messages) :
//   page -> worker  { type: "init", settings, width, height }
//   worker -> page  { type: "init", generation, count, dimensions, palette,
//                     types, radii }
//                   dimensions : 2 ou 3 (réglage `dimensions`) ;
//                   palette : couleur CSS de chaque type du réglage ;
//                   types, radii : type et rayon de chaque particule, dans
//                   l'ordre d'affichage (les plus massives d'abord).
//   page -> worker  { type: "step", positions, generation }
//                   (Float32Array à remplir, transféré : POSITION_STRIDE = 3
//                   flottants par particule, [x0, y0, z0, x1, ...] dans
//                   l'ordre d'affichage ; z = 0 en 2D)
//   worker -> page  { type: "positions", positions, steps, generation }
//                   (transféré)
//   page -> worker  { type: "settings", settings }   réglage modifié : pris en
//                   compte au pas suivant, sans toucher aux positions ; si les
//                   types ou leurs nombres changent, le worker renvoie "init"
//                   puis "positions" (nouvelle génération) ; si `dimensions`
//                   change, la simulation repart d'un nouveau tirage (même
//                   réponse)
//   page -> worker  { type: "reseed" }   nouveau tirage des positions (même
//                   réponse que ci-dessus)
//
// `generation` change à chaque "init" : le worker ignore un "step" d'une
// génération passée (tampon de l'ancienne taille encore en route) et la page
// ignore de même les "positions" d'une génération passée.
//
// Le premier message "positions" (état initial) suit "init" sans pas de calcul ;
// ensuite, chaque demande "step" fait avancer la simulation d'un pas.
import { createSimulation, dimensionsOf } from "./engine.js";

// Flottants par particule dans le tampon de positions (x, y, z).
export const POSITION_STRIDE = 3;

export const attachSimulation = (port, { random } = {}) => {
  let simulation = null;
  let settings = null;
  let steps = 0;
  let generation = 0;
  let size = null;

  const create = () => {
    simulation = createSimulation(settings, { ...size, random });
    steps = 0;
  };

  const send = (positions) => {
    simulation.writePositions(positions, POSITION_STRIDE);
    port.postMessage({ type: "positions", positions, steps, generation }, [
      positions.buffer,
    ]);
  };

  // Décrit les particules (couleurs, types, rayons) puis envoie l'état.
  const sendInit = () => {
    generation++;
    const { count, drawOrder, typeIndex, state } = simulation;
    const palette = settings.types.map((t) => t.color);
    const types = Uint16Array.from(drawOrder, (i) => typeIndex[i]);
    const radii = Float32Array.from(drawOrder, (i) => state.radius[i]);
    port.postMessage(
      {
        type: "init",
        generation,
        count,
        dimensions: simulation.dimensions,
        depth: simulation.depth,
        palette,
        types,
        radii,
      },
      [types.buffer, radii.buffer],
    );
    send(new Float32Array(count * POSITION_STRIDE));
  };

  port.onmessage = ({ data }) => {
    if (data.type === "init") {
      settings = data.settings;
      size = { width: data.width, height: data.height };
      create();
      sendInit();
    } else if (!simulation) {
      return;
    } else if (data.type === "step") {
      if ((data.generation ?? generation) !== generation) return;
      simulation.step();
      steps++;
      send(data.positions);
    } else if (data.type === "settings") {
      // Le moteur lit `settings` par référence : on le met à jour sur place.
      Object.assign(settings, data.settings);
      if (dimensionsOf(settings) !== simulation.dimensions) {
        create();
        sendInit();
      } else if (simulation.sync()) sendInit();
    } else if (data.type === "reseed") {
      simulation.reseed();
      sendInit();
    }
  };
};

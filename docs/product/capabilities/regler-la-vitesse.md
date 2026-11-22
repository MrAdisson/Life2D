---
id: CAP-REGLER-LA-VITESSE-DE-LA-SIMULATION-EN-DI
title: Régler la vitesse de la simulation en direct
parent: CAP-SIMULATION
deprecated: false
---

La section « Physique » du panneau propose un réglage « Vitesse de simulation (×) » : le multiplicateur du temps simulé par image affichée (donc par seconde réelle, à cadence d'affichage égale). 1× est la vitesse normale, 2× fait avancer le temps simulé deux fois plus vite, 0,5× deux fois plus lentement.

Règles :
- Curseur à échelle logarithmique de 0,1× à 1000× (1× au quart de la course), accompagné d'un champ pour la valeur exacte ; le champ accepte tout nombre > 0 (virgule décimale acceptée), même hors de la plage du curseur. Une valeur refusée (vide, nulle, négative, non numérique) affiche un message en français et l'ancienne valeur est conservée.
- Le changement s'applique à l'image suivante, sans réinitialiser les particules ni le temps simulé ; en pause, il s'applique au prochain pas ou à la reprise.
- Traduction : le temps simulé par image vaut vitesse × `substeps` × `dt` (voir CAP-INTEGRER-LE-MOUVEMENT-AVEC-UN-PAS-DE-TEM). Priorité aux sous-pas, donc à la précision : le nombre de pas par image passe à ⌈vitesse × `substeps`⌉ et leur durée est ajustée pour que le total soit exact (au plus `dt` quand la vitesse est ≥ 1). Aux vitesses lentes, le pas raccourcit.
- `dt` et `substeps` restent réglables dans la section « Physique », libellés « avancé, vitesse 1 » : ils donnent la base à vitesse 1.
- Plafond : au plus 100 pas par image. Au-delà, la simulation calcule 100 pas de `dt` par image, la vitesse obtenue est inférieure à celle demandée, et un avertissement indique la vitesse obtenue et celle demandée.
- Le préréglage peut donner `speed` (nombre > 0) et `timeUnit` (texte, unité du temps simulé affiché dans « Lecture », ex. « jours ») ; un fichier invalide devient une carte d'erreur. Sans `speed`, la vitesse est 1 et le comportement est celui d'avant.

Limites : la vitesse est un multiplicateur par image, pas par seconde mesurée : si l'ordinateur affiche moins d'images par seconde, le temps simulé par seconde réelle baisse d'autant, sans avertissement (l'avertissement ne concerne que le plafond de 100 pas). Le réglage n'est pas sauvegardé entre deux sessions. Aucun préréglage de la galerie ne donne encore de vitesse ni d'unité.

Code : `engine.js`, `panel.js`, `settings-edit.js`, `scales.js`, `presets.js`, `stats.js`

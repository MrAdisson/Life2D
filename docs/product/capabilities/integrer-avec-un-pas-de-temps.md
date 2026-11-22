---
id: CAP-INTEGRER-LE-MOUVEMENT-AVEC-UN-PAS-DE-TEM
title: Intégrer le mouvement avec un pas de temps réglable
parent: CAP-SIMULATION
deprecated: false
---

La simulation avance par pas de temps : chaque pas de calcul fait avancer le temps simulé d'une durée `dt`, et chaque image affichée calcule un nombre réglable de pas (les sous-pas). On peut ainsi accélérer le temps sans perdre en précision, ou le ralentir pour un mouvement plus fin. Le temps simulé écoulé est affiché dans le panneau.

Règles :
- `dt` (« Pas de temps », nombre > 0, 1 par défaut) : durée simulée d'un pas de calcul. Avec la valeur par défaut, la simulation est exactement celle d'avant ce réglage (mêmes positions au bit près dans le mode des règles).
- `substeps` (« Sous-pas par image », entier de 1 à 100, 1 par défaut) : nombre de pas de `dt` calculés avant chaque image. Le temps simulé avance donc de `substeps × dt` par image.
- Les deux se règlent dans le préréglage et en direct dans la section « Physique » du panneau : la nouvelle valeur s'applique dès le pas (ou l'image) suivant, sans réinitialiser les particules. Une valeur refusée (pas de temps vide, nul ou négatif ; sous-pas non entier, hors de 1 à 100) affiche un message en français et l'ancienne valeur est conservée.
- Mode gravitation universelle : le mouvement est calculé par un intégrateur symplectique (vitesse-Verlet), qui garde l'énergie d'une orbite au lieu de la faire dériver : les orbites ne s'étirent pas et ne spiralent pas au fil des tours. Vérifié par un test : une orbite circulaire garde son énergie totale à moins de 1 % près sur 10 000 pas (écart mesuré de l'ordre de 10⁻⁷ % avec un pas de 1, environ 560 pas par tour, et 10⁻⁴ % avec un pas de 5). Pour une même durée simulée, des sous-pas plus nombreux et plus courts donnent une trajectoire plus précise.
- Mode des règles : le calcul reste celui d'avant (la vitesse puis la position), avec le pas de temps en facteur : un pas plus petit déplace les particules proportionnellement moins.
- La friction est un facteur par unité de temps (avec un pas de 0,5, elle est appliquée à moitié à chaque pas : deux pas freinent comme un pas de 1), et la gravité verticale une accélération par unité de temps².
- Le panneau (section « Lecture ») affiche le temps simulé à côté du numéro de pas ; en pause, « Pas à pas » avance d'une image, soit `substeps` pas de `dt`. Le nouveau tirage remet le temps simulé à 0 ; le compteur de pas compte les images calculées.
- Validation à l'ouverture de la galerie : `dt`, s'il est donné, doit être un nombre > 0 ; `substeps`, s'il est donné, un entier de 1 à 100. Sinon le fichier devient une carte d'erreur.

Limites : le temps simulé n'a pas d'unité physique (une unité = un pas avec le réglage par défaut). Le temps de calcul d'une image est proportionnel au nombre de sous-pas : budget vérifié par un test pour 10 sous-pas à 200 corps en mode gravité (moins de 50 ms par image) ; aucun avertissement n'est affiché si le calcul ne suit plus. Dans le mode des règles, un grand pas de temps rend les rencontres proches plus violentes (aucune correction de précision). Le pas de temps est le même pour tous les corps (pas de pas adaptatif près d'un corps lourd). Aucun préréglage de la galerie ne fixe encore `dt` ou `substeps`. Le compteur « pas/s » en haut de l'écran compte les images calculées par seconde, pas les sous-pas.

Code : `engine.js`, `simulation-host.js`, `panel.js`, `settings-edit.js`, `presets.js`, `stats.js`

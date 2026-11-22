---
id: CAP-SUIVRE-LES-TRAJECTOIRES-ET-NOMMER-LES-CO
title: Suivre les trajectoires et nommer les corps
parent: CAP-AFFICHAGE
deprecated: false
---

En vue 3D, le panneau a une section « Rendu des astres » qui règle l'apparence des corps sans toucher à la physique : taille d'affichage, traînées d'orbite, étiquettes et suivi d'un corps par la caméra.

Règles :
- Taille des corps : un facteur global (curseur de 0,1× à 10×, champ exact de 0,05 à 100) multiplie le rayon d'affichage de tous les corps, en direct. Le rayon de chaque corps vient de son `radius` (indépendant de sa masse) ; sans `radius`, il découle de la masse comme avant. Le facteur ne change ni les collisions ni les forces.
- Traînées : case à cocher (désactivée par défaut) et longueur réglable de 2 à 500 positions. Chaque corps laisse ses dernières positions, un trait de sa couleur de plus en plus pâle vers le passé. Les traînées sont indisponibles (case grisée, message) au-delà de 50 particules.
- Étiquettes : case à cocher. Le nom (`name`) des corps explicites s'affiche au-dessus de chacun, en texte de taille fixe avec contour sombre. Les particules sans nom n'ont pas d'étiquette.
- Réglage par corps : un corps explicite peut avoir `sizeFactor` (nombre > 0) qui multiplie son rayon d'affichage en plus du facteur global, et `label: false` qui masque son étiquette (il reste dans la liste de suivi et cliquable). Ils s'écrivent dans le préréglage ; le panneau ne les modifie pas.
- Astre émissif : un type ou un corps peut porter `emissive: true` ; il est dessiné en couleur vive, sans ombrage. S'il y en a un, c'est lui qui éclaire les autres corps (le côté tourné vers lui est clair) ; sinon la lumière reste fixe en haut à gauche. Un `emissive` sur le corps prime sur celui du type.
- Suivre un corps : une liste « Suivre un corps » (corps nommés) ou un clic sans glisser sur un corps nommé recentre la caméra sur lui ; elle tourne alors autour de lui et il reste au centre quand il bouge. Double-clic ou touche « 0 » : retour à la vue de face de la boîte. Le zoom et le déplacement latéral restent utilisables.
- Les réglages de la section sont aussi lisibles dans un préréglage, sous `settings.display` : `sizeFactor`, `trails`, `trailLength`, `labels`. Un fichier qui les écrit mal devient une carte d'erreur.
- Le préréglage « Système solaire (3D) » de la galerie les utilise : Soleil émissif, quatre planètes, noms et traînées.
- En 2D, rien ne change : la section est masquée, aucun réglage n'a d'effet et le dessin est celui d'avant.

Limites : les traînées et la taille ne valent qu'en 3D ; le facteur de taille agit sur l'affichage seulement (deux corps peuvent se recouvrir visuellement sans se toucher). Un seul astre émissif éclaire (le premier dans l'ordre d'affichage, c'est-à-dire le plus massif) ; pas d'ombres portées ni d'affaiblissement avec la distance. Le suivi ne se fait que sur les corps nommés. Les réglages d'affichage ne sont pas sauvegardés.

Code : `display.js`, `renderer.js`, `camera.js`, `main.js`, `panel.js`, `simulation-host.js`, `presets.js`, `style.css`

---
id: CAP-LANCER-ET-CONSTRUIRE
title: Lancer en développement et construire le site statique
parent: CAP-APPLICATION-WEB
---

`npm run dev` sert la page avec rechargement à chaud, `npm run build` produit un site statique dans `dist/`, `npm run preview` le sert. `npm test` lance les tests automatisés du moteur de simulation (`node --test`, sans navigateur).

Limites : pas de lint ni de vérification de types ; les tests ne couvrent que le moteur (pas l'affichage) ; `mainbis.js` (variante expérimentale à 3 familles), `counter.js` (reste du modèle Vite) et `gui.js` (vide) ne sont pas chargés par la page et ne sont donc pas des capacités.

Code : `package.json`, `index.html`, `engine.test.js`

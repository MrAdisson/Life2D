---
id: CAP-LANCER-ET-CONSTRUIRE
title: Lancer en développement et construire le site statique
parent: CAP-APPLICATION-WEB
---

`npm run dev` sert la page avec rechargement à chaud, `npm run build` produit un site statique dans `dist/`, `npm run preview` le sert. `npm test` lance les tests automatisés (`node --test`, sans navigateur) : moteur, effet de chaque réglage au pas suivant, modifications du réglage, échelles des curseurs, protocole du Worker, préréglages (validité, titres uniques, budget par préréglage, phénomène décrit par les préréglages récents), compteur, et un test de performance qui échoue si un pas à 10 000 particules (portée finie) dépasse 50 ms.

Limites : pas de lint ni de vérification de types ; les tests ne couvrent pas l'affichage (panneau, rendu WebGL) ; le test de performance dépend de la machine qui l'exécute ; `mainbis.js` (variante expérimentale à 3 familles), `counter.js` (reste du modèle Vite) et `gui.js` (vide) ne sont pas chargés par la page et ne sont donc pas des capacités.

Code : `package.json`, `index.html`, `engine.test.js`

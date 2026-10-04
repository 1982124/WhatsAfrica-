# WASSAFRICA — Audit interactions / boutons
Date: 2026-10-04
Périmètre: interface publique principale et surfaces récemment modifiées.

## Règle bloquante
Aucun bouton ou CTA ne doit être décoratif, mort ou statique. Chaque contrôle doit produire l'action annoncée et avoir un état de succès/erreur adapté.

## Constats confirmés

### 1. Vitrine publique principale — `wassafrica-official.html`
- Les CTA visibles sont majoritairement de vrais liens: `/smartlink`, `/vitrine`, `/partenaires`, `/inbox?... `, `/network`, `/market`, et des pages produit.
- Les liens WhatsApp utilisent des destinations externes réelles et `target="_blank"` avec `rel="noopener"`.
- Aucun `href="#"` ni `javascript:void(0)` n'a été trouvé dans la recherche statique du dépôt.
- Risque restant: la validité fonctionnelle de chaque destination n'est pas démontrée par le code source seul. Une route peut exister dans `vercel.json` tout en pointant vers une page absente ou partiellement fonctionnelle.

### 2. Raccordement des routes
- `vercel.json` contient de nombreuses rewrites pour les CTA publics: `/smartlink`, `/vitrine`, `/market`, `/network`, `/partenaires`, `/presentation`, `/manifesto`, `/inbox`, `/product/:id`, etc.
- La présence d'une rewrite n'est pas une preuve que l'expérience cible est opérationnelle après navigation.

### 3. Vitrine / éditeur
- Le code inspecté contient de vrais handlers pour enregistrer l'identité, ouvrir/fermer le formulaire produit, publier un produit et partager la vitrine.
- Le bouton Partager possède un comportement de repli: Web Share API, copie du lien, puis prompt.
- Le bouton de création désactive temporairement le contrôle pendant la requête, ce qui est correct.
- Risque: les états d'erreur dépendent de `status(...)`; il faut vérifier visuellement que les messages sont effectivement visibles et accessibles après échec.

## Défauts / risques à traiter avant certification

### P0 — Certification d'interaction incomplète
L'audit statique ne peut pas certifier qu'un clic atteint toujours une destination fonctionnelle. Il faut une passe runtime de tous les CTA publics et des contrôles principaux.

### P1 — Liens présentés comme actions
Tout élément visuellement présenté comme un bouton doit rester un contrôle réel. Éviter les éléments purement décoratifs ayant le style `.btn`.

### P1 — États de navigation
Chaque action asynchrone doit avoir au minimum: loading/disabled pendant l'opération, succès, erreur et récupération. Les actions de partage doivent aussi gérer proprement l'annulation utilisateur.

### P1 — Routes dynamiques
Les liens `/product/:id`, `/service/:id`, `/:slug` et les liens dépendant des données doivent être testés avec des données réelles et avec données absentes/inexistantes.

## Verdict
**NON CERTIFIÉ à 100 % pour la règle « aucun bouton décoratif ou statique ».**

La vitrine principale montre de nombreux CTA réellement raccordés, et aucun faux `href="#"` / `javascript:void(0)` n'a été détecté dans la recherche statique. Mais une certification CTO exige une vérification runtime des clics, des routes, des états d'erreur et des retours utilisateur.

## Condition de passage
PASS uniquement après une matrice de tests runtime couvrant chaque CTA public, navigation, partage, contact, création, marketplace et authentification, avec résultat attendu et résultat observé.

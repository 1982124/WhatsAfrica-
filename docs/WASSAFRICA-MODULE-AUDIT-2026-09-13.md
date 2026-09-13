# WASSAFRICA — Audit module par module / état de fonctionnalité réel

Date: 2026-09-13  
Mode: CTO / Fullstack / UI-UX / Red Team / Truth / Product Owner  
Branche: `cto/smartlink-value-loop`  
Principe: **VRAI_AVANT_GRAND**

## 1. Règle de preuve

Une interface, une route, une table ou un workflow CI ne suffit pas à déclarer une fonctionnalité réellement fonctionnelle.

Statuts utilisés:

- **VERT — structure/contrôle vérifié**: code, route, CI ou schéma directement vérifié.
- **JAUNE — fonction préparée / partiellement prouvée**: briques présentes mais parcours réel incomplet ou non reproduit.
- **ROUGE — non prouvé / bloqué**: aucune preuve suffisante de fonctionnement bout-en-bout.
- **BLEU — dépendance externe**: nécessite partenaire, configuration ou événement réel hors du dépôt.

## 2. Synthèse CTO

| Module | État actuel | Impact correctif | Preuve manquante |
|---|---|---|---|
| Identité / profils | 🟢 structure solide | Faible | parcours complet multi-session |
| Smart Link | 🟡 préparé | P1 | test public complet |
| Messagerie | 🟡 structure + données existantes | **P0** | A→B réel complet |
| Appels audio/vidéo | 🟡 moteur + tables | **P0** | A→B réel audio/vidéo |
| Assistant commercial | 🟡 contrat défini | **P1** | réponses sur données réelles |
| Commerce | 🟡 infrastructure | P1 | commande réelle |
| Paiements | 🟡 infrastructure | P1/P0 avant activation | transaction réelle/partenaire |
| CRM | 🟡 schéma présent | P2 | parcours opérationnel |
| Notifications | 🟢 données présentes | P1 | déclenchement multi-canal réel |
| Groupes / communautés | 🟡 structure | P2 | test utilisateur complet |
| Business / vitrines | 🟢 structure | P1 | publication → visite → contact |
| Partner Network | 🟡 préparé | P1 | migration + premier partenaire |
| Analytics | 🟡 schéma | P1 | événements réellement observés |
| Admin / cockpit | 🟡 surface existante | P1 | audit des métriques et actions |
| Multilingue | 🟡 couche globale | P1 | parcours public par langue |
| Sécurité / RLS | 🟢 contrôles présents | **P0** | tests négatifs par rôle |
| Partage | 🟡 infrastructure | P2 | partage réel + attribution |
| Média Smart Link | 🟡 infrastructure | P1 | upload/affichage réel |
| Business Live | 🟡 structure | P2 | session réelle |
| Digital products | 🟡 structure | P2 | achat → entitlement |
| Télécom | 🟡 structure | P2 | partenaire/exécution réelle |

## 3. Base de données — constat réel

La base Supabase expose des briques RLS pour identité, conversations, messages, Smart Links, appels, commerce, paiements, CRM, notifications, groupes, analytics, sécurité et télécom.

Les données existantes ne doivent pas être confondues avec une preuve de production: plusieurs tables cœur commerce/appels/analytics restent sans événement métier réel dans l'instantané audité.

Point particulièrement important: `messages_v2` contient des données et des reçus existent; cela démontre une activité persistée du module, mais ne prouve pas encore le scénario A→B complet sur deux sessions indépendantes.

## 4. Messagerie — P0

### Ce qui est prouvé

- tables `conversations`, `conversation_members`, `messages_v2` présentes;
- RLS activé;
- `messages_v2` contient des données;
- `message_receipts` contient des données;
- primitives de chiffrement et d'enveloppes présentes;
- contrôles de marque/CI verts.

### Ce qui reste à prouver

`Compte A → découverte → conversation → envoi → Compte B → réception → réponse → A reçoit → reconnexion`.

### Impact correctif

**P0**: aucune extension fonctionnelle avant d'avoir fermé cette boucle.

## 5. Appels — P0

### Ce qui est prouvé

- `calls-v1.html` est la route `/calls`;
- moteur `wa-calls-v2.js` présent;
- WebRTC, permissions micro/caméra, signaling et contrôles présents;
- tables `call_sessions`, `call_participants`, `call_inbox`, `call_signals`, `call_history` présentes.

### Ce qui reste à prouver

Deux sessions réellement distinctes, avec audio puis vidéo, accept/reject, mute/caméra, hangup et historique.

### Impact correctif

**P0**.

## 6. Smart Link — P1

### Ce qui est prouvé

- Smart Link et données business présentes;
- couche de valeur et média présente;
- protection du CTA d'appel contre le fallback cellulaire implémentée;
- navigation vers le moteur d'appel WASSAFRICA préparée.

### Risque Red Team

Le garde-fou dépend d'une extraction de l'identifiant business depuis le DOM lorsque celui-ci n'est pas directement disponible. Ce point doit être testé sur un Smart Link public réel.

### Test attendu

`lien public → comprendre → parler → appeler → négocier → retour → partager`.

## 7. Assistant commercial — P1

Contrat fonctionnel: répondre uniquement depuis les données publiées/autorisées du business.

Interdictions: inventer prix, stock, disponibilité, livraison, partenaire, avis ou paiement.

### Preuve manquante

Tests avec données réelles et questions hors périmètre pour vérifier que l'assistant refuse proprement l'invention.

## 8. Commerce / paiement — P1

Les tables `orders`, `order_items`, `payment_intents`, `payment_events`, `payment_transactions`, `payment_connections`, `payment_requests` existent avec RLS, mais l'instantané ne montre pas de transaction métier réelle.

### Conclusion

Infrastructure présente, fonctionnalité transactionnelle **non certifiée**.

Pour les services réglementés: WASSAFRICA doit rester couche d'expérience/orchestration et le partenaire autorisé exécute le service réglementé.

## 9. Partner Network — P1

Le contrat, les surfaces et les documents sont préparés.

La preuve d'un réseau actif exige:

1. migration DB appliquée;
2. service partenaire réel;
3. referral réel;
4. consentement;
5. handoff;
6. outcome;
7. attribution;
8. commission contractuelle si applicable.

Aucun partenaire ne doit être présenté comme live avant ces preuves.

## 10. Multilingue — P1

La couche globale couvre FR/EN/PT/ES/AR et sépare la langue de l'UI du pays/devise/disponibilité.

### Red Team

La couverture globale ne suffit pas: chaque surface publique critique doit conserver son contenu et ses actions après changement de langue.

Smart Link public doit notamment être retesté en plusieurs langues.

## 11. Admin / Cockpit — P1

Le cockpit doit rester un centre de vérité opérationnelle. Les indicateurs doivent venir des données serveur et ne pas être fabriqués côté navigateur.

La présence d'un panneau de statut ne constitue pas une preuve des métriques ou des actions administratives.

## 12. Sécurité — P0

RLS est activé sur les tables auditées.

Mais RLS activé ≠ RLS correctement autorisé.

Tests négatifs à exécuter:

- A ne lit pas les données privées de B;
- A ne modifie pas les données business sans rôle;
- collaborateur ne retire pas de fonds;
- participant non autorisé ne lit pas une conversation;
- utilisateur bloqué ne contourne pas le blocage;
- endpoint sensible sans session/role échoue proprement.

## 13. CI / qualité de dépôt

Le dernier contrôle GitHub vérifié sur la branche a retourné SUCCESS pour:

- WASSAFRICA Certification;
- WASSAFRICA global brand check;
- WASSAFRICA brand normalization check;
- Continuous Regression;
- Delivery Governance;
- Final Release Gate.

Cela valide le contrôle automatisé du dépôt, pas les parcours utilisateur A→B.

## 14. Déploiement

Le dernier déploiement Vercel READY connu correspond à un commit antérieur au dernier état documentaire. La production HEAD ne doit donc pas être déclarée certifiée sans correspondance explicite SHA → deployment READY.

## 15. Impact correctif global

### P0 — avant clôture

1. correspondance HEAD → Vercel READY;
2. messagerie A→B;
3. appels A→B audio;
4. appels A→B vidéo;
5. tests négatifs RLS/sécurité;
6. absence de régression après chaque correction.

### P1 — juste après les P0

1. Smart Link public complet;
2. assistant commercial Truth;
3. multilingue des surfaces critiques;
4. commerce réel;
5. cockpit vérité;
6. analytics observables;
7. Partner Network sandbox/migration.

### P2 — après certification cœur

Groupes avancés, Business Live, produits digitaux, automatisations CRM avancées, télécoms et autres extensions non nécessaires à la boucle centrale.

## 16. Définition de « réellement fonctionnel »

Un module passe au statut **CERTIFIÉ** uniquement si:

**Code → CI → Déploiement → route réelle → utilisateur A → utilisateur B si nécessaire → données persistées → sécurité → résultat attendu → reconnexion → absence de régression → preuve documentée.**

## 17. Décision CTO

**Gel fonctionnel maintenu.**

Aucune nouvelle grosse fonctionnalité ne doit être ajoutée tant que les P0 ne sont pas fermés.

La priorité est maintenant la réduction du risque et l'augmentation de la preuve:

> **moins de surface incertaine, plus de parcours prouvés.**

La clôture finale de WASSAFRICA sera prononcée uniquement lorsque les preuves réelles contrediront le moins possible ce document — et toute contradiction doit devenir une correction ou un statut explicite, jamais être masquée.

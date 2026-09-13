# WASSAFRICA — Audit général et plan de clôture de l'infrastructure

Date: 2026-09-13  
Mode: CTO / Fullstack / UI-UX / Red Team / Truth / Product Owner  
Branche: `cto/smartlink-value-loop`

## 1. Verdict CTO

WASSAFRICA possède déjà une couverture technique très large. Le problème principal n'est plus l'absence de briques : c'est la **preuve bout-en-bout**, la cohérence entre les briques, la simplicité de parcours et la clôture des surfaces d'administration.

Règle de clôture:

> **Une fonctionnalité n'est considérée comme terminée que lorsque son parcours utilisateur réel, son contrôle métier, sa sécurité, son observabilité et sa preuve de production sont cohérents.**

Aucune fonctionnalité non intégrée ne doit être présentée comme disponible.

## 2. Architecture existante constatée

Le dépôt et la base couvrent notamment:

- identité / profils / Smart Link
- messagerie directe, conversations, messages chiffrés, reçus, médias, réactions
- conversations invitées sans inscription immédiate
- groupes / communautés / invitations / réactions
- appels audio/vidéo WebRTC et historique
- vitrines business, produits, services, collections
- commandes / livraison / suivi
- paiements, intents, connexions et événements
- CRM, leads, tags, affectation, notes, relances
- analytics et événements Smart Link
- notifications
- partage
- Business Live
- import de boutique et extraction assistée avec validation humaine
- abonnements / plans
- télécoms et règles de revenus
- administration et audit sécurité
- Partner Network / referrals / outcomes / commissions
- couche d'expérience et i18n

La base actuelle montre que les briques sont réellement matérialisées par des tables RLS, mais cela **ne prouve pas** que chaque parcours est opérationnel en production.

## 3. P0 — Clôture technique avant toute nouvelle fonctionnalité

### P0.1 Déploiement

- [ ] Obtenir un déploiement Vercel READY sur le HEAD actuel.
- [ ] Vérifier les routes réelles après déploiement.
- [ ] Vérifier les headers et noindex/no-store sensibles.
- [ ] Vérifier que le domaine canonique reste `https://wassafrica.vercel.app/`.
- [ ] Ne jamais certifier une modification uniquement sur GitHub CI.

### P0.2 Messagerie A → B

Test obligatoire avec deux sessions réellement distinctes:

`Compte A → recherche/Smart Link → conversation → message → Compte B → réception → réponse → Compte A`

À vérifier:

- création de membre/conversation
- insertion du message
- lecture/realtime
- receipts
- chiffrement lorsque le mode E2EE est annoncé
- pièces jointes
- réactions
- blocage / signalement
- absence de boucle ou doublon
- conservation après reconnexion

### P0.3 Appels A → B

Deux appareils/sessions:

- audio
- vidéo
- permission micro
- permission caméra
- ringing
- accept
- reject
- mute
- caméra ON/OFF
- hangup
- historique
- Wi-Fi
- données mobiles

La présence de `call_sessions`, `call_participants`, `call_signals` et `call_history` est une fondation, pas une preuve de fonctionnement.

### P0.4 Smart Link

Test obligatoire:

`lien public → identité → offres → coordonnées → assistant → parler → appel → négociation → commande/paiement → retour → partage`

Le Smart Link doit rester compréhensible sans connaître WASSAFRICA.

## 4. Smart Link — assistant commercial

L'assistant commercial est une brique centrale et doit rester visible sans devenir envahissant.

### Contrat produit

L'assistant doit répondre uniquement à partir des informations publiées/autorisées de l'activité:

- nom
- activité
- présentation
- produits
- prix
- services
- disponibilité lorsqu'elle est réellement publiée
- livraison
- zone de livraison
- moyens de paiement réellement configurés
- coordonnées publiques
- langue disponible

Il doit savoir:

1. répondre à une question simple;
2. montrer un produit/service pertinent;
3. expliquer un prix sans l'inventer;
4. expliquer la livraison sans l'inventer;
5. proposer de parler au vendeur;
6. transmettre une intention de négociation sans fabriquer une commande;
7. dire qu'une information n'est pas disponible lorsque la donnée manque;
8. respecter la langue du visiteur quand elle est disponible.

### Règle Truth

**Jamais:** prix inventé, stock inventé, livraison inventée, disponibilité inventée, partenaire inventé, avis inventé, paiement simulé.

## 5. Cockpit administrateur

Le cockpit `/cockpit` / `/admin` existe et dispose déjà d'une authentification administrateur avec contrôle du rôle et second facteur email avant chargement des métriques.

Il doit devenir le **centre de vérité opérationnelle**, pas une seconde application.

Minimum à clôturer:

- état production
- utilisateurs
- businesses
- Smart Links
- conversations/messages
- signalements
- commandes/paiements
- appels
- CRM/leads
- Partner Network
- services partenaires actifs/inactifs
- erreurs critiques
- journal de sécurité
- état des intégrations
- liens directs vers les surfaces d'action

Les métriques doivent provenir du serveur et ne jamais être inventées côté navigateur.

## 6. Simplicité utilisateur — règle de réduction

Navigation cible:

**Trouver → Comprendre → Parler → Faire affaire → Revenir**

Pour un business:

**Créer → Présenter → Recevoir → Répondre → Convertir → Revenir**

Pour un utilisateur:

**Voir → Demander → Parler → Acheter/Payer si disponible → Garder le lien**

Tout écran qui introduit une décision technique inutile doit être supprimé ou déplacé dans l'administration.

## 7. Multilingue

Langues cibles actuelles:

- Français
- English
- Português
- Español
- العربية

La langue UI ne doit jamais déterminer arbitrairement le pays, la monnaie ou la disponibilité d'un service.

Modèle:

`langue UI ≠ pays ≠ devise ≠ disponibilité ≠ partenaire`

Le contenu métier doit rester structuré indépendamment de la langue d'affichage.

## 8. Commerce

À clôturer par preuve:

- publication produit/service
- affichage Smart Link
- demande de contact
- commande
- idempotence
- statut commande
- livraison
- suivi
- paiement externe ou partenaire
- confirmation réelle
- remboursement lorsqu'il existe
- entitlement digital si produit digital

Une table `orders` ou `payment_intents` seule ne constitue pas une transaction réelle.

## 9. Paiements et services financiers

Le modèle cible reste:

`WASSAFRICA → expérience/orchestration → partenaire réglementé → exécution réelle`

WASSAFRICA ne doit pas prétendre détenir les fonds ou être fournisseur réglementé sans autorisation correspondante.

Avant activation réelle:

- partenaire identifié
- pays identifié
- service identifié
- contrat
- conformité/KYC
- endpoint/API réel
- sandbox testé
- webhook testé
- idempotence
- rapprochement
- attribution
- commission contractuelle

## 10. Partner Network

Le Partner Network reste distinct du Smart Link public.

Public:

`Besoin → comprendre → choisir → consentir → service`

B2B:

`Referral → handoff → outcome → attribution → commission`

Ne jamais exposer au visiteur les détails internes: webhook, tenant, scope API, commission ledger, etc.

## 11. Sécurité / Red Team

À vérifier avant clôture:

- RLS sur toutes les tables sensibles
- isolation par owner/business/partner
- aucun service-role key côté client
- aucune donnée sensible dans logs publics
- tokens de partage hashés
- expiration des sessions invitées
- rate limits sur surfaces abusables
- contrôle des uploads MIME/taille/path
- validation des URLs externes
- CSRF/clickjacking/headers
- permissions micro/caméra minimales
- aucun `tel:` lorsqu'un appel Internet WASSAFRICA est annoncé comme parcours canonique
- audit log pour opérations administratives sensibles

## 12. Dette structurelle à réduire

La base comporte plusieurs générations de tables et de surfaces. Il ne faut pas supprimer brutalement l'ancien modèle.

Clôture recommandée:

1. identifier le chemin canonique par domaine;
2. marquer les anciennes routes comme legacy;
3. rediriger lorsque sûr;
4. conserver les migrations et données nécessaires;
5. supprimer seulement après preuve qu'aucune route ne dépend encore de la brique.

## 13. Fonctionnalités secondaires

Les briques suivantes sont utiles mais ne doivent pas bloquer la clôture du noyau:

- gamification
- éducation
- Business Live avancé
- import/IA avancé
- thèmes avancés
- fonctionnalités sociales secondaires
- expansion télécom multi-opérateurs

Elles doivent rester derrière le noyau relationnel/commercial.

## 14. Critère de clôture de l'infrastructure

Le building WASSAFRICA peut être considéré comme **structurellement clôturé** lorsque les cinq conditions suivantes sont prouvées:

### A. Core

`Auth → profil → Smart Link → messagerie → appel`

### B. Commerce

`Smart Link → offre → conversation → commande → paiement disponible → suivi`

### C. Business

`Business → assistant → lead → CRM → relance → conversion`

### D. Network

`Besoin → partenaire → consentement → handoff → outcome → attribution`

### E. Control

`Cockpit admin → sécurité → métriques → audit → état des intégrations`

## 15. Ce qui est explicitement hors clôture sans preuve

- paiement réel non testé
- appel A→B non testé
- messagerie A→B non testée
- intégration bancaire non contractualisée
- intégration télécom non contractualisée
- assurance non intégrée
- diaspora non intégrée
- commission non calculée sur un événement réel
- disponibilité d'un partenaire non vérifiée
- métrique de croissance non observée

## 16. Ordre d'exécution CTO final

**1. Déploiement réel**  
**2. Messagerie A→B**  
**3. Appel audio/vidéo A→B**  
**4. Smart Link + assistant commercial**  
**5. Commerce/commande/paiement**  
**6. Cockpit admin complet**  
**7. Partner Network sandbox**  
**8. Première intégration partenaire réelle**  
**9. Audit sécurité final**  
**10. Certification production**

Après le point 10, toute nouvelle fonctionnalité doit passer le filtre:

> **Est-ce qu'elle réduit une friction réelle ? Si non, elle n'entre pas dans le noyau.**

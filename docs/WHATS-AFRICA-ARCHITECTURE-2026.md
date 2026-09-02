# WhatsAfrica — Architecture CTO 2026

## Décision d'architecture

WhatsAfrica conserve **Vercel + Supabase** comme socle de stabilisation. Aucune migration AWS/GCP n'est déclenchée tant que le Messaging Core, SmartLink et WebRTC ne sont pas certifiés en E2E.

Principe : **Stabiliser → Certifier → Monétiser → Mesurer → Scaler**.

## 1. Architecture actuelle / cible

### Maintenant
```text
Browser / PWA
   ↓ HTTPS + JWT
Vercel Edge / CDN
   ├── pages HTML
   └── API serverless
        ↓
Supabase
   ├── Auth
   ├── PostgreSQL + RLS
   ├── Realtime
   ├── Storage
   └── RPC sécurisées
```

### Cible progressive
```text
CDN / Edge
   ↓
Load Balancer
   ↓
Node.js API + WebSocket
   ├── Messaging
   ├── SmartLink
   ├── Calls signaling
   ├── Commerce / Payments
   └── AI assistant
   ↓
PostgreSQL  ←→ Redis
   ↓
Object Storage / CDN
```

Migration par **strangler pattern** : les modules stables restent sur Supabase pendant que les modules à forte charge migrent progressivement.

## 2. Messaging Core

- Transport prioritaire : Supabase Realtime aujourd'hui, WebSocket dédié après migration.
- Fallback : reconnexion + polling intelligent uniquement lorsque Realtime est indisponible.
- Types : texte, vocal, image, document et autres pièces jointes autorisées.
- États : `sending → sent → delivered → read`.
- Les accusés doivent être idempotents et associés à `message_id + user_id`.
- Pagination par curseur, jamais de chargement illimité de l'historique.

## 3. E2EE — décision de sécurité

Le chiffrement de bout en bout ne doit **pas** être implémenté comme « AES + RSA » de façon naïve.

Cible :
- échange de clés modernes de type X25519 ;
- signatures/identité de clés de type Ed25519 ;
- chiffrement de contenu avec AES-256-GCM ou ChaCha20-Poly1305 ;
- clés privées conservées côté appareil ;
- serveur limité au transport/stockage du ciphertext ;
- rotation, révocation et multi-device ;
- suppression/révocation d'appareil ;
- protection contre replay et race conditions.

Aucune promesse d'E2EE « certifié » avant test réel A→B sur deux sessions et vérification que le serveur ne reçoit jamais le plaintext.

## 4. SmartLink universel

Chaque ressource partageable peut recevoir un SmartLink :
- conversation ;
- message ;
- appel ;
- communauté ;
- business / vitrine ;
- contenu commercial.

Propriétés :
- token aléatoire non devinable ;
- hash du token côté serveur ;
- permission `private | limited | public` ;
- expiration ;
- limite d'utilisation ;
- révocation ;
- résolution publique minimale ;
- journalisation clic / ouverture / conversion sans exposer de données privées.

Flux :
```text
Partage → /s/:token → résolution sécurisée → landing → ouverture app/web → conversion
```

## 5. Invitations et partage

Canaux :
- SmartLink ;
- QR ;
- Web Share API ;
- copie de lien ;
- partage social via le système natif.

Une invitation ne doit jamais ajouter automatiquement un inconnu à une communauté : elle présente le contexte puis demande une action volontaire **Rejoindre**.

## 6. Audio / vidéo

Le moteur WebRTC v2 est conservé.

- audio : Opus ;
- vidéo : VP8 ou H.264 selon capacités navigateur ;
- STUN aujourd'hui ;
- TURN obligatoire en production pour les réseaux difficiles ;
- signaling via canal privé Realtime aujourd'hui ;
- WebSocket signaling après migration ;
- adaptive bitrate basé sur `getStats()` ;
- arrêt propre des tracks et du peer connection ;
- aucun média d'appel stocké par défaut.

Les appels partagés utilisent également SmartLink avec expiration et nombre maximal d'utilisations.

## 7. Performance

Objectifs :
- TTFB cible < 200 ms ;
- LCP cible < 2 s ;
- CLS < 0,1 ;
- INP < 200 ms.

Actions : compression WebP/AVIF, lazy loading, pagination, debounce recherche, réduction JS, cache des ressources statiques et limitation des requêtes Supabase répétitives.

## 8. Sécurité

- HTTPS + HSTS ;
- JWT Supabase ;
- RLS sur les tables exposées ;
- autorisation côté serveur/RPC ;
- rate limiting ;
- anti-spam ;
- validation des entrées ;
- uploads contrôlés ;
- idempotency keys sur commandes/paiements ;
- MFA renforcé pour l'administration ;
- WebAuthn/biométrie comme amélioration progressive côté appareil, sans imposer un authentificateur complexe aux utilisateurs ordinaires.

## 9. Commerce et paiements

WhatsAfrica utilise une couche d'abstraction de paiement :

```text
Checkout WhatsAfrica
   ├── Mobile Money local
   │    ├── Orange Money
   │    ├── Wave
   │    └── M-Pesa selon pays
   └── Fournisseur externe / carte
```

Un fournisseur n'est marqué « intégré » qu'après API réelle, credentials de test, callback/webhook et transaction de bout en bout vérifiés.

## 10. Monétisation

### Free
- messagerie et communautés de base ;
- SmartLink ;
- appels de base ;
- publicité légère hors conversations privées.

### Business
- vitrine avancée ;
- catalogue ;
- assistant commercial ;
- CRM ;
- analytics ;
- moins de publicité.

### Premium
- fonctionnalités avancées ;
- IA renforcée ;
- analytics avancées ;
- zéro publicité.

Les prix restent des hypothèses à tester avec le marché, pas des valeurs codées en dur.

## 11. UX afro-digital

Direction : premium, sobre, africaine sans cliché.

Palette de référence :
- fond nuit profond ;
- or chaud ;
- vert/teal ;
- surfaces bleu-noir ;
- contraste AA minimum.

Navigation cœur :
**Communiquer · Découvrir · Développer**.

SmartLink = portail d'acquisition : toute ouverture publique doit permettre de découvrir WhatsAfrica sans compte avant de demander une authentification.

Langues prioritaires : français, anglais, swahili, arabe avec support RTL.

## 12. Roadmap 12 mois

### M1–M2 — Stabilisation
Messaging Core, Realtime, SmartLink, invitations, erreurs, sécurité, performance.

### M3 — Certification
Tests A→B messages, vocal, pièces jointes, read receipts, SmartLink, invitation, reconnect et WebRTC.

### M4 — Monétisation
Plans Free/Business/Premium, paywall, analytics conversion, paiement abstrait.

### M5–M6 — Commerce
Marketplace MVP, commandes, paiement local, CRM et assistant commercial.

### M7 — Performance
CDN, cache, Core Web Vitals, optimisation Supabase et observabilité.

### M8–M9 — Migration progressive
Premier service Node.js, Redis pour cache/rate-limit/queues, WebSocket pour signaling/messaging selon métriques.

### M10 — Multi-région
Déploiement régional, réplication/stratégie de données, CDN mondial, disaster recovery.

### M11 — E2EE avancé
Multi-device, rotation/révocation, recovery, vérification de clés et audit cryptographique.

### M12 — Scale
Marketplace étendu, campagnes multicanal, sponsoring Business Live, expansion pays et optimisation revenus.

## 13. Critère de sortie « production-ready »

Aucun module critique n'est déclaré certifié sur la seule présence du code.

Certification requise :
1. build réussi ;
2. routes accessibles ;
3. navigateur sans erreur console bloquante ;
4. test utilisateur A→B ;
5. test mobile/touch ;
6. test reconnexion ;
7. contrôle RLS/auth ;
8. test réel des fournisseurs de paiement concernés ;
9. métriques de performance mesurées.

# WhatsAfrica — Roadmap produit 12 mois

## M1 — Fondations
- Auth complète email/password, confirmation, recovery, OAuth.
- RLS, sessions, anti-abus et observabilité.
- Certification des routes critiques.

## M2 — Messaging Core
- Realtime WebSocket/Broadcast.
- Texte, pièces jointes, vocal.
- Sent / delivered / read.

## M3 — SmartLink Growth
- Conversation, message, appel, groupe, business, produit.
- Permissions public / limité / privé.
- Tracking ouverture, source, conversion.

## M4 — Invitations
- Lien, QR, partage natif, SMS/email/social.
- Parcours découverte → confiance → rejoindre.

## M5 — Appels
- WebRTC audio/vidéo.
- STUN/TURN réel.
- Opus, VP8/H.264 selon capacités.
- Reconnexion et adaptation réseau.

## M6 — Business
- Vitrine, pitch deck, vidéo/audio.
- Votre assistant commercial.
- CRM et leads.

## M7 — Commerce
- Marketplace MVP.
- Commandes idempotentes.
- Abstraction Mobile Money / cartes.

## M8 — Monétisation
- Freemium, Business, Premium.
- Limites serveur et paywall.
- Analytics conversion.

## M9 — Acquisition
- SmartLink comme moteur d'acquisition.
- SEO, campagnes multicanal et contenus.
- Programme de parrainage.

## M10 — Performance
- Core Web Vitals mesurés.
- CDN, images lazy, pagination, réduction JS.
- Budget performance par route critique.

## M11 — Scalabilité
- Préparation strangler migration.
- Node.js API + PostgreSQL + Redis.
- Queues, rate limiting, présence et jobs.

## M12 — Expansion
- Multi-régions si les métriques le justifient.
- Paiements multi-pays.
- Marketplace avancée et offres premium.

## KPI CTO
- disponibilité et taux d'erreur
- temps de connexion
- livraison/read receipt latency
- succès d'appel A↔B
- conversion SmartLink → inscription → conversation → commande
- rétention J1/J7/J30
- coût infrastructure par utilisateur actif
- Core Web Vitals

## Règle de migration
Ne pas migrer pour migrer. Déclencher la migration lorsque le trafic, les coûts, les exigences de disponibilité ou les limites de la plateforme rendent le changement économiquement et techniquement justifié.

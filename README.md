# WASSAFRICA-

WASSAFRICA évolue d'une application de messagerie vers une **infrastructure relationnelle, commerciale et numérique panafricaine**.

## Positionnement

**WASSAFRICA = la couche relationnelle et commerciale africaine qui connecte personnes, entreprises, communautés, services et paiements.**

- Messaging = moteur d'adoption
- Smart Links = moteur de viralité
- Business = moteur de valeur
- Commerce = moteur de revenus
- AI = moteur d'intelligence
- Paiements = moteur transactionnel
- API / télécoms = moteur de distribution
- Interopérabilité = moteur panafricain

## Produit existant à préserver

Le projet contient déjà des briques de messagerie, conversations, groupes, appels, Smart Links, business/vitrines, catalogue, CRM/leads, commerce, commandes, paiements, analytics, live et assistant. La stratégie 2026 consiste à **relier et stabiliser ces briques**, pas à repartir de zéro.

## African Network

Une nouvelle surface publique est disponible sur **`/network`**. Elle présente l'architecture cible et le parcours :

`Smart Link → visiteur → découverte → téléphone/OTP lorsque nécessaire → conversation → lead/commande → paiement → nouveau participant au réseau`.

Voir aussi : `docs/whatsafrica-strategy-2026.md`.

## Règle CTO

> **WASSAFRICA DOIT ÊTRE VRAI AVANT D'ÊTRE GRAND.**

Une interface, une route, une table, un endpoint ou une Edge Function ne constitue pas à lui seul une certification. Toute fonctionnalité critique doit être vérifiée de bout en bout avant d'être marquée comme certifiée.

## Exécution

`Audit → changement minimal nécessaire → tests → commit → déploiement → vérification production → correction des régressions → certification avec preuve.`

## Android

Le dépôt contient désormais un socle Android **Trusted Web Activity (TWA)** sous `android/`, centré sur la production `https://wassafrica.vercel.app/`.

<!-- production redeploy trigger: Android PWA icon verification -->

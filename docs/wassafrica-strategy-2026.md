# WASSAFRICA — Strategy 2026

## Principle

**WASSAFRICA DOIT ÊTRE VRAI AVANT D'ÊTRE GRAND.**

WASSAFRICA évolue d'un produit de messagerie vers un réseau relationnel, commercial et numérique africain sans jeter les fondations qui fonctionnent déjà.

## Product equation

- **Messaging = moteur d'adoption**
- **Smart Links = moteur de viralité**
- **Business = moteur de valeur**
- **Commerce = moteur de revenus**
- **AI = moteur d'intelligence**
- **Paiements = moteur transactionnel**
- **Télécom/API = moteur de distribution**
- **Interopérabilité = moteur du réseau panafricain**

## Target architecture

```text
WASSAFRICA
│
├── PEOPLE
│   ├── identité téléphone
│   ├── messagerie
│   ├── groupes
│   ├── voix
│   └── appels
│
├── BUSINESS
│   ├── profils
│   ├── catalogue
│   ├── CRM
│   ├── équipes
│   └── automatisation
│
├── SMART LINKS
│   ├── découverte
│   ├── identité
│   ├── liens profonds
│   └── acquisition
│
├── COMMUNITY
│   ├── groupes
│   ├── live
│   └── événements
│
├── COMMERCE
│   ├── produits
│   ├── commandes
│   ├── paiements
│   └── livraison
│
├── AFRICA AI
│   ├── assistant
│   ├── traduction
│   ├── recherche
│   └── agents commerce
│
└── API / PARTNERS
    ├── opérateurs
    ├── fintechs
    ├── banques
    └── services externes
```

## Current repository evidence

Le dépôt contient déjà les fondations de cette direction : messagerie/conversations, groupes, businesses, Smart Links, produits, commandes, paiements, CRM/leads, analytics, appels, live/business-live et surfaces liées à l'IA. Ces fondations doivent être reliées et stabilisées plutôt que recréées.

## Strategic conversion loop

```text
Smart Link
   ↓
Visiteur externe
   ↓
Découvrir le contenu
   ↓
Ouvrir / rejoindre
   ↓
Téléphone + OTP lorsque l'identité est nécessaire
   ↓
Conversation / contexte business
   ↓
Lead / commande
   ↓
Rail de paiement
   ↓
Livraison / service
   ↓
Le client devient participant du réseau
   ↓
Nouveau Smart Link / recommandation
```

## Certification rule

Une interface, une route, une table de base de données, un endpoint ou une Edge Function ne constitue pas à lui seul une preuve de fonctionnalité.

Une capacité ne peut être marquée **CERTIFIÉE** qu'après exercice du flux de bout en bout avec des preuves UI → backend → données/service → état succès/erreur → production.

Cela s'applique notamment à :

- téléphone OTP ;
- E2EE A ↔ B ;
- appels audio/vidéo A ↔ B ;
- paiements ;
- commandes ;
- continuité Smart Link visiteur → compte → destination ;
- appels aux fournisseurs IA.

## Execution priority

### P0 — Network core
Identité, Auth/OTP téléphone, messagerie, contacts, Smart Links.

### P1 — Business
Profil business, catalogue, CRM, équipes et conversation client.

### P2 — Commerce
Commandes, checkout, adaptateurs de paiement et état de livraison.

### P3 — AI
Assistant, traduction, découverte et agents commerce.

### P4 — Interoperability
Partenariats opérateurs, banques, fintechs et API externes.

## Geographic rollout logic

Commencer par un corridor ouest-africain dense plutôt que de se disperser sur tout le continent :

1. Mali
2. Burkina Faso
3. Togo
4. Côte d'Ivoire
5. Sénégal
6. Bénin
7. Ghana
8. Nigeria
9. Afrique centrale/orientale et diaspora

Il s'agit d'une hypothèse stratégique, pas d'une affirmation que toutes les intégrations listées existent déjà.

## Security principle

La confidentialité reste un pilier produit. WASSAFRICA ne doit pas revendiquer des garanties cryptographiques équivalentes à Signal sans architecture et audit indépendant permettant de les justifier.

La plateforme doit rester multi-opérateur, multi-banque, multi-wallet et multi-pays.

## Cost discipline

Chaque capacité majeure doit être évaluée selon :

- coût infrastructure ;
- coût fournisseur ;
- coût par utilisateur actif ;
- coût par transaction ;
- impact acquisition ;
- impact rétention ;
- potentiel de revenus.

## Definition of done

**Audit → changer uniquement ce qui est nécessaire → tester → commit → déployer → vérifier la production → corriger les régressions → certifier uniquement avec preuve.**

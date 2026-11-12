# WASSAFRICA — Paiements marketplace à règlement direct

**Statut :** décision d'architecture, non activée en production  
**Date :** 10 octobre 2026

## Décision non négociable

WASSAFRICA est une marketplace d'intermédiation. Le vendeur indépendant (par exemple ABADA JOSE) est le vendeur du produit qu'il publie. WASSAFRICA fournit la vitrine, le Smart Link, le parcours d'achat et les outils commerciaux ; elle perçoit une commission convenue.

WASSAFRICA ne collecte pas le prix total pour le conserver, ne maintient pas un portefeuille vendeur interne et ne promet pas de solde retirable depuis un compte WASSAFRICA. Le prestataire doit, lorsque le produit et la juridiction le permettent, répartir le paiement au moment de l'encaissement : commission WASSAFRICA versée à WASSAFRICA et produit net dû versé directement au compte marchand du vendeur. La documentation commerciale et les contrats doivent confirmer que le dispositif ne fait pas de WASSAFRICA un dépositaire ou un gestionnaire de fonds des vendeurs.

Si un prestataire ne peut pas effectuer ce règlement direct ou si l'admissibilité de l'entité et du vendeur n'est pas confirmée par écrit, ce moyen de paiement reste désactivé pour ce couple pays/prestataire. Pas de contournement par une société-écran, une adresse étrangère fictive ou un compte marchand partagé non autorisé.

## Périmètre commercial

- Entités WASSAFRICA implantées notamment au Mali et au Bénin.
- Vendeurs indépendants avec leur propre compte marchand ou bénéficiaire de règlement.
- Acheteurs locaux et diaspora africaine : Europe, Royaume-Uni, Canada, États-Unis et autres marchés, sous réserve d'éligibilité.
- Produits numériques, livres et collections en premier ; les produits physiques/services suivent leurs contraintes propres.
- Devises, opérateurs et moyens de paiement activés explicitement par pays.

## Règles de règlement

1. Chaque commande enregistre le vendeur bénéficiaire, le pays du vendeur, le pays de l'acheteur, la devise, le prix et une version figée de la règle de commission.
2. Le calcul de répartition est déterministe et exprimé en unités monétaires mineures ou en décimales contrôlées ; la somme des parts doit égaler le montant réparti, avec les frais attribués selon le contrat.
3. La commission n'est comptabilisée comme acquise qu'après le statut de paiement vérifié prévu par le contrat du prestataire.
4. Le vendeur est bénéficiaire direct de sa part ; WASSAFRICA ne crée aucun portefeuille interne et ne retarde pas les versements pour des raisons commerciales propres à la plateforme.
5. Les remboursements, litiges, rétrofacturations, réserves et frais sont documentés séparément. Ils ne doivent pas créer de solde vendeur négatif implicite ni être prélevés sans base contractuelle.
6. Aucun accès à un produit numérique ne doit être accordé sur la seule base d'une redirection navigateur, d'une capture d'écran ou d'un message client. Une confirmation serveur authentifiée, rapprochée du montant, de la devise, de la référence et de la commande, est requise.
7. Les webhooks sont idempotents, les transitions d'état sont contrôlées et les événements bruts nécessaires au rapprochement sont conservés sans stocker de secrets de paiement.
8. La commission, les frais du prestataire, la part du vendeur, les remboursements et le montant effectivement réglé sont des champs distincts dans le journal d'audit.

## Exigences minimales pour qualifier un prestataire

Le fournisseur doit confirmer par écrit, pour chaque entité WASSAFRICA et chaque pays concerné :

- l'admission d'une entreprise établie au Mali et/ou au Bénin ;
- l'acceptation de cartes émises dans la diaspora et des moyens locaux annoncés ;
- la possibilité de fractionner une même transaction entre la commission plateforme et un vendeur indépendant ;
- le règlement direct au compte du vendeur sans conservation des fonds par WASSAFRICA ;
- les pays et types de bénéficiaires admissibles, la procédure KYC/KYB et les restrictions sur les produits numériques ;
- les devises d'encaissement et de règlement, la conversion, les frais complets et les délais ;
- les règles de réserves, suspension, blocage, remboursements, litiges, rétrofacturations, appel et restitution des fonds ;
- les responsabilités juridiques et opérationnelles respectives du prestataire, de WASSAFRICA et du vendeur ;
- les outils de rapprochement, les webhooks signés, les références stables et la procédure de sortie/export des données.

Un taux d'acceptation global annoncé ne suffit pas : demander des données segmentées par pays d'émission, moyen de paiement et devise, ainsi qu'une méthode de suivi des refus.

## Architecture applicative cible

- Une interface interne de capacités de prestataires, indépendante d'un fournisseur : pays de l'entité, pays acheteur, pays vendeur, devise, moyen, fractionnement, règlement direct, remboursements et vérification de statut.
- Une configuration d'activation explicite par combinaison entité / pays / devise / moyen de paiement.
- Un journal d'opérations et de rapprochement qui n'est pas un portefeuille ni un compte de conservation des fonds.
- Une règle de commission versionnée, visible avant achat et figée sur la commande.
- Des clés et secrets exclusivement côté serveur, idéalement dans un coffre de secrets ; aucun secret dans le navigateur ou le dépôt.
- Une clé d'idempotence par tentative, des événements dédupliqués et une vérification serveur du montant, de la devise, du vendeur et de la référence.
- Un mécanisme de bascule vers un autre prestataire uniquement lorsqu'il est contractuellement autorisé et après échec explicite ; jamais de double débit ni de contournement antifraude.
- Des tests sandbox, tests de litige/remboursement, rapprochement comptable et revue de sécurité avant activation réelle.

## État observé dans le dépôt au moment de la décision

- Le parcours existant `api/payment-moneyfusion.js` initialise un paiement via le secret Money Fusion connecté par le vendeur.
- Ce parcours limite actuellement la devise à XOF.
- Le code observé ne calcule pas ni ne transmet de partage automatique de commission à WASSAFRICA.
- La base possède déjà `orders`, `order_items`, `payment_intents`, `payment_events`, `payment_connections`, `checkout_groups` et `digital_entitlements`.
- La connexion fournisseur est actuellement centrée sur `moneyfusion`; elle ne constitue pas encore une abstraction multi-prestataires.
- Les structures de commande et de paiement ne prouvent pas à elles seules qu'un fournisseur effectue un règlement direct partagé.

En conséquence, le système actuel ne doit pas être présenté comme réalisant déjà le modèle de règlement direct avec commission. L'intégration financière reste désactivée pour tout pays ou prestataire tant que les capacités et conditions ci-dessus ne sont pas validées.

## Plan d'exécution sécurisé

1. Obtenir des réponses contractuelles écrites et un tableau de couverture par pays.
2. Sélectionner un premier couple entité/pays et prestataire qui satisfait toutes les exigences.
3. Ajouter une couche d'adaptateurs de paiement et un journal de répartition ; ne pas créer de portefeuille vendeur interne.
4. Tester les scénarios de succès, attente, refus, double webhook, montant/devise erronés, remboursement, litige et panne fournisseur.
5. Faire valider la comptabilité, la conformité et la sécurité avant activation en production.
6. Activer progressivement uniquement les pays et moyens dont l'éligibilité a été confirmée.

**Aucun compte fournisseur, clé API, tarif ou accès en production n'est supposé. Aucun paiement réel ne doit être lancé tant que la validation commerciale et juridique n'est pas terminée.**

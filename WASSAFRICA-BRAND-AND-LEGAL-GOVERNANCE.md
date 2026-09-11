# WASSAFRICA — Brand, UX & Legal-Risk Governance

## Statut de ce document
Ce document encadre l'évolution de l'application existante WhatsAfrica vers **WASSAFRICA**. Il ne remplace pas un avis juridique local. Les textes publiés doivent être relus et adaptés aux lois applicables aux pays dans lesquels WASSAFRICA opère.

## Marque
- Nom d'affichage unique : **WASSAFRICA**.
- Graphies interdites dans l'interface : WhatsAfrica, WasAfrica, WazAfrica.
- Définition de positionnement : « WASSAFRICA — World Access Store Africa. Une plateforme d'accès mondial au marché africain : une identité numérique, une vitrine commerciale et un espace de marché pensés par et pour les entrepreneurs, commerçants et créateurs d'Afrique et de sa diaspora. »
- L'acronyme n'est pas à décoder dans l'UI.
- Domaine cible : `wassafrica.com`.
- Les anciennes routes internes peuvent rester inchangées pour préserver la compatibilité.

## Positionnement et concurrence
WASSAFRICA est présenté comme une plateforme de découverte, d'identité numérique et de commerce. WhatsApp reste un canal externe de contact lorsque le vendeur ou l'utilisateur choisit un lien `wa.me`. Ne jamais présenter WASSAFRICA comme un service officiel, affilié, sponsorisé ou approuvé par WhatsApp, Meta ou une autre marque tierce sans preuve contractuelle.

## Identité et confiance
- Un pseudo public reste possible.
- Un nom réel ne doit être affiché comme « vérifié » que si une source de vérification réelle et documentée l'atteste.
- Ne jamais présenter une donnée auto-déclarée comme une identité vérifiée.
- Toute vérification par un fournisseur tiers doit respecter consentement, finalité, minimisation des données, sécurité et conditions du fournisseur.
- Une intégration Truecaller, si activée, doit utiliser uniquement les API/SDK et droits commerciaux réellement autorisés par Truecaller et ne doit jamais supposer un accès à une base privée générale.

## Marché et vendeurs
Avant tout paiement intégré futur :
1. identité du vendeur suffisamment établie selon le niveau de risque ;
2. numéro de téléphone confirmé au minimum lorsque ce mécanisme est disponible ;
3. règles de contenu et de produits interdits ;
4. conditions de vente, remboursements et litiges clairement présentés ;
5. journalisation des événements sensibles ;
6. aucun affichage laissant croire à une garantie WASSAFRICA si elle n'existe pas.

## Contenu utilisateur
Les utilisateurs restent responsables des contenus et offres qu'ils publient, sous réserve des obligations légales applicables à la plateforme. Prévoir signalement, blocage, retrait de contenu illicite et conservation limitée des éléments nécessaires au traitement des abus et litiges.

## Vie privée
Principes par défaut :
- collecter uniquement ce qui est nécessaire ;
- expliquer pourquoi une donnée est demandée ;
- limiter l'exposition publique des coordonnées ;
- séparer données publiques, données privées et données de vérification ;
- appliquer RLS et contrôles serveur aux données sensibles ;
- ne jamais placer de clé secrète/service-role dans le navigateur ;
- prévoir suppression/export lorsque requis par le droit applicable ;
- documenter les sous-traitants et transferts internationaux pertinents.

## Paiements
WASSAFRICA ne doit pas promettre une protection, un remboursement, une conservation de fonds ou une conformité réglementaire particulière tant que ces services ne sont pas effectivement opérés et couverts par des prestataires/conditions adaptés.

## UX
La sécurité doit être invisible. La confiance doit être visible.
- Interdit dans l'UI utilisateur : RLS, RPC, E2EE, device, « préparation du chiffrement ».
- Préférer : « Envoi en cours… », « Message envoyé », « Message en attente… », « Réessayez dans un instant ».
- Parcours cible : **Rechercher → Trouver → Écrire → Envoyer**.

## Charte
- Terracotta `#C85A32` : boutons, badges et grands éléments graphiques.
- Or solaire `#E9A825` : boutons, badges et éléments graphiques larges.
- Vert profond `#1B4332` : confiance, validation et liens WhatsApp uniquement.
- Fond sable `#FDFBF7`.
- Texte anthracite `#1E1E1E`.
- Terracotta et ambre ne doivent pas servir de texte courant sur fond clair lorsque le contraste est insuffisant.

## SEO et migration
- Accueil et Marché : indexables, titres et descriptions WASSAFRICA.
- Espaces personnels : `noindex, nofollow`.
- Lorsque `wassafrica.com` est actif et contrôlé, mettre en place des redirections permanentes de l'ancien domaine vers les équivalents du nouveau domaine et conserver les anciennes URLs internes compatibles.
- Ne pas annoncer une disponibilité juridique ou commerciale du domaine uniquement sur la base d'une vérification de disponibilité technique.

## Règle de livraison
Aucune fonctionnalité n'est déclarée « 100 % fonctionnelle » sans test réel du parcours concerné. Toute modification doit préserver les routes et composants existants lorsqu'ils peuvent être adaptés plutôt que recréés.

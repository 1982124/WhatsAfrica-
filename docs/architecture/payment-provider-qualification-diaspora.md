# Qualification des prestataires — diaspora et règlement direct

**Date de vérification documentaire :** 10 octobre 2026  
**Décision :** aucun prestataire n'est approuvé pour la production. Les pages officielles documentent des fonctionnalités, pas l'admissibilité contractuelle de WASSAFRICA.

## Le besoin exact

WASSAFRICA possède des implantations en Afrique, notamment au Mali et au Bénin. Les acheteurs peuvent se trouver dans la diaspora (France, Belgique, Royaume-Uni, Canada, États-Unis et autres pays). Le vendeur reste le vendeur indépendant de son produit. La plateforme perçoit sa commission convenue.

La contrainte décisive est le règlement : WASSAFRICA ne doit pas recevoir le montant dû au vendeur pour le conserver dans son propre solde puis le lui reverser manuellement. Le parcours retenu doit être un split/settlement du prestataire vers le vendeur et WASSAFRICA, ou un mécanisme explicitement approuvé par le conseil juridique comme ne constituant pas une conservation de fonds par la plateforme.

## Résultats documentaires

### 1. PayDunya — bonne couverture régionale, modèle de règlement à clarifier

Sources officielles :
- SoftPay et moyens annoncés : https://developers.paydunya.com/doc/FR/softpay
- API HTTP/JSON et PER : https://developers.paydunya.com/doc/FR/http_json
- Débours : https://developers.paydunya.com/doc/FR/api_deboursement

Constats :
- La documentation SoftPay énumère la carte bancaire internationale et des moyens locaux dont Orange Money et Moov au Mali, Moov/MTN/Celtiis au Bénin, ainsi que des opérateurs dans plusieurs autres pays de la région.
- L'API PER est présentée comme un mécanisme de redistribution vers les comptes destinataires PayDunya. La documentation précise que les transferts sont initiés depuis le compte PayDunya du marchand vers des comptes clients PayDunya. Cela ne démontre pas que la vente peut être réglée nativement au vendeur sans que le montant passe d'abord par le compte marchand WASSAFRICA.
- L'API de débours liste plusieurs wallets régionaux en XOF, mais le débours n'est pas équivalent à un split d'encaissement.
- Il faut vérifier séparément l'accès des entités malienne et béninoise, l'admissibilité des vendeurs indépendants et les conditions de blocage/réserve.

Décision : **ne pas approuver pour le modèle strict de règlement direct tant que PayDunya ne confirme pas par écrit le flux exact et le rôle du compte marchand.** Une redistribution depuis le solde de WASSAFRICA ne satisfait pas automatiquement l'exigence.

### 2. Flutterwave — split technique documenté, éligibilité régionale non démontrée

Source officielle : https://developer.flutterwave.com/docs/split-payments

Constats :
- La documentation décrit le partage d'un paiement entre sous-comptes bancaires et une commission de plateforme.
- Les versements aux sous-comptes suivent le cycle de règlement du prestataire ; « split » ne signifie donc pas nécessairement crédit instantané au vendeur.
- Flutterwave précise que les marchands de la marketplace restent sous la responsabilité de la plateforme et que litiges/rétrofacturations sont imputés au compte de la plateforme.
- La documentation technique ne confirme pas que les entités WASSAFRICA établies au Mali et au Bénin peuvent ouvrir un compte plateforme, ni que des vendeurs de ces pays peuvent être onboardés pour recevoir un split en XOF.
- La fonctionnalité documentée vise notamment des coordonnées de comptes bancaires ; l'acceptation d'un portefeuille Mobile Money comme compte bénéficiaire doit être confirmée par pays.

Décision : **candidat à contacter, pas candidat prêt pour production.** Demander confirmation d'admissibilité Mali/Bénin, règlement des sous-comptes, cartes diaspora, devises, réserves, recours et couverture des bénéficiaires Mobile Money.

### 3. CinetPay — candidat régional, split non établi par les sources consultées

Source de départ : https://cinetpay.com/

Constat :
- CinetPay est à qualifier pour l'encaissement régional et les cartes de la diaspora.
- Les éléments consultés ne suffisent pas à prouver un partage automatique d'une même transaction entre un compte WASSAFRICA et un vendeur indépendant, sans solde vendeur conservé par WASSAFRICA.

Décision : demander une réponse écrite et une démonstration de split/settlement. Ne pas assimiler paiement de masse ou API de transfert à un split à l'encaissement.

### 4. Stripe Connect — pas de raccourci d'éligibilité

Source : https://stripe.com/connect

Constat :
- Les fonctionnalités marketplace sont pertinentes en théorie, mais l'éligibilité dépend du pays d'établissement de la plateforme et des pays de ses comptes connectés.
- Ne pas créer de société-écran, ne pas utiliser d'adresse fictive et ne pas ouvrir un compte sous le pays d'un tiers pour contourner les restrictions.

Décision : ne pas retenir comme infrastructure immédiate sans confirmation officielle de l'éligibilité d'une entité WASSAFRICA réelle.

### 5. Money Fusion — intégration existante, pas de split de commission observé

Code examiné : `api/payment-moneyfusion.js`.

Constats :
- Le parcours existant initie le paiement à partir de l'URL secrète connectée par le vendeur et limite la devise à XOF.
- Aucun calcul ni paramètre de partage automatique de commission WASSAFRICA n'a été observé dans ce parcours.
- Ne pas présenter cette intégration comme un système de règlement direct avec commission plateforme tant qu'une capacité contractuelle et technique correspondante n'est pas démontrée.

Décision : préserver le parcours actuel, mais ne pas l'étendre au partage de commission sans spécification fournisseur et tests.

## Tableau de décision

| Critère | PayDunya | Flutterwave | CinetPay | Money Fusion actuel |
|---|---|---|---|---|
| Mobile Money Mali/Bénin documenté | Oui, plusieurs moyens régionaux | À confirmer pour nos entités et vendeurs | À confirmer | Parcours existant en XOF, capacités à confirmer |
| Carte diaspora documentée | Oui, carte internationale dans SoftPay | À confirmer pour l'entité | À confirmer | À confirmer |
| Split/commission documenté | PER redistribue depuis le compte marchand ; règlement direct à confirmer | Oui, sous-comptes et commission | Non démontré par les sources consultées | Non observé dans le code actuel |
| Fonds vendeur sans conservation par WASSAFRICA | Non démontré | Possible techniquement via split, mais règlement et pays à confirmer | Non démontré | Non démontré |
| Risque litige/chargeback | À confirmer par contrat | La marketplace porte la responsabilité selon la documentation | À confirmer | À confirmer |
| Statut | À qualifier | À qualifier | À qualifier | Non conforme à l'exigence de commission tant que non étendu |

## Message standard à envoyer à chaque prestataire

**Objet : Qualification d'une marketplace africaine — encaissement diaspora et règlement direct des vendeurs**

Bonjour,

WASSAFRICA est une marketplace opérant depuis des implantations africaines, notamment au Mali et au Bénin. Nos vendeurs sont des professionnels indépendants : chacun vend ses propres produits et doit recevoir directement sa part. WASSAFRICA perçoit une commission définie sur la transaction, mais ne souhaite pas conserver le montant dû aux vendeurs sur un solde plateforme avant de le leur reverser.

Nous voulons permettre aux acheteurs de la diaspora africaine (France, Belgique, Royaume-Uni, Canada, États-Unis et autres marchés) de payer par carte internationale, et aux acheteurs locaux d'utiliser les moyens Mobile Money disponibles.

Merci de confirmer par écrit :

1. Une entreprise établie au Mali et/ou au Bénin peut-elle ouvrir et exploiter ce compte pour une marketplace ?
2. Acceptez-vous les cartes émises dans les pays diaspora ciblés ? Quelles devises, restrictions et méthodes 3-D Secure/antifraude s'appliquent ?
3. Quels opérateurs Mobile Money sont disponibles, précisément, au Mali et au Bénin pour encaissement marchand ?
4. Pouvez-vous répartir une transaction au moment de l'encaissement entre la commission WASSAFRICA et le compte de règlement du vendeur indépendant ?
5. Le montant dû au vendeur est-il réglé directement au vendeur par votre infrastructure, sans être crédité d'abord sur un solde marchand WASSAFRICA ? Merci de fournir un schéma de flux et de préciser le bénéficiaire juridique des fonds à chaque étape.
6. Les vendeurs peuvent-ils être réglés sur leur propre compte bancaire ou portefeuille Mobile Money local ? Quels pays et types de bénéficiaires sont acceptés ?
7. Quels sont les délais et cycles de règlement, réserves possibles, motifs de suspension, délais d'appel, règles de remboursement et rétrofacturation ?
8. Fournissez votre grille tarifaire complète : encaissement, split, règlement, change, remboursements, litiges, frais fixes, minimums et éventuelles réserves.
9. Quels contrôles KYB/KYC sont requis pour la plateforme et chaque vendeur ? Qui porte la responsabilité des litiges et des fonds négatifs ?
10. Pouvez-vous fournir un compte de test et un scénario de démonstration du split avec une carte diaspora et un bénéficiaire au Mali ou au Bénin ?

Nous ne souhaitons pas activer de paiements réels avant d'avoir vérifié ces points et validé vos conditions contractuelles.

Cordialement,  
Équipe WASSAFRICA

## Critère final de sélection

Un fournisseur ne passe en phase d'implémentation que si les réponses écrites démontrent :
1. admissibilité de l'entité WASSAFRICA réellement utilisée ;
2. couverture des moyens de paiement acheteurs visés ;
3. split à l'encaissement ou règlement direct équivalent, contractuellement autorisé ;
4. bénéficiaires vendeurs admissibles au Mali/Bénin ;
5. frais, réserves et litiges compris et soutenables ;
6. webhooks vérifiables, idempotence et rapprochement possible.

Aucun test de production, aucune clé secrète et aucun paiement réel avant cette validation.

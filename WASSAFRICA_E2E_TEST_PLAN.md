# WASSAFRICA — Test E2E avant production

## Règle

**UI visible ≠ fonctionnalité prouvée.** Aucun PASS fonctionnel n’est déclaré sans test réel du parcours.

## P0 — Messagerie

1. Compte A se connecte.
2. A ouvre une conversation avec B.
3. A écrit un message.
4. Le message est envoyé sans erreur.
5. B reçoit le message en temps réel.
6. B répond.
7. A reçoit la réponse.
8. Vérifier absence de doublon.

## P0 — Offline

1. A prépare un message.
2. Couper la connexion.
3. Vérifier l’état d’attente local sans persistance du texte en clair.
4. Rétablir la connexion.
5. Vérifier synchronisation vers B.
6. Vérifier qu’un même message n’est pas envoyé deux fois.

## P0 — Appel audio / vidéo

1. A et B sont connectés sur deux appareils.
2. A ouvre la conversation.
3. A lance audio.
4. B reçoit l’appel et accepte.
5. Vérifier audio bidirectionnel.
6. Répéter en vidéo.
7. Vérifier micro, caméra, mute, arrêt et retour à la conversation.

## P0 — Smart Link

1. Ouvrir un Smart Link public réel.
2. Vérifier identité et contenu de l’activité.
3. Ouvrir un produit/service réel.
4. Cliquer **Parler**.
5. Vérifier arrivée dans la conversation de la bonne activité.
6. Vérifier audio/vidéo depuis le parcours.
7. Vérifier partage/recommandation du bon lien.

## P1 — Communautés

- ouvrir une communauté ;
- rejoindre / quitter selon les droits ;
- créer une communauté avec un compte autorisé ;
- vérifier le rendu mobile ;
- vérifier qu’aucun faux compteur ou élément non prouvé n’est affiché.

## P1 — Vitrine de présentation

Ouvrir `/presentation` et vérifier :

- promesse lisible en moins de quelques secondes ;
- palette vert forêt / crème / or ;
- illustrations utiles ;
- bénéfices distincts pour personnes et activités ;
- liens vers messages, explorer, communautés et marché ;
- rendu mobile.

## Critère de sortie

Un parcours peut être déclaré **certifié** uniquement si :

- le handler réel fonctionne ;
- succès et échec sont visibles ;
- mobile/tactile/clavier sont corrects ;
- l’authentification intervient uniquement lorsqu’elle est nécessaire ;
- RLS et confidentialité sont respectées ;
- la route de production répond correctement ;
- aucune UI dupliquée ou morte ne masque le parcours ;
- le test A→B réel est enregistré.

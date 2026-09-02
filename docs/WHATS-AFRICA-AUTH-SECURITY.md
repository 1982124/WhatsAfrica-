# WhatsAfrica — Auth & Security Architecture 2026

## Authentification
- Supabase Auth comme autorité d'identité.
- Connexion email + mot de passe.
- Inscription avec confirmation email.
- Renvoi de confirmation depuis `/auth`.
- Récupération par email via `resetPasswordForEmail()` et page `/reset-password`.
- OAuth social préparé pour Google et GitHub via `signInWithOAuth()`.
- Session gérée par le client Supabase; aucun service-role secret n'est exposé dans le navigateur.

## Parcours utilisateur
1. `/auth` → Connexion ou création de compte.
2. Inscription → email de confirmation → retour `/auth?confirmed=1`.
3. Connexion avec compte non confirmé → message explicite + renvoi de confirmation.
4. Mot de passe oublié → email sécurisé → `/reset-password` → nouveau mot de passe → retour connexion.
5. OAuth → fournisseur → retour `/auth` avec session Supabase.

## Sécurité
- Clé publishable uniquement côté navigateur.
- RLS côté base pour les données applicatives.
- HSTS, X-Frame-Options, nosniff et Permissions-Policy sur Vercel.
- Les fonctions privilégiées restent séparées du client.
- Ne jamais utiliser `user_metadata` comme source d'autorisation.
- MFA/TOTP doit être réservé aux surfaces sensibles; le parcours utilisateur normal reste simple.

## Realtime / messagerie
- Supabase Realtime pour les événements temps réel.
- Accusés de réception `sent → delivered → read`.
- E2EE à certifier en A↔B avant de déclarer la messagerie pleinement certifiée.

## Appels
- WebRTC avec signalisation Supabase Realtime.
- STUN/TURN configurable.
- Opus pour l'audio; VP8/H.264 selon capacités du navigateur.
- Adaptation de débit selon statistiques WebRTC.
- Tests A↔B, NAT/TURN et reconnexion obligatoires avant certification production.

## Limites actuelles
- L'activation réelle des fournisseurs OAuth dépend de leur configuration dans Supabase Auth.
- Un serveur TURN avec identifiants de production doit encore être configuré et testé.
- La certification E2EE et les tests A↔B restent des étapes de validation, pas des suppositions.

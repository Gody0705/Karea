# KAREA Mobile — Application React Native (Expo)

Application mobile moderne de rencontres vidéo et d'appels aléatoires en direct avec thème **Bleu & Blanc** (#1A73E8).

---

## 📱 Fonctionnalités Principales

### 1. 🌍 Onglet Découverte
- Sous-onglets **« Populaire »** et **« Suivre »**.
- Grille 2 colonnes fluide avec cartes arrondies et ombres douces.
- Badge de statut dynamique (*En ligne* en vert, *Occupé* en orange, *Hors ligne* en gris).
- Bouton d'appel direct avec icône caméra bleue.
- Fiche de profil complète au clic (photos, statistiques, bio, boutons d'action).

### 2. ⚡ Onglet Appel Aléatoire
- Animation radar / pulsation concentrique 3 cercles en blanc semi-transparent.
- Filtres rapides (Genre : *Tous / Femmes / Hommes*, Région : *Monde entier / Afrique*).
- Bouton interactif **« Commencer la recherche »** avec simulation de match instantanée.
- Bascule automatique vers l'écran d'appel vidéo plein écran.

### 3. 📹 Écran d'Appel Vidéo Plein Écran
- Flux vidéo du partenaire plein écran.
- Miniature Picture-in-Picture (PIP) de sa propre caméra en haut à droite.
- Minuteur de communication en direct.
- Commandes tactiles : Mute micro, Couper caméra, Raccrocher (rouge), Envoyer un cadeau 🎁.
- Modale interactive d'envoi de cadeaux avec décompte de tokens.

### 4. 💬 Onglet Messages & Chat
- Carrousel horizontal des **« Visiteurs récents »** avec avatars cerclés et drapeaux.
- Boîte de réception avec aperçu de messages, horodatage et badges rouges non lus.
- Écran de discussion complet (bulles bleues pour vos messages, bulles blanches pour l'interlocuteur, saisie et cadeaux).

### 5. 👤 Onglet Profil Utilisateur
- En-tête avec avatar éditable, pseudo, ID utilisateur, drapeau et badge niveau.
- Statistiques en ligne (**Fans | Suivis | Amis**).
- Double portefeuille : **Tokens** (icône dorée) et **Crédits** (icône bleue).
- Bannière d'adhésion **Membre VIP 👑**.
- Grille de photos avec bouton d'ajout **« + »**.

---

## 🚀 Lancement & Installation

Dans le dossier `mobile/` :

```bash
# 1. Installation des dépendances
npm install

# 2. Démarrage du serveur Expo
npx expo start
```

- Scannez le QR code avec l'application **Expo Go** (Android / iOS).
- Appuyez sur `a` pour lancer sur émulateur Android.
- Appuyez sur `i` pour lancer sur simulateur iOS.
- Appuyez sur `w` pour tester dans le navigateur web.

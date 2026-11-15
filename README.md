# Organisation

Application personnelle de gestion des tâches (PWA), pour PC Windows et Galaxy S25 Ultra.

Version actuelle : **1.0.0** (V1A mise en service).

Adresse publiée : **https://TON-PSEUDO.github.io/organisation/**
(remplacer TON-PSEUDO par ton nom d'utilisateur GitHub).

## Confidentialité : ce qui ne va JAMAIS sur GitHub

Le dépôt est **public** : tout le monde peut lire le code (D-030).

- Les tâches ne sont jamais dans le code : elles restent dans le téléphone (ou le navigateur du PC).
- Les vraies catégories sont dans `depart-vierge.json`, rangé **en dehors** du dossier `organisation-perso`.
- Le fichier `.gitignore` bloque `depart-vierge.json` et les sauvegardes `organisation-*.json`
  au cas où l'un d'eux serait copié par erreur dans le dossier.
- Avant chaque `git push`, `git status` ne doit montrer aucun fichier `.json` autre que `manifest.json`.

## Installer l'application sur le Galaxy S25 Ultra

1. Ouvrir **Chrome** sur le téléphone et aller à l'adresse publiée.
2. Menu **⋮** → **Ajouter à l'écran d'accueil** → **Installer**.
3. L'icône Organisation apparaît sur l'écran d'accueil. Appui long sur l'icône : raccourci « Nouvelle tâche ».

## Départ propre (après la recette)

1. Réglages → **Importer** → choisir `depart-vierge.json` → confirmer.
2. Résultat : 0 tâche, et tes vraies catégories dans les Réglages.

## Mettre en ligne une nouvelle version

1. Augmenter `VERSION` en haut de `sw.js` **et** de `js/app.js` (exemple : 1.0.0 → 1.0.1).
2. `git add .` puis `git commit -m "1.0.1 : description"` puis `git push`.
3. Attendre 1 à 2 minutes, puis ouvrir l'application sur le téléphone avec réseau.
   Les Réglages doivent afficher le nouveau numéro (sinon, fermer et rouvrir l'application).

## Sauvegarder et restaurer les données

En V1A, les tâches ne sont que sur un appareil : la sauvegarde est la seule protection.

- **Exporter** (Réglages → Sauvegarde) : télécharge `organisation-AAAA-MM-JJ.json` dans Téléchargements.
  Copier ce fichier sur Google Drive ou une clé USB. Un rappel s'affiche après 30 jours sans export.
- **Importer** : choisir un fichier exporté ; après confirmation, il REMPLACE toutes les tâches
  de l'appareil. Exporter d'abord les données actuelles si l'on veut pouvoir revenir en arrière.

## Vérifier les calculs

Serveur lancé, ouvrir **http://localhost:3000/tests/tests-calculs.html**.
Le résumé en haut doit être vert : « N tests réussis sur N ».

## Lancer l'application sur le PC

1. Ouvrir le dossier `organisation-perso` dans Cursor.
2. Ouvrir un terminal : menu **Terminal → Nouveau terminal**.
3. Taper la commande suivante, puis Entrée :

   ```
   npx serve@14 .
   ```

4. Ouvrir le navigateur à l'adresse **http://localhost:3000**.
5. Pour arrêter : cliquer dans le terminal et appuyer sur **Ctrl + C**.

## Installer l'application sur le PC

1. Lancer le serveur (voir ci-dessus) et ouvrir **http://localhost:3000** dans Chrome ou Edge.
2. Cliquer sur l'icône d'installation à droite de la barre d'adresse (un écran avec une flèche).
3. Cliquer **Installer**. L'application s'ouvre dans sa propre fenêtre.

## Tester le fonctionnement hors ligne

1. Ouvrir l'application une fois avec le serveur lancé : la page doit afficher « Hors ligne : prêt ».
2. Arrêter le serveur (Ctrl + C dans le terminal).
3. Actualiser la page (F5) : elle doit toujours s'afficher.

## Effacer les tâches de test

Les tâches sont gardées dans le navigateur. Pour repartir de zéro sur le PC :
F12 → onglet **Application** → **Storage** → **Clear site data**, puis Ctrl + Maj + R.
Attention : cela efface toutes les tâches de ce navigateur.

## Enregistrer une version (Git)

Après chaque modification validée :

```
git status
git add .
git commit -m "1.0.1 : description courte"
git push
```

Marquer une version mise en service : `git tag v1.0.0` puis `git push origin v1.0.0`.

Pour voir l'historique : `git log --oneline`

## Organisation des dossiers

| Dossier ou fichier | Rôle |
| --- | --- |
| `index.html` | La page unique de l'application |
| `manifest.json` | La carte d'identité de l'application : nom, icônes, couleurs |
| `sw.js` | Le service worker : garde une copie pour ouvrir l'application hors ligne |
| `css/` | L'apparence |
| `js/app.js` | Le démarrage, la navigation entre écrans, la touche N |
| `js/donnees.js` | Le seul fichier qui lit et écrit les tâches (base IndexedDB) |
| `js/capture.js` | La fenêtre « Nouvelle tâche » |
| `js/calculs.js` | Les règles de calcul (intérêt, dates) ; n'affiche rien |
| `js/bandeau.js` | Le message en bas de l'écran avec « Annuler » |
| `js/ecrans/` | Un fichier par écran : `aujourdhui.js`, `inbox.js`, `taches.js`, `fiche.js`, `reglages.js` |
| `icones/` | Les icônes de l'application |
| `tests/tests-calculs.html` | La page de vérification des calculs |
| `.gitignore` | Les fichiers que Git ne doit jamais envoyer (données personnelles) |
| `DECISIONS.md` | L'historique des choix de conception |

## Documentation

Le cahier des charges, les maquettes et la roadmap sont dans le document « Système d'organisation personnelle ».

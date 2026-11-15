/*
  sw.js : le « service worker ».
  C'est un petit programme que le navigateur garde de côté, même quand
  l'application est fermée. Il garde une copie des fichiers de l'application
  pour pouvoir l'ouvrir SANS réseau.

  Stratégie choisie (voir DECISIONS.md, D-012) : « le réseau d'abord ».
  - Avec réseau : on prend la version la plus récente et on met la copie à jour.
  - Sans réseau, ou si le réseau met plus de 3 secondes : on utilise la copie.

  À CHAQUE NOUVELLE ÉTAPE : augmenter le numéro de VERSION ci-dessous.
  Cela fait le ménage dans les anciennes copies.
*/

const VERSION = '1.0.0';
const NOM_DU_CACHE = 'organisation-' + VERSION;
const DELAI_MAXIMUM = 3000; // en millisecondes, soit 3 secondes

// La liste des fichiers nécessaires pour ouvrir l'application hors ligne.
const FICHIERS_DE_L_APPLICATION = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/donnees.js',
  './js/capture.js',
  './js/calculs.js',
  './js/bandeau.js',
  './js/ecrans/inbox.js',
  './js/ecrans/aujourdhui.js',
  './js/ecrans/taches.js',
  './js/ecrans/fiche.js',
  './js/ecrans/reglages.js',
  './manifest.json',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-masquable-512.png'
];

// 1. Installation : on range une copie de chaque fichier.
self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(NOM_DU_CACHE)
      .then((cache) => cache.addAll(FICHIERS_DE_L_APPLICATION))
      .then(() => self.skipWaiting())
  );
});

// 2. Activation : on supprime les copies des anciennes versions.
self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(
        noms
          .filter((nom) => nom.startsWith('organisation-') && nom !== NOM_DU_CACHE)
          .map((nom) => caches.delete(nom))
      ))
      .then(() => self.clients.claim())
  );
});

// 3. Chaque fois que la page demande un fichier.
self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  // On ne s'occupe que des lectures de nos propres fichiers.
  if (requete.method !== 'GET') return;
  if (new URL(requete.url).origin !== self.location.origin) return;
  evenement.respondWith(reseauDabord(requete));
});

async function reseauDabord(requete) {
  const cache = await caches.open(NOM_DU_CACHE);

  // On lance la demande au réseau ; si elle réussit, on met la copie à jour.
  const reponseReseau = fetch(requete).then((reponse) => {
    if (reponse.ok) cache.put(requete, reponse.clone());
    return reponse;
  });
  // Évite un message d'erreur inutile si le réseau échoue après coup.
  reponseReseau.catch(() => {});

  try {
    // On attend le réseau, mais pas plus de DELAI_MAXIMUM.
    return await Promise.race([reponseReseau, attendre(DELAI_MAXIMUM)]);
  } catch (erreur) {
    // Pas de réseau, ou trop lent : on cherche la copie.
    const copie = await cache.match(requete, { ignoreSearch: true });
    if (copie) return copie;
    if (requete.mode === 'navigate') {
      const accueil = await cache.match('./index.html');
      if (accueil) return accueil;
    }
    // Aucune copie : on attend quand même le réseau.
    return reponseReseau;
  }
}

// Une promesse qui échoue après un certain délai.
function attendre(millisecondes) {
  return new Promise((_, echec) => setTimeout(() => echec(new Error('délai dépassé')), millisecondes));
}

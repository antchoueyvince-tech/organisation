/*
  app.js : le démarrage de l'application.
  - Étape 2 : active le service worker (installation et hors ligne).
  - Étape 3 : navigation entre les écrans, bouton +, touche N,
    raccourci Android « Nouvelle tâche », compteur de l'Inbox.
  - Étape 4 : l'Inbox prévient app.js quand une capture est qualifiée,
    pour mettre à jour le compteur.
  - Étape 5 : écran Aujourd'hui ; l'écran se redessine quand on revient
    dans l'application (par exemple le lendemain matin sur le téléphone).
  - Étape 6 : écran Toutes les tâches.
  - Étape 7 : fiche tâche, à l'adresse #fiche/<identifiant> ; retour à l'écran précédent.
  - Étape 8 : écran Réglages ; les catégories sont chargées au démarrage.
  - Étape 9 : version 1.0.0, mise en service de la V1A.
*/

import { ETATS, listerParEtat, demanderStockagePersistant, chargerCategories } from './donnees.js';
import { initialiserCapture, ouvrirCapture, captureEstOuverte } from './capture.js';
import { afficherInbox } from './ecrans/inbox.js';
import { afficherAujourdhui } from './ecrans/aujourdhui.js';
import { afficherTaches } from './ecrans/taches.js';
import { afficherFiche } from './ecrans/fiche.js';
import { afficherReglages, configurerReglages } from './ecrans/reglages.js';

const VERSION = '1.0.0';
let etatHorsLigne = 'en préparation…';
let dernierEcran = 'aujourdhui';   // le dernier écran de liste visité (pour revenir d'une fiche)
let ficheOuverteDansLApp = false;  // la fiche a-t-elle été ouverte depuis un autre écran ?

// La liste des écrans.
const ECRANS = {
  aujourdhui: {
    titre: 'Aujourd\'hui',
    afficher: (conteneur) => afficherAujourdhui(conteneur, { surChangement: mettreAJourCompteurInbox })
  },
  inbox: {
    titre: 'Inbox',
    afficher: (conteneur) => afficherInbox(conteneur, { surChangement: mettreAJourCompteurInbox })
  },
  taches: {
    titre: 'Toutes les tâches',
    afficher: afficherTaches
  },
  reglages: {
    titre: 'Réglages',
    afficher: afficherReglages
  },
  fiche: {
    titre: 'Fiche tâche',
    afficher: (conteneur, identifiant) => afficherFiche(conteneur, identifiant, {
      surRetour: revenirDeLaFiche,
      surChangement: mettreAJourCompteurInbox
    })
  }
};

// ---------- Navigation ----------

// L'écran affiché dépend de la fin de l'adresse : #inbox, #taches, #fiche/<id>...
// Cela permet au bouton Retour d'Android de revenir à l'écran précédent.
function ecranDemande() {
  const [nom, parametre] = location.hash.slice(1).split('/');
  if (nom === 'fiche' && parametre) return { nom: 'fiche', parametre: decodeURIComponent(parametre) };
  return { nom: ECRANS[nom] && nom !== 'fiche' ? nom : 'aujourdhui' };
}

async function afficherEcran() {
  const { nom, parametre } = ecranDemande();
  const ecran = ECRANS[nom];
  if (nom !== 'fiche') dernierEcran = nom;
  document.getElementById('titre-ecran').textContent = ecran.titre;
  document.title = ecran.titre + ' · Organisation';
  // Sur une fiche, la navigation garde en surbrillance l'écran d'où l'on vient.
  const ecranActif = nom === 'fiche' ? dernierEcran : nom;
  for (const lien of document.querySelectorAll('[data-ecran]')) {
    if (lien.dataset.ecran === ecranActif) lien.setAttribute('aria-current', 'page');
    else lien.removeAttribute('aria-current');
  }
  const conteneur = document.getElementById('ecran');
  // Indique quel écran occupe la zone (utile aux écrans qui écoutent le clavier).
  conteneur.dataset.ecran = nom;
  window.scrollTo(0, 0);
  await ecran.afficher(conteneur, parametre);
}

// Quitter la fiche : comme le bouton Retour si on vient d'un autre écran,
// sinon (fiche ouverte directement par son adresse) vers le dernier écran connu.
function revenirDeLaFiche() {
  if (ficheOuverteDansLApp) history.back();
  else location.hash = '#' + dernierEcran;
}

function surChangementDAdresse() {
  ficheOuverteDansLApp = ecranDemande().nom === 'fiche';
  afficherEcran();
}

async function mettreAJourCompteurInbox() {
  const nombre = (await listerParEtat(ETATS.INBOX)).length;
  document.getElementById('compteur-inbox').textContent = nombre ? `(${nombre})` : '';
}

async function rafraichir() {
  await Promise.all([afficherEcran(), mettreAJourCompteurInbox()]);
}

// ---------- Écrans provisoires ----------

function creer(balise, classe, texte) {
  const element = document.createElement(balise);
  element.className = classe;
  element.textContent = texte;
  return element;
}

// ---------- Clavier ----------

// Touche N : nouvelle tâche (sauf si l'on est déjà en train d'écrire).
function surTouche(evenement) {
  if (evenement.ctrlKey || evenement.altKey || evenement.metaKey) return;
  const cible = evenement.target;
  const enTrainDEcrire = cible.closest && cible.closest('input, textarea, select, [contenteditable="true"]');
  // Rien si l'on écrit, ou si une fenêtre (capture, planification) est déjà ouverte.
  if (enTrainDEcrire || captureEstOuverte() || document.querySelector('dialog[open]')) return;
  if (evenement.key === 'n' || evenement.key === 'N') {
    evenement.preventDefault();
    ouvrirCapture();
  }
}

// ---------- Service worker (étape 2) ----------

function activerHorsLigne() {
  if (!('serviceWorker' in navigator)) {
    etatHorsLigne = 'non pris en charge par ce navigateur';
    return;
  }
  navigator.serviceWorker.register('./sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => { etatHorsLigne = 'prêt'; })
    .catch((erreur) => {
      etatHorsLigne = 'indisponible';
      console.error('Le service worker n\'a pas pu être enregistré :', erreur);
    });
}

// ---------- Démarrage ----------

async function demarrer() {
  activerHorsLigne();
  // Étape 8 : les catégories (modifiables dans les Réglages) sont lues avant le premier écran.
  await chargerCategories();
  configurerReglages({
    version: VERSION,
    etatHorsLigne: () => etatHorsLigne,
    surChangement: mettreAJourCompteurInbox
  });
  initialiserCapture({ surAjout: rafraichir });

  document.getElementById('bouton-nouvelle').addEventListener('click', ouvrirCapture);
  document.getElementById('bouton-nouvelle-pc').addEventListener('click', ouvrirCapture);
  document.addEventListener('keydown', surTouche);
  window.addEventListener('hashchange', surChangementDAdresse);
  // Retour dans l'application (autre onglet, téléphone sorti de veille) :
  // on redessine, pour que « aujourd'hui » soit bien la date du jour.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') rafraichir();
  });

  await rafraichir();
  demanderStockagePersistant();

  // Raccourci « Nouvelle tâche » (appui long sur l'icône Android) :
  // l'application s'ouvre avec ?action=nouvelle dans l'adresse.
  const parametres = new URLSearchParams(location.search);
  if (parametres.get('action') === 'nouvelle') {
    history.replaceState(null, '', location.pathname + location.hash);
    ouvrirCapture();
  }
}

demarrer().catch((erreur) => {
  console.error('Erreur au démarrage :', erreur);
  document.getElementById('ecran').replaceChildren(
    creer('p', 'vide', 'Erreur au démarrage. Ouvre la console (F12) et envoie le message rouge.')
  );
});

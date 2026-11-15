/*
  donnees.js : le SEUL fichier qui lit et écrit les données (voir DECISIONS.md, D-003).
  Les tâches sont rangées dans le navigateur, dans une base appelée IndexedDB.
  Elles restent sur l'appareil, même sans réseau et après redémarrage.

  Étape 8 : la base passe en version 2. Une table « reglages » est AJOUTÉE
  (catégories modifiables, date de la dernière sauvegarde). La table des tâches
  n'est pas touchée (D-027). Export et import complets des données (D-028).

  En V1B, c'est ce fichier qui sera adapté pour Firebase.
  Les écrans, eux, n'auront pas à changer.
*/

const NOM_DE_LA_BASE = 'organisation';
const VERSION_DE_LA_BASE = 2;
const TABLE_DES_TACHES = 'taches';
const TABLE_DES_REGLAGES = 'reglages';

// Les états possibles d'une tâche (voir DECISIONS.md, D-005 et D-014).
export const ETATS = {
  INBOX: 'inbox',
  A_PLANIFIER: 'a_planifier',
  PLANIFIEE: 'planifiee',
  EN_COURS: 'en_cours',
  FAITE: 'faite',
  ABANDONNEE: 'abandonnee'
};

// Les catégories de départ : une liste NEUTRE, volontairement générique (D-030).
// Les vraies catégories personnelles ne sont jamais écrites dans le code : elles sont
// créées dans les Réglages (ou importées) et restent uniquement sur l'appareil.
// Cette liste ne sert que tant qu'aucune catégorie n'a été enregistrée.
export const CATEGORIES_PAR_DEFAUT = Object.freeze([
  'Administratif',
  'Courses',
  'Famille',
  'Finances',
  'Logement',
  'Loisirs',
  'Santé',
  'Transport',
  'Travail'
]);

let baseOuverte = null;

// Ouvre la base (et la crée, ou la met à niveau, si besoin).
export function ouvrirBase() {
  if (baseOuverte) return baseOuverte;
  baseOuverte = new Promise((reussite, echec) => {
    const demande = indexedDB.open(NOM_DE_LA_BASE, VERSION_DE_LA_BASE);
    demande.onupgradeneeded = () => {
      const base = demande.result;
      // Version 1 : la table des tâches.
      if (!base.objectStoreNames.contains(TABLE_DES_TACHES)) {
        base.createObjectStore(TABLE_DES_TACHES, { keyPath: 'id' });
      }
      // Version 2 (étape 8) : la table des réglages, ajoutée sans toucher aux tâches.
      if (!base.objectStoreNames.contains(TABLE_DES_REGLAGES)) {
        base.createObjectStore(TABLE_DES_REGLAGES, { keyPath: 'cle' });
      }
    };
    demande.onblocked = () => {
      console.warn('Mise à niveau de la base en attente : ferme les autres fenêtres de l\'application.');
    };
    demande.onsuccess = () => {
      const base = demande.result;
      // Si une version plus récente de l'application doit mettre la base à niveau,
      // cette fenêtre la libère au lieu de la bloquer.
      base.onversionchange = () => {
        base.close();
        baseOuverte = null;
      };
      reussite(base);
    };
    demande.onerror = () => {
      baseOuverte = null;
      echec(demande.error);
    };
  });
  return baseOuverte;
}

// Outil interne : exécute une opération sur une table (les tâches par défaut).
async function executer(mode, operation, nomTable = TABLE_DES_TACHES) {
  const base = await ouvrirBase();
  return new Promise((reussite, echec) => {
    const transaction = base.transaction(nomTable, mode);
    const demande = operation(transaction.objectStore(nomTable));
    transaction.oncomplete = () => reussite(demande.result);
    transaction.onerror = () => echec(transaction.error);
    transaction.onabort = () => echec(transaction.error);
  });
}

// Crée un identifiant unique pour une tâche, au format standard « UUID »
// (par exemple 3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90). Voir DECISIONS.md, D-017.
// crypto.randomUUID n'existe que sur une adresse dite « sécurisée »
// (https://... ou http://localhost). Sur une autre adresse, par exemple
// http://192.168.x.x ou l'aperçu intégré d'un éditeur, il est absent :
// on fabrique alors le même format avec crypto.getRandomValues,
// qui est disponible partout.
function creerIdentifiant() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const octets = crypto.getRandomValues(new Uint8Array(16));
    octets[6] = (octets[6] & 0x0f) | 0x40; // marque « version 4 » (aléatoire)
    octets[8] = (octets[8] & 0x3f) | 0x80; // marque « variante standard »
    const hex = Array.from(octets, (octet) => octet.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Dernier recours, pour un navigateur très ancien.
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

// Fabrique une tâche neuve, avec tous les champs du modèle de données.
// Seul le titre est rempli à la capture ; le reste viendra aux étapes suivantes.
function nouvelleTache(titre) {
  const maintenant = new Date().toISOString();
  return {
    id: creerIdentifiant(),
    titre: titre,
    description: '',
    categorie: null,
    faisabilite: null,
    impact: null,
    etat: ETATS.INBOX,
    debut: null,
    fin: null,
    lieu: '',
    resultat: null,
    feedback: '',
    suite: '',
    bonnePratique: '',
    nbReports: 0,
    creeLe: maintenant,
    modifieLe: maintenant,
    termineLe: null
  };
}

// ---------- Tâches ----------

// Enregistre une nouvelle tâche dans l'Inbox et la renvoie.
export async function ajouterTache(titre) {
  const tache = nouvelleTache(titre.trim().slice(0, 200));
  await executer('readwrite', (table) => table.add(tache));
  return tache;
}

// Renvoie une seule tâche à partir de son identifiant (ou undefined si elle n'existe pas).
export function lireTache(id) {
  return executer('readonly', (table) => table.get(id));
}

// Renvoie toutes les tâches.
export function listerTaches() {
  return executer('readonly', (table) => table.getAll());
}

// Modifie certains champs d'une tâche (par exemple { impact: 4 }) et renvoie
// la tâche à jour, ou null si elle n'existe plus. La date de modification suit.
export async function mettreAJourTache(id, changements) {
  const base = await ouvrirBase();
  return new Promise((reussite, echec) => {
    const transaction = base.transaction(TABLE_DES_TACHES, 'readwrite');
    const table = transaction.objectStore(TABLE_DES_TACHES);
    let tacheAJour = null;
    const lecture = table.get(id);
    lecture.onsuccess = () => {
      if (!lecture.result) return;
      tacheAJour = { ...lecture.result, ...changements, id, modifieLe: new Date().toISOString() };
      table.put(tacheAJour);
    };
    transaction.oncomplete = () => reussite(tacheAJour);
    transaction.onerror = () => echec(transaction.error);
    transaction.onabort = () => echec(transaction.error);
  });
}

// Supprime définitivement une tâche.
export function supprimerTache(id) {
  return executer('readwrite', (table) => table.delete(id));
}

// Remet une tâche exactement comme elle était (sert au bouton « Annuler »).
export function remettreTache(tache) {
  return executer('readwrite', (table) => table.put(tache));
}

// Renvoie les tâches d'un état donné (par exemple ETATS.INBOX).
export async function listerParEtat(etat) {
  const taches = await listerTaches();
  return taches.filter((tache) => tache.etat === etat);
}

// ---------- Réglages (étape 8) ----------
// Chaque réglage est une ligne { cle, valeur } de la table « reglages ».

export async function lireReglage(cle) {
  const ligne = await executer('readonly', (table) => table.get(cle), TABLE_DES_REGLAGES);
  return ligne ? ligne.valeur : null;
}

export function ecrireReglage(cle, valeur) {
  return executer('readwrite', (table) => table.put({ cle, valeur }), TABLE_DES_REGLAGES);
}

// ---------- Catégories (étape 8) ----------
// Les catégories sont gardées en mémoire pour être lues instantanément par les écrans.
// Chaque catégorie : { nom, masquee }. Une catégorie masquée n'est plus proposée,
// mais les tâches qui l'utilisent la gardent (D-027).

let categoriesEnMemoire = CATEGORIES_PAR_DEFAUT.map((nom) => ({ nom, masquee: false }));

// À appeler une fois au démarrage.
export async function chargerCategories() {
  const enregistrees = await lireReglage('categories');
  if (Array.isArray(enregistrees) && enregistrees.length > 0) categoriesEnMemoire = enregistrees;
  return toutesLesCategories();
}

// Les noms des catégories proposées dans les choix (non masquées), dans l'ordre choisi.
export function categoriesVisibles() {
  return categoriesEnMemoire.filter((categorie) => !categorie.masquee).map((categorie) => categorie.nom);
}

// Toutes les catégories, masquées comprises (copie).
export function toutesLesCategories() {
  return categoriesEnMemoire.map((categorie) => ({ ...categorie }));
}

// Enregistre la liste complète (ordre, masquage, ajout).
export async function enregistrerCategories(liste) {
  const propre = liste.map((categorie) => ({ nom: categorie.nom, masquee: Boolean(categorie.masquee) }));
  await ecrireReglage('categories', propre);
  categoriesEnMemoire = propre;
}

// Renomme une catégorie ET toutes les tâches qui l'utilisent, en une seule fois
// (soit tout est fait, soit rien). Renvoie le nombre de tâches mises à jour.
// La date de modification des tâches ne change pas : ce n'est pas une modification de la tâche.
export async function renommerCategorie(ancien, nouveau) {
  const base = await ouvrirBase();
  const nouvelleListe = categoriesEnMemoire.map((categorie) =>
    categorie.nom === ancien ? { ...categorie, nom: nouveau } : { ...categorie });
  return new Promise((reussite, echec) => {
    const transaction = base.transaction([TABLE_DES_TACHES, TABLE_DES_REGLAGES], 'readwrite');
    const taches = transaction.objectStore(TABLE_DES_TACHES);
    let nombre = 0;
    const lecture = taches.getAll();
    lecture.onsuccess = () => {
      for (const tache of lecture.result) {
        if (tache.categorie === ancien) {
          taches.put({ ...tache, categorie: nouveau });
          nombre++;
        }
      }
    };
    transaction.objectStore(TABLE_DES_REGLAGES).put({ cle: 'categories', valeur: nouvelleListe });
    transaction.oncomplete = () => {
      categoriesEnMemoire = nouvelleListe;
      reussite(nombre);
    };
    transaction.onerror = () => echec(transaction.error);
    transaction.onabort = () => echec(transaction.error);
  });
}

// ---------- Sauvegarde : export et import (étape 8, D-028) ----------

// Toutes les données, prêtes à être écrites dans un fichier.
export async function exporterDonnees(versionApplication) {
  return {
    application: 'organisation',
    format: 1,
    versionApplication,
    exporteLe: new Date().toISOString(),
    taches: await listerTaches(),
    categories: toutesLesCategories()
  };
}

// Remplace TOUTES les tâches par celles d'une sauvegarde (déjà vérifiée),
// en une seule fois : soit tout est remplacé, soit rien.
// Les catégories du fichier remplacent les actuelles s'il en contient.
export async function remplacerToutesLesDonnees({ taches, categories, exporteLe }) {
  const base = await ouvrirBase();
  // Chaque tâche reçoit les champs éventuellement absents du fichier, avec leur valeur par défaut.
  const completes = taches.map((tache) => ({ ...nouvelleTache(''), ...tache }));
  const nouvellesCategories = categories || toutesLesCategories();
  return new Promise((reussite, echec) => {
    const transaction = base.transaction([TABLE_DES_TACHES, TABLE_DES_REGLAGES], 'readwrite');
    const tableTaches = transaction.objectStore(TABLE_DES_TACHES);
    tableTaches.clear();
    for (const tache of completes) tableTaches.put(tache);
    const tableReglages = transaction.objectStore(TABLE_DES_REGLAGES);
    tableReglages.put({ cle: 'categories', valeur: nouvellesCategories });
    // Les données actuelles sont exactement celles du fichier : elles sont donc sauvegardées.
    tableReglages.put({ cle: 'derniereSauvegarde', valeur: exporteLe || new Date().toISOString() });
    transaction.oncomplete = () => {
      categoriesEnMemoire = nouvellesCategories;
      reussite(completes.length);
    };
    transaction.onerror = () => echec(transaction.error);
    transaction.onabort = () => echec(transaction.error);
  });
}

// ---------- Stockage persistant ----------

// Demande au navigateur de ne jamais effacer les données de lui-même.
// Renvoie true si c'est accordé.
export async function demanderStockagePersistant() {
  if (!navigator.storage || !navigator.storage.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

// Indique si le stockage est déjà persistant.
export async function stockageEstPersistant() {
  if (!navigator.storage || !navigator.storage.persisted) return false;
  return navigator.storage.persisted();
}

/*
  calculs.js : les règles de calcul de l'application.
  Ce fichier n'affiche rien et ne lit aucune donnée : il reçoit des valeurs
  et renvoie un résultat. C'est ce qui permet de le vérifier facilement
  avec la page tests/tests-calculs.html.

  Étape 4 : intérêt, catégories récentes, dates de planification.
  Étape 5 : retard, tâches du jour, « Ensuite », Fait et Demain.
  Étape 6 : recherche, filtres et tri de « Toutes les tâches ».
  Étape 7 : règles de la fiche tâche (dates, état, clôture).
  Étape 8 : catégories, vérification d'une sauvegarde, rappel de sauvegarde.
*/

import { ETATS } from './donnees.js';

export const NOTE_MINIMUM = 1;
export const NOTE_MAXIMUM = 5;

// Une note valide est un nombre entier de 1 à 5.
export function estUneNote(valeur) {
  return Number.isInteger(valeur) && valeur >= NOTE_MINIMUM && valeur <= NOTE_MAXIMUM;
}

// Intérêt = Impact × Faisabilité (de 1 à 25). Voir DECISIONS.md, D-006.
// S'il manque une des deux notes, l'intérêt vaut 0 : la tâche se range en bas.
export function interet(tache) {
  if (!tache) return 0;
  const { faisabilite, impact } = tache;
  if (!estUneNote(faisabilite) || !estUneNote(impact)) return 0;
  return impact * faisabilite;
}

// Les catégories utilisées le plus récemment, complétées par l'ordre de la liste.
// « taches » : toutes les tâches ; « categories » : la liste complète.
export function categoriesRecentes(taches, categories, nombre = 3) {
  const utilisees = taches
    .filter((tache) => tache.categorie && categories.includes(tache.categorie))
    .sort((a, b) => b.modifieLe.localeCompare(a.modifieLe))
    .map((tache) => tache.categorie);
  const resultat = [];
  for (const categorie of [...utilisees, ...categories]) {
    if (!resultat.includes(categorie)) resultat.push(categorie);
    if (resultat.length === nombre) break;
  }
  return resultat;
}

// ---------- Dates ----------
// Les dates sont gardées en texte, à l'heure locale : « 2026-11-16 »
// ou « 2026-11-16T14:30 » avec une heure. Voir DECISIONS.md, D-019.

// Date du calendrier → texte « AAAA-MM-JJ ».
export function dateEnTexte(date) {
  const annee = date.getFullYear();
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const jour = String(date.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

// Texte « AAAA-MM-JJ » (éventuellement suivi d'une heure) → date du calendrier, à minuit.
export function dateDepuisTexte(texte) {
  const morceaux = /^(\d{4})-(\d{2})-(\d{2})/.exec(texte || '');
  if (!morceaux) return null;
  return new Date(Number(morceaux[1]), Number(morceaux[2]) - 1, Number(morceaux[3]));
}

// Les boutons rapides de la fenêtre « Planifier » : 'aujourdhui' ou 'demain' (D-021).
// « aujourdhui » peut être fourni pour les tests ; sinon c'est la date du jour.
export function dateRapide(choix, aujourdhui = new Date()) {
  const date = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate());
  if (choix === 'demain') {
    date.setDate(date.getDate() + 1);
  } else if (choix !== 'aujourdhui') {
    return null;
  }
  return dateEnTexte(date);
}

// Assemble la date et l'heure facultative en une seule valeur pour le champ « debut ».
// Renvoie null si la date n'est pas valide.
export function debutPlanifie(date, heure) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  if (/^\d{2}:\d{2}$/.test(heure || '')) return `${date}T${heure}`;
  return date;
}

// ---------- Écran Aujourd'hui (étape 5) ----------
// « aujourdhui » est toujours un texte « AAAA-MM-JJ » (dateEnTexte(new Date())).
// Les dates d'une même forme se comparent comme des mots : '2026-11-14' < '2026-11-15'.

// Une tâche « active » est planifiée ou en cours : ni dans l'Inbox, ni terminée.
export function estActive(tache) {
  return tache.etat === ETATS.PLANIFIEE || tache.etat === ETATS.EN_COURS;
}

// Le jour où la tâche est prévue (le début, sinon la fin), sans l'heure.
export function jourPrevu(tache) {
  const date = tache.debut || tache.fin;
  return date ? date.slice(0, 10) : null;
}

// L'heure prévue (« 14:30 ») si le début en comporte une, sinon null.
export function heurePrevue(tache) {
  return tache.debut && tache.debut.includes('T') ? tache.debut.slice(11, 16) : null;
}

// En retard : tâche active dont la date limite est passée (D-022).
// La date limite est la fin si elle existe, sinon le début.
export function estEnRetard(tache, aujourdhui) {
  if (!estActive(tache)) return false;
  const limite = (tache.fin || tache.debut || '').slice(0, 10);
  return limite !== '' && limite < aujourdhui;
}

// Prévue aujourd'hui : tâche active, pas en retard, dont le jour prévu est aujourd'hui.
export function estPrevueAujourdhui(tache, aujourdhui) {
  return estActive(tache) && !estEnRetard(tache, aujourdhui) && jourPrevu(tache) === aujourdhui;
}

// Ordre du bloc « Aujourd'hui » : d'abord celles avec une heure, dans l'ordre des heures ;
// puis celles sans heure, par intérêt décroissant ; à égalité, la plus ancienne d'abord.
export function trierJournee(taches) {
  return [...taches].sort((a, b) => {
    const ha = heurePrevue(a);
    const hb = heurePrevue(b);
    if (ha && hb) return ha.localeCompare(hb);
    if (ha) return -1;
    if (hb) return 1;
    return interet(b) - interet(a) || a.creeLe.localeCompare(b.creeLe);
  });
}

// Ordre du bloc « En retard » : la plus en retard d'abord.
export function trierRetard(taches) {
  return [...taches].sort((a, b) =>
    (a.fin || a.debut).localeCompare(b.fin || b.debut) || interet(b) - interet(a));
}

// Bloc « Ensuite » : les « À planifier » au plus fort intérêt ;
// à intérêt égal, la plus ancienne d'abord.
export function meilleuresAPlanifier(taches, nombre = 3) {
  return taches
    .filter((tache) => tache.etat === ETATS.A_PLANIFIER)
    .sort((a, b) => interet(b) - interet(a) || a.creeLe.localeCompare(b.creeLe))
    .slice(0, nombre);
}

// Bouton « Fait » : la tâche est terminée maintenant.
export function changementsFait(maintenantIso) {
  return { etat: ETATS.FAITE, termineLe: maintenantIso };
}

// Bouton « Demain » : la tâche passe au lendemain d'AUJOURD'HUI (même si elle avait
// plusieurs jours de retard), l'heure est conservée, et on compte un report (D-023).
// Une fin déjà dépassée passe aussi au lendemain, pour que la tâche ne reste pas en retard.
export function changementsDemain(tache, aujourdhuiDate = new Date()) {
  const demain = dateRapide('demain', aujourdhuiDate);
  const changements = {
    etat: ETATS.PLANIFIEE,
    debut: debutPlanifie(demain, heurePrevue(tache)),
    nbReports: (tache.nbReports || 0) + 1
  };
  if (tache.fin && tache.fin.slice(0, 10) < demain) {
    const heureFin = tache.fin.includes('T') ? tache.fin.slice(11, 16) : '';
    changements.fin = debutPlanifie(demain, heureFin);
  }
  return changements;
}

// Bouton « + » du bloc Ensuite : planifiée aujourd'hui, sans heure.
export function changementsAujourdhui(aujourdhuiDate = new Date()) {
  return { etat: ETATS.PLANIFIEE, debut: dateRapide('aujourdhui', aujourdhuiDate) };
}

// « aujourd'hui », « hier », « demain » ou « le 12 nov. »
export function libelleJour(texte, aujourdhui) {
  const jour = dateDepuisTexte(texte);
  const reference = dateDepuisTexte(aujourdhui);
  if (!jour || !reference) return '';
  const ecart = Math.round((jour - reference) / 86400000);
  if (ecart === 0) return 'aujourd\'hui';
  if (ecart === -1) return 'hier';
  if (ecart === 1) return 'demain';
  return 'le ' + jour.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ---------- Écran Toutes les tâches (étape 6) ----------

// Les noms des états, tels qu'affichés.
export const LIBELLES_ETATS = {
  [ETATS.INBOX]: 'Inbox',
  [ETATS.A_PLANIFIER]: 'À planifier',
  [ETATS.PLANIFIEE]: 'Planifiée',
  [ETATS.EN_COURS]: 'En cours',
  [ETATS.FAITE]: 'Faite',
  [ETATS.ABANDONNEE]: 'Abandonnée'
};

// Les choix du filtre « État » et les états qu'ils retiennent (null = tous).
export const FILTRES_ETAT = {
  non_terminees: { libelle: 'Non terminées', etats: [ETATS.INBOX, ETATS.A_PLANIFIER, ETATS.PLANIFIEE, ETATS.EN_COURS] },
  inbox: { libelle: 'Inbox', etats: [ETATS.INBOX] },
  a_planifier: { libelle: 'À planifier', etats: [ETATS.A_PLANIFIER] },
  planifiees: { libelle: 'Planifiées', etats: [ETATS.PLANIFIEE, ETATS.EN_COURS] },
  terminees: { libelle: 'Terminées', etats: [ETATS.FAITE, ETATS.ABANDONNEE] },
  toutes: { libelle: 'Toutes', etats: null }
};

// Les tris possibles et leur sens par défaut (D-024).
export const TRIS = {
  interet: { libelle: 'Intérêt', sens: 'desc' },
  echeance: { libelle: 'Date prévue', sens: 'asc' },
  creation: { libelle: 'Création', sens: 'desc' },
  titre: { libelle: 'Titre', sens: 'asc' }
};

// Texte sans majuscules ni accents, pour une recherche tolérante :
// « impots » trouve « Dossier Impôts ».
export function normaliserTexte(texte) {
  return (texte || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Garde les tâches qui correspondent à la recherche, aux catégories cochées
// (aucune cochée = toutes) et au filtre d'état.
export function filtrerTaches(taches, { recherche = '', categories = [], etat = 'non_terminees' } = {}) {
  const mots = normaliserTexte(recherche).split(/\s+/).filter(Boolean);
  const etatsRetenus = (FILTRES_ETAT[etat] || FILTRES_ETAT.non_terminees).etats;
  return taches.filter((tache) => {
    if (etatsRetenus && !etatsRetenus.includes(tache.etat)) return false;
    if (categories.length > 0 && !categories.includes(tache.categorie)) return false;
    if (mots.length > 0) {
      const texte = normaliserTexte(tache.titre + ' ' + (tache.description || ''));
      if (!mots.every((mot) => texte.includes(mot))) return false;
    }
    return true;
  });
}

// La date utilisée pour le tri « Date prévue » : la fin si elle existe, sinon le début.
// Le même jour, une tâche sans heure passe après celles qui ont une heure,
// comme sur l'écran Aujourd'hui.
function datePourTri(tache) {
  const date = tache.fin || tache.debut;
  if (!date) return null;
  return date.includes('T') ? date : date + 'T99:99';
}

// Trie les tâches. « cle » : interet, echeance, creation ou titre ; « sens » : asc ou desc.
// Les tâches sans date vont toujours à la fin du tri « Date prévue ».
// À égalité : intérêt décroissant, puis la plus ancienne.
export function trierTaches(taches, cle = 'interet', sens = TRIS[cle] ? TRIS[cle].sens : 'desc') {
  const facteur = sens === 'asc' ? 1 : -1;
  const departage = (a, b) => interet(b) - interet(a) || a.creeLe.localeCompare(b.creeLe);
  return [...taches].sort((a, b) => {
    let ecart = 0;
    if (cle === 'interet') {
      ecart = (interet(a) - interet(b)) * facteur;
    } else if (cle === 'echeance') {
      const da = datePourTri(a);
      const db = datePourTri(b);
      if (!da && !db) ecart = 0;
      else if (!da) return 1;
      else if (!db) return -1;
      else ecart = da.localeCompare(db) * facteur;
    } else if (cle === 'creation') {
      ecart = a.creeLe.localeCompare(b.creeLe) * facteur;
    } else if (cle === 'titre') {
      ecart = normaliserTexte(a.titre).localeCompare(normaliserTexte(b.titre), 'fr') * facteur;
    }
    return ecart || departage(a, b);
  });
}

// ---------- Fiche tâche (étape 7) ----------

// Les résultats possibles à la clôture.
export const RESULTATS = {
  atteint: 'Atteint',
  partiel: 'Partiel',
  non_atteint: 'Non atteint'
};

// Une tâche est terminée quand elle est faite ou abandonnée.
export function estTerminee(tache) {
  return tache.etat === ETATS.FAITE || tache.etat === ETATS.ABANDONNEE;
}

// « 2026-11-16T14:30 » → { date: '2026-11-16', heure: '14:30' } ; null → { date: '', heure: '' }
export function separerDateHeure(texte) {
  if (!texte) return { date: '', heure: '' };
  return { date: texte.slice(0, 10), heure: texte.includes('T') ? texte.slice(11, 16) : '' };
}

// Changement d'état depuis la fiche (liste « État » ou boutons Faite / Abandonner).
// Terminer enregistre l'heure de fin réelle ; revenir en arrière l'efface (D-025).
export function changementsEtat(tache, nouvelEtat, maintenantIso) {
  const changements = { etat: nouvelEtat };
  const terminee = nouvelEtat === ETATS.FAITE || nouvelEtat === ETATS.ABANDONNEE;
  if (terminee && !tache.termineLe) changements.termineLe = maintenantIso;
  if (!terminee) changements.termineLe = null;
  return changements;
}

// Changement des dates depuis la fiche. L'état suit automatiquement (D-025) :
//  - une date posée sur une tâche Inbox ou À planifier la rend Planifiée ;
//  - plus aucune date sur une tâche Planifiée ou En cours la remet À planifier.
// Les tâches terminées gardent leur état.
export function changementsDates(tache, debut, fin) {
  const changements = { debut: debut || null, fin: fin || null };
  const aUneDate = Boolean(changements.debut || changements.fin);
  if (aUneDate && (tache.etat === ETATS.INBOX || tache.etat === ETATS.A_PLANIFIER)) {
    changements.etat = ETATS.PLANIFIEE;
  }
  if (!aUneDate && (tache.etat === ETATS.PLANIFIEE || tache.etat === ETATS.EN_COURS)) {
    changements.etat = ETATS.A_PLANIFIER;
  }
  return changements;
}

// Vrai si la fin est avant le début (simple avertissement, rien n'est bloqué).
export function finAvantDebut(tache) {
  if (!tache.debut || !tache.fin) return false;
  const debut = tache.debut.includes('T') ? tache.debut : tache.debut + 'T00:00';
  const fin = tache.fin.includes('T') ? tache.fin : tache.fin + 'T23:59';
  return fin < debut;
}

// ---------- Réglages (étape 8) ----------

export const LONGUEUR_MAX_CATEGORIE = 40;
export const JOURS_AVANT_RAPPEL = 30;

// Vérifie un nom de catégorie (nouveau ou renommé).
// « existantes » : les noms déjà utilisés ; « ancien » : le nom actuel en cas de renommage.
// Deux noms qui ne diffèrent que par les majuscules ou les accents sont considérés identiques.
export function verifierNomCategorie(nom, existantes, ancien = null) {
  const propre = (nom || '').trim().replace(/\s+/g, ' ');
  if (!propre) return { valide: false, message: 'Le nom ne peut pas être vide.' };
  if (propre.length > LONGUEUR_MAX_CATEGORIE) {
    return { valide: false, message: `${LONGUEUR_MAX_CATEGORIE} caractères au maximum.` };
  }
  const doublon = existantes.some((existante) =>
    existante !== ancien && normaliserTexte(existante) === normaliserTexte(propre));
  if (doublon) return { valide: false, message: `La catégorie « ${propre} » existe déjà.` };
  return { valide: true, nom: propre };
}

// Monte (-1) ou descend (+1) l'élément n° « index » d'une liste ; renvoie une nouvelle liste.
export function deplacer(liste, index, direction) {
  const cible = index + direction;
  if (index < 0 || index >= liste.length || cible < 0 || cible >= liste.length) return [...liste];
  const copie = [...liste];
  [copie[index], copie[cible]] = [copie[cible], copie[index]];
  return copie;
}

// Nom du fichier de sauvegarde : « organisation-2026-11-15.json ».
export function nomFichierSauvegarde(date = new Date()) {
  return `organisation-${dateEnTexte(date)}.json`;
}

// Vérifie le contenu d'un fichier de sauvegarde avant de l'importer (D-028).
// Renvoie { valide: true, taches, categories, exporteLe } ou { valide: false, message }.
export function verifierSauvegarde(contenu) {
  const refus = (message) => ({ valide: false, message });
  if (!contenu || typeof contenu !== 'object') return refus('Ce fichier ne contient pas de données lisibles.');
  if (contenu.application !== 'organisation') return refus('Ce fichier n\'est pas une sauvegarde de l\'application Organisation.');
  if (!Array.isArray(contenu.taches)) return refus('La liste des tâches est absente du fichier.');

  const etatsConnus = Object.values(ETATS);
  const identifiants = new Set();
  for (const tache of contenu.taches) {
    if (!tache || typeof tache.id !== 'string' || !tache.id) return refus('Une tâche du fichier n\'a pas d\'identifiant.');
    if (typeof tache.titre !== 'string' || !tache.titre.trim()) return refus('Une tâche du fichier n\'a pas de titre.');
    if (tache.etat !== undefined && !etatsConnus.includes(tache.etat)) return refus(`État inconnu dans le fichier : « ${tache.etat} ».`);
    if (identifiants.has(tache.id)) return refus('Deux tâches du fichier ont le même identifiant.');
    identifiants.add(tache.id);
  }

  let categories = null;
  if (contenu.categories !== undefined) {
    const correctes = Array.isArray(contenu.categories) && contenu.categories.length > 0 &&
      contenu.categories.every((c) => c && typeof c.nom === 'string' && c.nom.trim());
    if (!correctes) return refus('La liste des catégories du fichier est abîmée.');
    categories = contenu.categories.map((c) => ({ nom: c.nom.trim(), masquee: Boolean(c.masquee) }));
  }

  return { valide: true, taches: contenu.taches, categories, exporteLe: contenu.exporteLe || null };
}

// Nombre de jours entiers (du calendrier) écoulés depuis une date.
export function joursEcoules(depuisIso, maintenant = new Date()) {
  const depuis = new Date(depuisIso);
  const minuit = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((minuit(maintenant) - minuit(depuis)) / 86400000);
}

// Faut-il rappeler de sauvegarder ? (D-029)
// Point de départ : la dernière sauvegarde, ou à défaut la création de la plus ancienne tâche.
// Rappel à partir de 30 jours. Sans aucune tâche ni sauvegarde : pas de rappel.
export function etatSauvegarde(derniereSauvegardeIso, taches, maintenant = new Date()) {
  let depart = derniereSauvegardeIso;
  if (!depart && taches.length > 0) {
    depart = taches.map((t) => t.creeLe).sort()[0];
  }
  if (!depart) return { jamais: !derniereSauvegardeIso, jours: 0, rappel: false };
  const jours = joursEcoules(depart, maintenant);
  return { jamais: !derniereSauvegardeIso, jours, rappel: jours >= JOURS_AVANT_RAPPEL };
}

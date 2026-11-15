/*
  ecrans/reglages.js : l'écran Réglages (étape 8).
  1. Sauvegarde : état de la dernière sauvegarde, Exporter, Importer.
     En V1A, c'est la seule protection des données (elles ne sont que sur un appareil).
  2. Catégories : renommer (directement dans le champ), monter, descendre,
     masquer / réafficher, ajouter. Une catégorie n'est jamais supprimée (D-027).
  3. Application : version, hors ligne, stockage, nombre de tâches.
*/

import {
  listerTaches, lireReglage, ecrireReglage, toutesLesCategories, enregistrerCategories,
  renommerCategorie, exporterDonnees, remplacerToutesLesDonnees, stockageEstPersistant
} from '../donnees.js';
import {
  verifierNomCategorie, deplacer, nomFichierSauvegarde, verifierSauvegarde, etatSauvegarde,
  JOURS_AVANT_RAPPEL, LONGUEUR_MAX_CATEGORIE
} from '../calculs.js';
import { afficherBandeau } from '../bandeau.js';

let conteneurActuel = null;
let options = { version: '', etatHorsLigne: () => '', surChangement: () => {} };
let messageCategories = '';

// ---------- Points d'entrée, appelés par app.js ----------

// Au démarrage : version, état hors ligne, mise à jour du compteur.
export function configurerReglages(nouvellesOptions = {}) {
  options = { ...options, ...nouvellesOptions };
}

export async function afficherReglages(conteneur, nouvellesOptions = {}) {
  conteneurActuel = conteneur;
  options = { ...options, ...nouvellesOptions };
  await dessiner();
}

function ecranEstAffiche() {
  return conteneurActuel && conteneurActuel.dataset.ecran === 'reglages';
}

// ---------- Export : utilisé ici et par le rappel de l'écran Aujourd'hui ----------

// Télécharge le fichier de sauvegarde et note la date. Renvoie le nom du fichier.
export async function telechargerSauvegarde(versionApplication = options.version) {
  const donnees = await exporterDonnees(versionApplication);
  const nom = nomFichierSauvegarde(new Date());
  const fichier = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' });
  const adresse = URL.createObjectURL(fichier);
  const lien = document.createElement('a');
  lien.href = adresse;
  lien.download = nom;
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(adresse), 10000);
  await ecrireReglage('derniereSauvegarde', donnees.exporteLe);
  afficherBandeau(`Sauvegarde téléchargée : ${nom}`);
  return nom;
}

// ---------- Dessin ----------

async function dessiner() {
  if (!ecranEstAffiche()) return;
  const [taches, derniere, persistant] = await Promise.all([
    listerTaches(), lireReglage('derniereSauvegarde'), stockageEstPersistant()
  ]);
  if (!ecranEstAffiche()) return;

  conteneurActuel.replaceChildren(
    sectionSauvegarde(taches, derniere),
    sectionCategories(taches),
    sectionApplication(taches, persistant)
  );
}

function sectionSauvegarde(taches, derniere) {
  const section = creer('section', 'section-fiche');
  section.append(creer('h2', 'titre-bloc', 'Sauvegarde'));

  const etat = etatSauvegarde(derniere, taches);
  let texte;
  if (!derniere) texte = 'Aucune sauvegarde pour l\'instant.';
  else if (etat.jours === 0) texte = 'Dernière sauvegarde : aujourd\'hui.';
  else texte = `Dernière sauvegarde : il y a ${etat.jours} jour${etat.jours > 1 ? 's' : ''}.`;
  section.append(creer('p', 'etat-sauvegarde' + (etat.rappel ? ' alerte' : ''), texte));

  // Le sélecteur de fichier est caché : le bouton « Importer » l'ouvre.
  const choixFichier = document.createElement('input');
  choixFichier.type = 'file';
  choixFichier.accept = '.json,application/json';
  choixFichier.hidden = true;
  choixFichier.addEventListener('change', () => {
    const fichier = choixFichier.files[0];
    // On vide le sélecteur : choisir à nouveau le même fichier (après un « Annuler »)
    // doit fonctionner, sinon le navigateur ne signale aucun changement.
    choixFichier.value = '';
    if (fichier) importer(fichier, taches.length);
  });

  section.append(
    creer('div', 'boutons-sauvegarde', [
      bouton('Exporter', 'bouton bouton-principal', async () => { await telechargerSauvegarde(); await dessiner(); }),
      bouton('Importer', 'bouton', () => choixFichier.click())
    ]),
    choixFichier,
    creer('p', 'discret', `Rappel tous les ${JOURS_AVANT_RAPPEL} jours. Le fichier arrive dans Téléchargements : copie-le sur Google Drive ou une clé USB. Importer remplace toutes les tâches de cet appareil par celles du fichier.`)
  );
  return section;
}

function sectionCategories(taches) {
  const section = creer('section', 'section-fiche');
  const categories = toutesLesCategories();
  const visibles = categories.filter((c) => !c.masquee).length;
  section.append(
    creer('h2', 'titre-bloc', `Catégories (${visibles} affichées sur ${categories.length})`),
    creer('p', 'discret', 'Touche un nom pour le modifier. Une catégorie masquée n\'est plus proposée, mais les tâches qui l\'utilisent la gardent.')
  );

  const liste = creer('ul', 'liste-categories');
  categories.forEach((categorie, index) => {
    const utilisations = taches.filter((t) => t.categorie === categorie.nom).length;

    const champNom = document.createElement('input');
    champNom.type = 'text';
    champNom.className = 'champ';
    champNom.value = categorie.nom;
    champNom.maxLength = LONGUEUR_MAX_CATEGORIE;
    champNom.setAttribute('aria-label', `Nom de la catégorie ${categorie.nom}`);
    champNom.addEventListener('keydown', (e) => { if (e.key === 'Enter') champNom.blur(); });
    champNom.addEventListener('change', () => renommer(categorie.nom, champNom.value, categories));

    const monter = bouton('↑', 'bouton-carte', () => reordonner(categories, index, -1));
    monter.setAttribute('aria-label', `Monter ${categorie.nom}`);
    monter.disabled = index === 0;
    const descendre = bouton('↓', 'bouton-carte', () => reordonner(categories, index, 1));
    descendre.setAttribute('aria-label', `Descendre ${categorie.nom}`);
    descendre.disabled = index === categories.length - 1;
    const masquer = bouton(categorie.masquee ? 'Afficher' : 'Masquer', 'bouton-carte bouton-texte',
      () => basculerMasquage(categories, index));

    const ligne = creer('li', 'ligne-categorie' + (categorie.masquee ? ' categorie-masquee' : ''), [
      creer('div', 'nom-categorie', [
        champNom,
        creer('span', 'meta-tache', `${utilisations} tâche${utilisations > 1 ? 's' : ''}${categorie.masquee ? ' · masquée' : ''}`)
      ]),
      creer('div', 'actions-carte', [monter, descendre, masquer])
    ]);
    liste.append(ligne);
  });
  section.append(liste);

  // Ajouter une catégorie
  const nouveau = document.createElement('input');
  nouveau.type = 'text';
  nouveau.className = 'champ';
  nouveau.maxLength = LONGUEUR_MAX_CATEGORIE;
  nouveau.placeholder = 'Nouvelle catégorie';
  nouveau.setAttribute('aria-label', 'Nom de la nouvelle catégorie');
  const ajouter = () => ajouterCategorie(nouveau.value, categories);
  nouveau.addEventListener('keydown', (e) => { if (e.key === 'Enter') ajouter(); });
  section.append(
    creer('div', 'ajout-categorie', [nouveau, bouton('+ Ajouter', 'bouton', ajouter)]),
    creer('p', 'message-capture', messageCategories)
  );
  messageCategories = '';
  return section;
}

function sectionApplication(taches, persistant) {
  const section = creer('section', 'section-fiche');
  section.append(
    creer('h2', 'titre-bloc', 'Application'),
    creer('p', 'ligne-info', `Version ${options.version}`),
    creer('p', 'ligne-info', `Hors ligne : ${options.etatHorsLigne()}`),
    creer('p', 'ligne-info', `Stockage : ${persistant ? 'persistant (le navigateur ne l\'effacera pas de lui-même)' : 'standard'}`),
    creer('p', 'ligne-info', `${taches.length} tâche${taches.length > 1 ? 's' : ''} sur cet appareil`)
  );
  return section;
}

// ---------- Actions sur les catégories ----------

async function renommer(ancien, saisie, categories) {
  const autres = categories.map((c) => c.nom);
  const verification = verifierNomCategorie(saisie, autres, ancien);
  if (!verification.valide) {
    messageCategories = verification.message;
    await dessiner();
    return;
  }
  if (verification.nom === ancien) return;
  const nombre = await renommerCategorie(ancien, verification.nom);
  messageCategories = `« ${ancien} » renommée en « ${verification.nom} » (${nombre} tâche${nombre > 1 ? 's' : ''} mise${nombre > 1 ? 's' : ''} à jour).`;
  await dessiner();
}

async function reordonner(categories, index, direction) {
  await enregistrerCategories(deplacer(categories, index, direction));
  await dessiner();
}

async function basculerMasquage(categories, index) {
  const copie = categories.map((c) => ({ ...c }));
  const visibles = copie.filter((c) => !c.masquee).length;
  if (!copie[index].masquee && visibles === 1) {
    messageCategories = 'Il faut garder au moins une catégorie affichée.';
    await dessiner();
    return;
  }
  copie[index].masquee = !copie[index].masquee;
  await enregistrerCategories(copie);
  await dessiner();
}

async function ajouterCategorie(saisie, categories) {
  const verification = verifierNomCategorie(saisie, categories.map((c) => c.nom));
  if (!verification.valide) {
    messageCategories = verification.message;
    await dessiner();
    return;
  }
  await enregistrerCategories([...categories, { nom: verification.nom, masquee: false }]);
  messageCategories = `Catégorie « ${verification.nom} » ajoutée en fin de liste.`;
  await dessiner();
}

// ---------- Import ----------

async function importer(fichier, nombreActuel) {
  let contenu;
  try {
    contenu = JSON.parse(await fichier.text());
  } catch (erreur) {
    afficherBandeau('Ce fichier n\'est pas une sauvegarde lisible.');
    return;
  }
  const verification = verifierSauvegarde(contenu);
  if (!verification.valide) {
    afficherBandeau(verification.message);
    return;
  }
  const date = verification.exporteLe
    ? new Date(verification.exporteLe).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'date inconnue';
  // La seule confirmation de l'application : cette action ne peut pas être annulée.
  const accord = window.confirm(
    `${verification.taches.length} tâches trouvées dans « ${fichier.name} » (sauvegarde du ${date}).\n\n` +
    `Remplacer toutes les données actuelles (${nombreActuel} tâches) ?\n` +
    'Cette action ne peut pas être annulée. Conseil : exporte d\'abord les données actuelles.'
  );
  if (!accord) return;
  const nombre = await remplacerToutesLesDonnees(verification);
  afficherBandeau(`Données restaurées : ${nombre} tâche${nombre > 1 ? 's' : ''}.`);
  options.surChangement();
  await dessiner();
}

// ---------- Petits outils ----------

function bouton(texte, classe, action) {
  const element = creer('button', classe, texte);
  element.type = 'button';
  element.addEventListener('click', action);
  return element;
}

// Crée un élément de page. Le texte est inséré tel quel (jamais interprété comme du code).
function creer(balise, classe, contenu) {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  if (Array.isArray(contenu)) element.append(...contenu);
  else if (contenu instanceof Node) element.append(contenu);
  else if (contenu !== undefined) element.textContent = contenu;
  return element;
}

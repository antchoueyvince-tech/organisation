/*
  ecrans/inbox.js : l'écran Inbox.
  Étape 3 : liste des captures.
  Étape 4 : qualification, une capture à la fois, la plus ancienne d'abord (D-021) :
    catégorie → faisabilité → impact, puis Planifier…, Plus tard ou Supprimer.
  Chaque choix est enregistré immédiatement (pas de bouton « Enregistrer »).
*/

import {
  categoriesVisibles, ETATS, listerTaches, mettreAJourTache, supprimerTache, remettreTache
} from '../donnees.js';
import {
  interet, categoriesRecentes, dateRapide, debutPlanifie, dateDepuisTexte,
  NOTE_MINIMUM, NOTE_MAXIMUM
} from '../calculs.js';
import { afficherBandeau } from '../bandeau.js';

let conteneurActuel = null;     // la zone de l'écran
let quandCaChange = () => {};   // prévient app.js (pour le compteur « Inbox (3) »)
let tacheAffichee = null;       // la capture en cours de qualification
let toutesLesCategories = false; // « Plus… » a-t-il été ouvert ?
let prochaineNote = 'faisabilite'; // pour le clavier : quelle note reçoit le prochain chiffre
let dejaInstalle = false;

// ---------- Point d'entrée, appelé par app.js ----------

export async function afficherInbox(conteneur, { surChangement } = {}) {
  conteneurActuel = conteneur;
  if (surChangement) quandCaChange = surChangement;
  if (!dejaInstalle) {
    document.addEventListener('keydown', surTouche);
    installerPlanification();
    dejaInstalle = true;
  }
  await dessiner();
}

function inboxEstAffichee() {
  return conteneurActuel && conteneurActuel.dataset.ecran === 'inbox';
}

// ---------- Dessin de l'écran ----------

async function dessiner() {
  if (!inboxEstAffichee()) return;
  const toutes = await listerTaches();
  const aQualifier = toutes
    .filter((tache) => tache.etat === ETATS.INBOX)
    .sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  if (!inboxEstAffichee()) return;

  const c = conteneurActuel;
  c.replaceChildren();

  if (aQualifier.length === 0) {
    tacheAffichee = null;
    const lien = creer('a', 'bouton', 'Retour à Aujourd\'hui');
    lien.href = '#aujourdhui';
    c.append(
      creer('p', 'vide', 'Tout est qualifié.'),
      creer('p', 'discret centre', 'Utilise le bouton + pour capturer une nouvelle tâche.'),
      creer('p', 'centre', lien)
    );
    return;
  }

  const tache = aQualifier[0];
  if (!tacheAffichee || tacheAffichee.id !== tache.id) {
    // Nouvelle capture à l'écran : on repart de zéro pour « Plus… » et le clavier.
    toutesLesCategories = false;
    prochaineNote = tache.faisabilite && !tache.impact ? 'impact' : 'faisabilite';
  }
  tacheAffichee = tache;

  c.append(creer('p', 'discret', `Capture 1 sur ${aQualifier.length}`));

  const carte = creer('section', 'qualification');
  carte.append(
    zoneTitre(tache),
    ligne('Catégorie', zoneCategories(tache, toutes)),
    ligne('Faisabilité', zoneNotes(tache, 'faisabilite'), '5 = très facile'),
    ligne('Impact', zoneNotes(tache, 'impact'), '5 = très fort'),
    zoneInteret(tache),
    zoneActions()
  );
  c.append(carte, creer('p', 'astuce-pc', 'Clavier : 1 à 5 = notes (faisabilité, puis impact), Entrée = Plus tard'));
}

function zoneTitre(tache) {
  const zone = creer('div', 'zone-titre');
  const champ = document.createElement('input');
  champ.type = 'text';
  champ.className = 'titre-editable';
  champ.value = tache.titre;
  champ.maxLength = 200;
  champ.setAttribute('aria-label', 'Titre de la tâche (modifiable)');
  champ.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Enter') champ.blur();
  });
  champ.addEventListener('change', async () => {
    const titre = champ.value.trim();
    if (!titre) {
      champ.value = tache.titre;
      return;
    }
    await modifier({ titre });
  });
  zone.append(champ, creer('div', 'meta-tache', 'Capturée ' + quand(tache.creeLe)));
  return zone;
}

function zoneCategories(tache, toutes) {
  const groupe = creer('div', 'puces');
  // Étape 8 : la liste vient des Réglages (catégories non masquées, dans l'ordre choisi).
  const proposees = categoriesVisibles();
  let visibles = toutesLesCategories ? [...proposees] : categoriesRecentes(toutes, proposees, 3);
  if (tache.categorie && !visibles.includes(tache.categorie)) visibles.push(tache.categorie);

  for (const categorie of visibles) {
    const bouton = boutonChoix('puce', categorie, categorie === tache.categorie);
    // Toucher une catégorie déjà choisie la retire.
    bouton.addEventListener('click', () =>
      modifier({ categorie: categorie === tache.categorie ? null : categorie }));
    groupe.append(bouton);
  }

  const plus = creer('button', 'puce puce-plus', toutesLesCategories ? 'Moins' : 'Plus…');
  plus.type = 'button';
  plus.addEventListener('click', () => {
    toutesLesCategories = !toutesLesCategories;
    dessiner();
  });
  groupe.append(plus);
  return groupe;
}

function zoneNotes(tache, champ) {
  const groupe = creer('div', 'notes');
  for (let note = NOTE_MINIMUM; note <= NOTE_MAXIMUM; note++) {
    const bouton = boutonChoix('note', String(note), tache[champ] === note);
    bouton.setAttribute('aria-label', `${champ === 'faisabilite' ? 'Faisabilité' : 'Impact'} ${note}`);
    bouton.addEventListener('click', () => {
      prochaineNote = champ === 'faisabilite' ? 'impact' : 'faisabilite';
      // Toucher la note déjà choisie la retire.
      modifier({ [champ]: tache[champ] === note ? null : note });
    });
    groupe.append(bouton);
  }
  return groupe;
}

function zoneInteret(tache) {
  const complet = tache.faisabilite && tache.impact;
  const texte = complet
    ? `Intérêt : ${tache.impact} × ${tache.faisabilite} = ${interet(tache)}`
    : 'Intérêt : 0 (notes à compléter)';
  return creer('p', 'interet', texte);
}

function zoneActions() {
  const zone = creer('div', 'actions-qualification');
  const planifier = creer('button', 'bouton bouton-principal', 'Planifier…');
  const plusTard = creer('button', 'bouton', 'Plus tard');
  const supprimer = creer('button', 'bouton bouton-discret', 'Supprimer');
  for (const bouton of [planifier, plusTard, supprimer]) bouton.type = 'button';
  planifier.addEventListener('click', ouvrirPlanification);
  plusTard.addEventListener('click', rangerPlusTard);
  supprimer.addEventListener('click', supprimerCapture);
  zone.append(planifier, plusTard, supprimer);
  return zone;
}

// ---------- Actions ----------

async function modifier(changements) {
  if (!tacheAffichee) return;
  await mettreAJourTache(tacheAffichee.id, changements);
  await dessiner();
}

// La tâche quitte l'Inbox ; « Annuler » la remet exactement comme avant.
async function sortirDeLInbox(changements, message) {
  if (!tacheAffichee) return;
  const avant = { ...tacheAffichee };
  await mettreAJourTache(avant.id, changements);
  afficherBandeau(message, () => remettre(avant));
  await dessiner();
  quandCaChange();
}

function rangerPlusTard() {
  return sortirDeLInbox({ etat: ETATS.A_PLANIFIER }, 'Rangée dans « À planifier »');
}

async function supprimerCapture() {
  if (!tacheAffichee) return;
  const avant = { ...tacheAffichee };
  await supprimerTache(avant.id);
  afficherBandeau('Tâche supprimée', () => remettre(avant));
  await dessiner();
  quandCaChange();
}

async function remettre(tache) {
  await remettreTache(tache);
  tacheAffichee = null;
  await dessiner();
  quandCaChange();
}

// ---------- Fenêtre « Planifier » (D-021) ----------
// L'heure (facultative) se choisit d'abord ; un toucher sur un jour valide aussitôt.

function installerPlanification() {
  const fenetre = document.getElementById('planification');
  fenetre.querySelectorAll('[data-jour]').forEach((bouton) => {
    bouton.addEventListener('click', () => validerPlanification(dateRapide(bouton.dataset.jour)));
  });
  document.getElementById('formulaire-planification').addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    validerPlanification(document.getElementById('date-planification').value);
  });
  document.getElementById('annuler-planification').addEventListener('click', () => fenetre.close());
  fenetre.addEventListener('click', (evenement) => {
    if (evenement.target === fenetre) fenetre.close();
  });
}

function ouvrirPlanification() {
  if (!tacheAffichee) return;
  document.getElementById('heure-planification').value = '';
  document.getElementById('date-planification').value = '';
  document.getElementById('message-planification').textContent = '';
  document.getElementById('planification').showModal();
}

function validerPlanification(date) {
  const heure = document.getElementById('heure-planification').value;
  const debut = debutPlanifie(date, heure);
  if (!debut) {
    document.getElementById('message-planification').textContent = 'Choisis un jour ou une date.';
    return;
  }
  document.getElementById('planification').close();
  sortirDeLInbox({ debut, etat: ETATS.PLANIFIEE }, 'Planifiée ' + libelleDate(debut));
}

// « le lun. 16 nov. » ou « le lun. 16 nov. à 14:30 »
function libelleDate(debut) {
  const jour = dateDepuisTexte(debut).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const heure = debut.includes('T') ? ' à ' + debut.slice(11, 16) : '';
  return `le ${jour}${heure}`;
}

// ---------- Clavier (PC) ----------
// 1 à 5 : note la faisabilité, puis l'impact. Entrée : Plus tard.

function surTouche(evenement) {
  if (!inboxEstAffichee() || !tacheAffichee) return;
  if (document.querySelector('dialog[open]')) return;
  if (evenement.ctrlKey || evenement.altKey || evenement.metaKey) return;
  const cible = evenement.target;
  if (cible.closest && cible.closest('input, textarea, select, [contenteditable="true"]')) return;

  if (/^[1-5]$/.test(evenement.key)) {
    evenement.preventDefault();
    const champ = prochaineNote;
    prochaineNote = champ === 'faisabilite' ? 'impact' : 'faisabilite';
    modifier({ [champ]: Number(evenement.key) });
  } else if (evenement.key === 'Enter') {
    if (cible.closest && cible.closest('button, a')) return; // Entrée sur un bouton : le bouton agit seul
    evenement.preventDefault();
    rangerPlusTard();
  }
}

// ---------- Petits outils ----------

function ligne(libelle, contenu, aide) {
  const zone = creer('div', 'ligne-qualification');
  const etiquette = creer('div', 'etiquette', libelle);
  if (aide) etiquette.append(creer('span', 'aide', aide));
  zone.append(etiquette, contenu);
  return zone;
}

function boutonChoix(classe, texte, choisi) {
  const bouton = creer('button', classe, texte);
  bouton.type = 'button';
  bouton.setAttribute('aria-pressed', String(choisi));
  return bouton;
}

// Crée un élément de page. Le texte est inséré tel quel (jamais interprété
// comme du code), ce qui protège contre les caractères spéciaux dans un titre.
function creer(balise, classe, contenu) {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  if (contenu instanceof Node) element.append(contenu);
  else if (contenu !== undefined) element.textContent = contenu;
  return element;
}

// « aujourd'hui à 14:05 », « hier à 18:42 » ou « le 12 nov. à 09:30 ».
function quand(dateIso) {
  const date = new Date(dateIso);
  const heure = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const minuit = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ecartEnJours = Math.round((minuit(new Date()) - minuit(date)) / 86400000);
  if (ecartEnJours === 0) return `aujourd'hui à ${heure}`;
  if (ecartEnJours === 1) return `hier à ${heure}`;
  const jour = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return `le ${jour} à ${heure}`;
}

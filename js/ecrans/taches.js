/*
  ecrans/taches.js : l'écran « Toutes les tâches » (étape 6).
  Il remplace le tableau Excel et les filtres PowerQuery :
    - une recherche (titre et description, sans tenir compte des accents) ;
    - un filtre par catégorie (plusieurs choix possibles) ;
    - un filtre par état (Non terminées par défaut) ;
    - un tri (intérêt, date prévue, création, titre), inversable.
  Sur PC : un tableau ; sur téléphone : une liste de cartes.
  Les filtres sont gardés tant que l'application reste ouverte (D-024).
  Étape 7 : toucher une tâche (ou cliquer sur sa ligne) ouvre sa fiche.
*/

import { categoriesVisibles, listerTaches } from '../donnees.js';
import {
  interet, dateEnTexte, libelleJour, filtrerTaches, trierTaches,
  LIBELLES_ETATS, FILTRES_ETAT, TRIS
} from '../calculs.js';

// Les choix en cours, gardés pendant que l'application est ouverte.
const choix = {
  recherche: '',
  categories: [],
  etat: 'non_terminees',
  tri: 'interet',
  sens: TRIS.interet.sens
};

const ecranLarge = window.matchMedia('(min-width: 800px)');
let conteneurActuel = null;
let toutesLesTaches = [];
let zoneListe = null;
let zoneResume = null;
let dejaInstalle = false;

// ---------- Point d'entrée, appelé par app.js ----------

export async function afficherTaches(conteneur) {
  conteneurActuel = conteneur;
  if (!dejaInstalle) {
    document.addEventListener('keydown', surTouche);
    ecranLarge.addEventListener('change', () => { if (ecranEstAffiche()) dessinerListe(); });
    dejaInstalle = true;
  }
  toutesLesTaches = await listerTaches();
  if (!ecranEstAffiche()) return;
  dessinerCommandes();
  dessinerListe();
}

function ecranEstAffiche() {
  return conteneurActuel && conteneurActuel.dataset.ecran === 'taches';
}

// ---------- Commandes : recherche, filtres, tri ----------
// Dessinées une seule fois par affichage, pour que la recherche garde le curseur
// pendant la frappe ; seule la liste est redessinée.

function dessinerCommandes() {
  const c = conteneurActuel;
  c.replaceChildren();

  const recherche = document.createElement('input');
  recherche.type = 'search';
  recherche.id = 'recherche-taches';
  recherche.className = 'champ-recherche';
  recherche.placeholder = 'Rechercher…';
  recherche.setAttribute('aria-label', 'Rechercher dans les titres et descriptions');
  recherche.value = choix.recherche;
  recherche.addEventListener('input', () => {
    choix.recherche = recherche.value;
    dessinerListe();
  });

  // Les filtres, dans un panneau repliable (ouvert d'office sur PC).
  const panneau = creer('details', 'panneau-filtres');
  panneau.open = ecranLarge.matches;
  const titrePanneau = creer('summary', 'titre-filtres');
  panneau.append(titrePanneau);

  const puces = creer('div', 'puces');
  // Étape 8 : catégories des Réglages. Un filtre sur une catégorie renommée
  // ou masquée depuis est retiré, pour ne pas cacher de tâches sans le montrer.
  const proposees = categoriesVisibles();
  choix.categories = choix.categories.filter((nom) => proposees.includes(nom));
  for (const categorie of proposees) {
    const bouton = creer('button', 'puce', categorie);
    bouton.type = 'button';
    bouton.setAttribute('aria-pressed', String(choix.categories.includes(categorie)));
    bouton.addEventListener('click', () => {
      const deja = choix.categories.includes(categorie);
      choix.categories = deja
        ? choix.categories.filter((c2) => c2 !== categorie)
        : [...choix.categories, categorie];
      bouton.setAttribute('aria-pressed', String(!deja));
      mettreAJourTitrePanneau(titrePanneau);
      dessinerListe();
    });
    puces.append(bouton);
  }

  const selectEtat = creerSelect('État', 'filtre-etat',
    Object.entries(FILTRES_ETAT).map(([valeur, filtre]) => [valeur, filtre.libelle]), choix.etat, (valeur) => {
      choix.etat = valeur;
      mettreAJourTitrePanneau(titrePanneau);
      dessinerListe();
    });

  const selectTri = creerSelect('Tri', 'choix-tri',
    Object.entries(TRIS).map(([valeur, tri]) => [valeur, tri.libelle]), choix.tri, (valeur) => {
      choisirTri(valeur, false);
    });

  const effacer = creer('button', 'bouton bouton-discret', 'Effacer les filtres');
  effacer.type = 'button';
  effacer.addEventListener('click', effacerFiltres);

  panneau.append(
    creer('p', 'etiquette', 'Catégories (aucune choisie = toutes)'),
    puces,
    creer('div', 'ligne-selects', [selectEtat, selectTri]),
    effacer
  );
  mettreAJourTitrePanneau(titrePanneau);

  zoneResume = creer('p', 'discret resume-filtres');
  zoneListe = creer('div', 'zone-liste');
  c.append(recherche, panneau, zoneResume, zoneListe,
    creer('p', 'astuce-pc', 'Clavier : / = rechercher · clic sur un en-tête = trier, second clic = ordre inverse'));
}

// « Filtres (2) » : nombre de filtres actifs, pour savoir d'un coup d'œil si la liste est réduite.
function mettreAJourTitrePanneau(titrePanneau) {
  const actifs = (choix.categories.length > 0 ? 1 : 0) + (choix.etat !== 'non_terminees' ? 1 : 0);
  titrePanneau.textContent = actifs ? `Filtres (${actifs})` : 'Filtres';
}

function choisirTri(cle, inverserSiDeja) {
  if (inverserSiDeja && choix.tri === cle) {
    choix.sens = choix.sens === 'asc' ? 'desc' : 'asc';
  } else {
    choix.tri = cle;
    choix.sens = TRIS[cle].sens;
  }
  const select = document.getElementById('choix-tri');
  if (select) select.value = choix.tri;
  dessinerListe();
}

function effacerFiltres() {
  choix.recherche = '';
  choix.categories = [];
  choix.etat = 'non_terminees';
  dessinerCommandes();
  dessinerListe();
}

// ---------- La liste ----------

function dessinerListe() {
  if (!zoneListe) return;
  const resultat = trierTaches(filtrerTaches(toutesLesTaches, choix), choix.tri, choix.sens);
  zoneResume.textContent = resume(resultat.length);
  zoneListe.replaceChildren();

  if (resultat.length === 0) {
    const effacer = creer('button', 'bouton', 'Effacer les filtres');
    effacer.type = 'button';
    effacer.addEventListener('click', effacerFiltres);
    zoneListe.append(creer('p', 'vide', 'Aucune tâche ne correspond.'), creer('p', 'centre', effacer));
    return;
  }

  const aujourdhui = dateEnTexte(new Date());
  zoneListe.append(ecranLarge.matches ? tableau(resultat, aujourdhui) : cartes(resultat, aujourdhui));
}

// « 5 tâches · Transport, Logement · Non terminées · tri : intérêt ↓ »
function resume(nombre) {
  const morceaux = [`${nombre} tâche${nombre > 1 ? 's' : ''}`];
  if (choix.categories.length) morceaux.push(choix.categories.join(', '));
  morceaux.push(FILTRES_ETAT[choix.etat].libelle);
  morceaux.push(`tri : ${TRIS[choix.tri].libelle.toLowerCase()} ${choix.sens === 'asc' ? '↑' : '↓'}`);
  return morceaux.join(' · ');
}

function dateAffichee(tache, aujourdhui) {
  const date = tache.fin || tache.debut;
  if (!date) return '—';
  const heure = date.includes('T') ? ' ' + date.slice(11, 16) : '';
  return libelleJour(date, aujourdhui).replace(/ /g, ' ') + heure;
}

// PC : un tableau dont les en-têtes servent à trier.
function tableau(taches, aujourdhui) {
  const table = creer('table', 'tableau-taches');
  const entete = creer('tr');
  const colonnes = [
    ['titre', 'Titre'], [null, 'Catégorie'], [null, 'État'], ['echeance', 'Date prévue'], ['interet', 'Int.']
  ];
  for (const [cle, libelle] of colonnes) {
    const th = creer('th');
    th.scope = 'col';
    if (cle) {
      const bouton = creer('button', 'entete-tri', libelle + (choix.tri === cle ? (choix.sens === 'asc' ? ' ↑' : ' ↓') : ''));
      bouton.type = 'button';
      bouton.addEventListener('click', () => choisirTri(cle, true));
      th.append(bouton);
    } else {
      th.textContent = libelle;
    }
    if (cle === 'interet') th.className = 'colonne-nombre';
    entete.append(th);
  }
  const thead = creer('thead');
  thead.append(entete);

  const corps = creer('tbody');
  for (const tache of taches) {
    const adresse = '#fiche/' + encodeURIComponent(tache.id);
    const ligne = creer('tr', 'ligne-cliquable');
    // Un clic n'importe où sur la ligne ouvre la fiche ; le titre est aussi un vrai lien (clavier).
    ligne.addEventListener('click', () => { location.hash = adresse; });
    const lien = creer('a', 'lien-fiche', tache.titre);
    lien.href = adresse;
    ligne.append(
      creer('td', 'cellule-titre', lien),
      creer('td', '', tache.categorie || '—'),
      creer('td', '', LIBELLES_ETATS[tache.etat] || tache.etat),
      creer('td', '', dateAffichee(tache, aujourdhui)),
      creer('td', 'colonne-nombre', String(interet(tache)))
    );
    corps.append(ligne);
  }
  table.append(thead, corps);
  return table;
}

// Téléphone : une carte par tâche, l'intérêt à droite.
function cartes(taches, aujourdhui) {
  const liste = creer('ul', 'liste-taches');
  for (const tache of taches) {
    const infos = [tache.categorie || 'Sans catégorie', LIBELLES_ETATS[tache.etat] || tache.etat];
    const date = dateAffichee(tache, aujourdhui);
    if (date !== '—') infos.push(date);
    const contenu = creer('a', 'contenu-carte lien-fiche', [
      creer('div', 'titre-tache', tache.titre),
      creer('div', 'meta-tache', infos.join(' · '))
    ]);
    contenu.href = '#fiche/' + encodeURIComponent(tache.id);
    liste.append(creer('li', 'carte-tache carte-action', [contenu, creer('div', 'interet-carte', String(interet(tache)))]));
  }
  return liste;
}

// ---------- Clavier (PC) ----------
// « / » place le curseur dans la recherche.

function surTouche(evenement) {
  if (!ecranEstAffiche() || evenement.key !== '/') return;
  if (document.querySelector('dialog[open]')) return;
  const cible = evenement.target;
  if (cible.closest && cible.closest('input, textarea, select, [contenteditable="true"]')) return;
  evenement.preventDefault();
  const recherche = document.getElementById('recherche-taches');
  if (recherche) recherche.focus();
}

// ---------- Petits outils ----------

function creerSelect(libelle, id, options, valeurChoisie, quandChange) {
  const etiquette = creer('label', 'choix-liste');
  etiquette.htmlFor = id;
  const select = creer('select');
  select.id = id;
  for (const [valeur, texte] of options) {
    const option = creer('option', '', texte);
    option.value = valeur;
    select.append(option);
  }
  select.value = valeurChoisie;
  select.addEventListener('change', () => quandChange(select.value));
  etiquette.append(creer('span', '', libelle), select);
  return etiquette;
}

// Crée un élément de page. Le texte est inséré tel quel (jamais interprété
// comme du code), ce qui protège contre les caractères spéciaux dans un titre.
// « contenu » peut être un texte, un élément, ou une liste d'éléments.
function creer(balise, classe, contenu) {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  if (Array.isArray(contenu)) element.append(...contenu);
  else if (contenu instanceof Node) element.append(contenu);
  else if (contenu !== undefined) element.textContent = contenu;
  return element;
}

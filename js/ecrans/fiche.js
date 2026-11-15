/*
  ecrans/fiche.js : la fiche d'une tâche (étape 7).
  Elle montre et permet de modifier TOUS les champs, en trois groupes qui suivent
  la vie de la tâche : Essentiel, Planification, Clôture.
  - Chaque modification est enregistrée dès qu'on quitte le champ : pas de bouton
    « Enregistrer ». Un petit « Enregistré ✓ » le confirme.
  - Poser une date rend la tâche Planifiée ; effacer toutes les dates la remet
    À planifier (D-025).
  - Actions : Faite, Reporter à demain, Abandonner, Supprimer, toutes annulables.
  - Retour : bouton « ‹ Retour », touche Échap (PC) ou bouton Retour d'Android.
  Adresse de la fiche : #fiche/<identifiant de la tâche>.
*/

import { categoriesVisibles, ETATS, lireTache, mettreAJourTache, supprimerTache, remettreTache } from '../donnees.js';
import {
  interet, separerDateHeure, debutPlanifie, changementsEtat, changementsDates, changementsDemain,
  finAvantDebut, estTerminee, LIBELLES_ETATS, RESULTATS, NOTE_MINIMUM, NOTE_MAXIMUM
} from '../calculs.js';
import { afficherBandeau } from '../bandeau.js';

const ecranLarge = window.matchMedia('(min-width: 800px)');
let conteneurActuel = null;
let tache = null;
let revenir = () => history.back();
let quandCaChange = () => {};
let minuterieEnregistre;
let dejaInstalle = false;

// ---------- Point d'entrée, appelé par app.js ----------

export async function afficherFiche(conteneur, id, { surRetour, surChangement } = {}) {
  conteneurActuel = conteneur;
  if (surRetour) revenir = surRetour;
  if (surChangement) quandCaChange = surChangement;
  if (!dejaInstalle) {
    document.addEventListener('keydown', surTouche);
    dejaInstalle = true;
  }
  tache = await lireTache(id);
  if (!ficheAffichee()) return;
  dessiner();
}

function ficheAffichee() {
  return conteneurActuel && conteneurActuel.dataset.ecran === 'fiche';
}

// ---------- Dessin ----------

function dessiner() {
  const c = conteneurActuel;
  c.replaceChildren();

  const barre = creer('div', 'barre-fiche', [
    bouton('‹ Retour', 'bouton bouton-discret bouton-retour', () => revenir()),
    creer('span', 'etat-enregistrement discret', 'Enregistrement automatique')
  ]);
  barre.lastChild.id = 'etat-enregistrement';
  c.append(barre);

  if (!tache) {
    c.append(creer('p', 'vide', 'Cette tâche n\'existe plus.'));
    return;
  }

  // Titre, modifiable directement
  const titre = document.createElement('input');
  titre.type = 'text';
  titre.className = 'titre-editable titre-fiche';
  titre.maxLength = 200;
  titre.value = tache.titre;
  titre.setAttribute('aria-label', 'Titre de la tâche');
  titre.addEventListener('keydown', (evenement) => { if (evenement.key === 'Enter') titre.blur(); });
  titre.addEventListener('change', () => {
    const valeur = titre.value.trim();
    if (!valeur) { titre.value = tache.titre; return; }
    enregistrer({ titre: valeur });
  });
  c.append(titre, creer('p', 'meta-tache', informationsDeSuivi()));

  const colonnes = creer('div', 'fiche-colonnes', [
    creer('div', 'fiche-colonne', [sectionEssentiel()]),
    creer('div', 'fiche-colonne', [sectionPlanification(), sectionCloture()])
  ]);
  c.append(colonnes, zoneActions(), creer('p', 'astuce-pc', 'Échap = retour · chaque champ est enregistré quand tu le quittes'));
}

function sectionEssentiel() {
  const section = creer('section', 'section-fiche');
  section.append(creer('h2', 'titre-bloc', 'Essentiel'));

  // Étape 8 : catégories des Réglages ; celle de la tâche reste proposée même si elle est masquée.
  const noms = categoriesVisibles();
  if (tache.categorie && !noms.includes(tache.categorie)) noms.push(tache.categorie);
  const categorie = select('fiche-categorie',
    [['', '— Aucune —'], ...noms.map((nom) => [nom, nom])], tache.categorie || '',
    (valeur) => enregistrer({ categorie: valeur || null }));
  section.append(champ('Catégorie', categorie));

  section.append(
    champ('Faisabilité', notes('faisabilite'), '5 = très facile'),
    champ('Impact', notes('impact'), '5 = très fort')
  );

  const complet = tache.faisabilite && tache.impact;
  section.append(champ('Intérêt', creer('p', 'valeur-calculee',
    complet ? `${tache.impact} × ${tache.faisabilite} = ${interet(tache)}` : '0 (notes à compléter)')));

  const description = zoneTexte('fiche-description', tache.description, 5,
    (valeur) => enregistrer({ description: valeur }));
  section.append(champ('Description', description));
  return section;
}

function sectionPlanification() {
  const section = creer('section', 'section-fiche');
  section.append(creer('h2', 'titre-bloc', 'Planification'));

  const debut = separerDateHeure(tache.debut);
  const fin = separerDateHeure(tache.fin);
  const debutDate = entree('date', 'fiche-debut-date', debut.date);
  const debutHeure = entree('time', 'fiche-debut-heure', debut.heure);
  const finDate = entree('date', 'fiche-fin-date', fin.date);
  const finHeure = entree('time', 'fiche-fin-heure', fin.heure);
  const message = creer('p', 'avertissement', finAvantDebut(tache) ? 'Attention : la fin est avant le début.' : '');

  const quandDateChange = () => {
    if ((!debutDate.value && debutHeure.value) || (!finDate.value && finHeure.value)) {
      message.textContent = 'Indique d\'abord la date, puis l\'heure.';
      return;
    }
    const nouveauDebut = debutPlanifie(debutDate.value, debutHeure.value);
    const nouvelleFin = debutPlanifie(finDate.value, finHeure.value);
    enregistrer(changementsDates(tache, nouveauDebut, nouvelleFin), true);
  };
  for (const entreeDate of [debutDate, debutHeure, finDate, finHeure]) {
    entreeDate.addEventListener('change', quandDateChange);
  }

  section.append(
    champ('Début', creer('div', 'date-heure', [debutDate, debutHeure])),
    champ('Fin', creer('div', 'date-heure', [finDate, finHeure]), 'la fin seule sert d\'échéance'),
    message
  );

  const lieu = entree('text', 'fiche-lieu', tache.lieu || '');
  lieu.maxLength = 200;
  lieu.addEventListener('change', () => enregistrer({ lieu: lieu.value.trim() }));
  section.append(champ('Lieu', lieu));

  const etat = select('fiche-etat', Object.entries(LIBELLES_ETATS), tache.etat,
    (valeur) => enregistrer(changementsEtat(tache, valeur, new Date().toISOString()), true));
  section.append(champ('État', etat));

  section.append(champ('Reports', creer('p', 'valeur-calculee', String(tache.nbReports || 0))));
  return section;
}

function sectionCloture() {
  // Repliée sur téléphone tant que la tâche n'est pas terminée ; toujours ouverte sur PC.
  const section = creer('details', 'section-fiche section-cloture');
  section.open = estTerminee(tache) || ecranLarge.matches;
  section.append(creer('summary', 'titre-bloc', 'Clôture'));

  const resultat = select('fiche-resultat', [['', '—'], ...Object.entries(RESULTATS)], tache.resultat || '',
    (valeur) => enregistrer({ resultat: valeur || null }));
  section.append(
    champ('Résultat', resultat),
    champ('Feedback', zoneTexte('fiche-feedback', tache.feedback, 3, (valeur) => enregistrer({ feedback: valeur }))),
    champ('Suite à donner', zoneTexte('fiche-suite', tache.suite, 3, (valeur) => enregistrer({ suite: valeur }))),
    champ('Bonne pratique', zoneTexte('fiche-bonne-pratique', tache.bonnePratique, 3,
      (valeur) => enregistrer({ bonnePratique: valeur })))
  );
  return section;
}

function zoneActions() {
  const zone = creer('div', 'actions-fiche');
  const faite = bouton(tache.etat === ETATS.FAITE ? 'Faite ✓' : 'Faite', 'bouton bouton-principal', () =>
    agir(changementsEtat(tache, ETATS.FAITE, new Date().toISOString()), 'Tâche faite'));
  faite.disabled = tache.etat === ETATS.FAITE;
  zone.append(
    faite,
    bouton('Reporter à demain', 'bouton', () => agir(changementsDemain(tache), 'Reportée à demain')),
    bouton('Abandonner', 'bouton', () =>
      agir(changementsEtat(tache, ETATS.ABANDONNEE, new Date().toISOString()), 'Tâche abandonnée')),
    bouton('Supprimer', 'bouton bouton-discret', supprimer)
  );
  return zone;
}

// « Créée le 12 nov. à 18:42 · modifiée le 15 nov. à 09:10 · terminée le … »
function informationsDeSuivi() {
  const morceaux = ['Créée le ' + momentLisible(tache.creeLe)];
  if (tache.modifieLe && tache.modifieLe !== tache.creeLe) morceaux.push('modifiée le ' + momentLisible(tache.modifieLe));
  if (tache.termineLe) morceaux.push('terminée le ' + momentLisible(tache.termineLe));
  return morceaux.join(' · ');
}

function momentLisible(iso) {
  const date = new Date(iso);
  const jour = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  const heure = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${jour} à ${heure}`;
}

// ---------- Enregistrement et actions ----------

// Enregistre des changements. « redessiner » : pour les champs dont dépend
// l'affichage (notes, dates, état) ; les textes, eux, ne redessinent rien.
async function enregistrer(changements, redessiner = false) {
  const aJour = await mettreAJourTache(tache.id, changements);
  if (!aJour) return;
  tache = aJour;
  signalerEnregistre();
  quandCaChange();
  if (redessiner && ficheAffichee()) {
    dessiner();
    signalerEnregistre();
  }
}

function signalerEnregistre() {
  const zone = document.getElementById('etat-enregistrement');
  if (!zone) return;
  clearTimeout(minuterieEnregistre);
  zone.textContent = 'Enregistré ✓';
  zone.classList.add('succes');
  minuterieEnregistre = setTimeout(() => {
    zone.textContent = 'Enregistrement automatique';
    zone.classList.remove('succes');
  }, 2000);
}

// Faite, Reporter, Abandonner : la fiche reste ouverte ; « Annuler » remet tout comme avant.
async function agir(changements, message) {
  const avant = { ...tache };
  await enregistrer(changements, true);
  afficherBandeau(message, async () => {
    await remettreTache(avant);
    tache = avant;
    if (ficheAffichee()) dessiner();
    quandCaChange();
  });
}

async function supprimer() {
  const avant = { ...tache };
  await supprimerTache(avant.id);
  quandCaChange();
  afficherBandeau('Tâche supprimée', async () => {
    await remettreTache(avant);
    quandCaChange();
    location.hash = '#fiche/' + encodeURIComponent(avant.id);
  });
  revenir();
}

// ---------- Clavier (PC) ----------
// Échap : quitte le champ en cours (ce qui l'enregistre), puis revient à l'écran précédent.

function surTouche(evenement) {
  if (!ficheAffichee() || evenement.key !== 'Escape') return;
  if (document.querySelector('dialog[open]')) return;
  evenement.preventDefault();
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  revenir();
}

// ---------- Petits outils de construction ----------

function champ(libelle, controle, aide) {
  const zone = creer('div', 'champ-fiche');
  const etiquette = creer('label', 'etiquette', libelle);
  if (controle.id) etiquette.htmlFor = controle.id;
  if (aide) etiquette.append(creer('span', 'aide', aide));
  zone.append(etiquette, controle);
  return zone;
}

function notes(nomDuChamp) {
  const groupe = creer('div', 'notes');
  for (let note = NOTE_MINIMUM; note <= NOTE_MAXIMUM; note++) {
    const b = bouton(String(note), 'note', () =>
      enregistrer({ [nomDuChamp]: tache[nomDuChamp] === note ? null : note }, true));
    b.setAttribute('aria-pressed', String(tache[nomDuChamp] === note));
    b.setAttribute('aria-label', `${nomDuChamp === 'faisabilite' ? 'Faisabilité' : 'Impact'} ${note}`);
    groupe.append(b);
  }
  return groupe;
}

function entree(type, id, valeur) {
  const element = document.createElement('input');
  element.type = type;
  element.id = id;
  element.className = 'champ';
  element.value = valeur || '';
  return element;
}

function zoneTexte(id, valeur, lignes, quandChange) {
  const element = document.createElement('textarea');
  element.id = id;
  element.className = 'champ';
  element.rows = lignes;
  element.value = valeur || '';
  element.addEventListener('change', () => quandChange(element.value.trim()));
  return element;
}

function select(id, options, valeurChoisie, quandChange) {
  const element = document.createElement('select');
  element.id = id;
  element.className = 'champ';
  for (const [valeur, texte] of options) {
    const option = creer('option', '', texte);
    option.value = valeur;
    element.append(option);
  }
  element.value = valeurChoisie;
  element.addEventListener('change', () => quandChange(element.value));
  return element;
}

function bouton(texte, classe, action) {
  const element = creer('button', classe, texte);
  element.type = 'button';
  element.addEventListener('click', action);
  return element;
}

// Crée un élément de page. Le texte est inséré tel quel (jamais interprété
// comme du code), ce qui protège contre les caractères spéciaux dans un titre.
function creer(balise, classe, contenu) {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  if (Array.isArray(contenu)) element.append(...contenu);
  else if (contenu instanceof Node) element.append(contenu);
  else if (contenu !== undefined) element.textContent = contenu;
  return element;
}

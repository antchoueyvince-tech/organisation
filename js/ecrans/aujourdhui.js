/*
  ecrans/aujourdhui.js : l'écran d'accueil (étape 5).
  Il répond à une seule question : « qu'est-ce que je fais maintenant ? »
  Trois blocs, toujours dans le même ordre :
    1. En retard   : tâches dont la date est passée (masqué s'il est vide)
    2. Aujourd'hui : tâches prévues ce jour, par heure puis par intérêt
    3. Ensuite     : les 3 meilleures tâches « À planifier » (masqué s'il est vide)
  Boutons : Fait, Demain, et « + » pour ajouter une tâche d'Ensuite à aujourd'hui.
  Étape 7 : toucher une tâche ouvre sa fiche.
  Étape 8 : rappel de sauvegarde en haut de l'écran après 30 jours sans export (D-029).
  Chaque action peut être annulée pendant 5 secondes (bandeau).
*/

import { ETATS, listerTaches, mettreAJourTache, remettreTache, lireReglage } from '../donnees.js';
import { telechargerSauvegarde } from './reglages.js';
import {
  interet, dateEnTexte, heurePrevue, estEnRetard, estPrevueAujourdhui,
  trierJournee, trierRetard, meilleuresAPlanifier,
  changementsFait, changementsDemain, changementsAujourdhui, libelleJour, etatSauvegarde
} from '../calculs.js';
import { afficherBandeau } from '../bandeau.js';

let conteneurActuel = null;
let quandCaChange = () => {};

// ---------- Point d'entrée, appelé par app.js ----------

export async function afficherAujourdhui(conteneur, { surChangement } = {}) {
  conteneurActuel = conteneur;
  if (surChangement) quandCaChange = surChangement;
  await dessiner();
}

function ecranEstAffiche() {
  return conteneurActuel && conteneurActuel.dataset.ecran === 'aujourdhui';
}

// ---------- Dessin de l'écran ----------

async function dessiner() {
  if (!ecranEstAffiche()) return;
  const [taches, derniereSauvegarde] = await Promise.all([listerTaches(), lireReglage('derniereSauvegarde')]);
  if (!ecranEstAffiche()) return;

  const aujourdhui = dateEnTexte(new Date());
  const enRetard = trierRetard(taches.filter((tache) => estEnRetard(tache, aujourdhui)));
  const duJour = trierJournee(taches.filter((tache) => estPrevueAujourdhui(tache, aujourdhui)));
  const ensuite = meilleuresAPlanifier(taches, 3);
  const nbInbox = taches.filter((tache) => tache.etat === ETATS.INBOX).length;

  const c = conteneurActuel;
  c.replaceChildren();

  // La date du jour, par exemple « dimanche 15 novembre »
  const dateDuJour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  c.append(creer('p', 'sous-titre-date', dateDuJour));

  // Rappel de sauvegarde (étape 8) : affiché seulement après 30 jours sans export.
  const sauvegarde = etatSauvegarde(derniereSauvegarde, taches);
  if (sauvegarde.rappel) {
    const texte = sauvegarde.jamais
      ? `Aucune sauvegarde depuis ${sauvegarde.jours} jours.`
      : `Dernière sauvegarde il y a ${sauvegarde.jours} jours.`;
    const exporter = creer('button', 'bouton bouton-principal', 'Exporter');
    exporter.type = 'button';
    exporter.addEventListener('click', async () => {
      await telechargerSauvegarde();
      await dessiner();
    });
    const rappel = creer('div', 'rappel-sauvegarde');
    rappel.append(creer('span', '', texte), exporter);
    c.append(rappel);
  }

  // Rien du tout à faire : un seul message.
  if (enRetard.length === 0 && duJour.length === 0 && ensuite.length === 0) {
    c.append(creer('p', 'vide', 'Rien de prévu aujourd\'hui.'));
    if (nbInbox > 0) {
      const lien = creer('a', 'bouton', `${nbInbox} capture${nbInbox > 1 ? 's' : ''} à qualifier dans l'Inbox`);
      lien.href = '#inbox';
      c.append(creer('p', 'centre', lien));
    }
    return;
  }

  // 1. En retard (seulement s'il y en a)
  if (enRetard.length > 0) {
    c.append(bloc(`En retard (${enRetard.length})`, 'retard',
      enRetard.map((tache) => carte(tache, aujourdhui, 'retard'))));
  }

  // 2. Aujourd'hui (toujours affiché, pour dire clairement s'il est vide)
  const cartesDuJour = duJour.map((tache) => carte(tache, aujourdhui, 'jour'));
  c.append(bloc(`Aujourd'hui (${duJour.length})`, '',
    cartesDuJour.length ? cartesDuJour : [creer('p', 'vide-bloc', 'Rien de planifié aujourd\'hui.')]));

  // 3. Ensuite (seulement s'il y en a)
  if (ensuite.length > 0) {
    c.append(bloc('Ensuite (les meilleures à planifier)', '',
      ensuite.map((tache) => carte(tache, aujourdhui, 'ensuite'))));
  }
}

function bloc(titre, variante, elements) {
  const section = creer('section', 'bloc');
  section.append(creer('h2', 'titre-bloc' + (variante ? ' ' + variante : ''), titre));
  const contientDesCartes = elements.length && elements[0].tagName === 'LI';
  if (contientDesCartes) {
    const liste = creer('ul', 'liste-taches');
    liste.append(...elements);
    section.append(liste);
  } else {
    section.append(...elements);
  }
  return section;
}

// Une carte : titre (avec l'heure s'il y en a une), une ligne d'informations, des boutons.
function carte(tache, aujourdhui, sorte) {
  const element = creer('li', 'carte-tache carte-action' + (sorte === 'retard' ? ' carte-retard' : ''));

  // Toucher le titre ou les informations ouvre la fiche (étape 7).
  const contenu = creer('a', 'contenu-carte lien-fiche');
  contenu.href = '#fiche/' + encodeURIComponent(tache.id);
  const titre = creer('div', 'titre-tache');
  const heure = heurePrevue(tache);
  if (heure && sorte !== 'ensuite') titre.append(creer('span', 'heure', heure));
  titre.append(document.createTextNode(tache.titre));

  const infos = [];
  if (tache.categorie) infos.push(tache.categorie);
  infos.push('intérêt ' + interet(tache));
  if (sorte === 'retard') {
    // Espaces insécables : « le 12 nov. » ne se coupe jamais en fin de ligne.
    infos.push('prévue ' + libelleJour(tache.fin || tache.debut, aujourdhui).replace(/ /g, ' '));
  }
  contenu.append(titre, creer('div', 'meta-tache', infos.join(' · ')));

  const actions = creer('div', 'actions-carte');
  if (sorte === 'ensuite') {
    actions.append(boutonCarte('+', '+ Aujourd\'hui', 'Ajouter à aujourd\'hui', () =>
      agir(tache, changementsAujourdhui(), 'Ajoutée à aujourd\'hui')));
  } else {
    actions.append(
      boutonCarte('✓', 'Fait', 'Marquer comme faite', () =>
        agir(tache, changementsFait(new Date().toISOString()), 'Tâche faite')),
      boutonCarte('→', 'Demain', 'Reporter à demain', () =>
        agir(tache, changementsDemain(tache), 'Reportée à demain'))
    );
  }

  element.append(contenu, actions);
  return element;
}

// Un bouton qui montre un symbole sur téléphone et un mot sur PC.
function boutonCarte(symbole, mot, description, action) {
  const bouton = creer('button', 'bouton-carte');
  bouton.type = 'button';
  bouton.setAttribute('aria-label', description);
  bouton.title = description;
  bouton.append(creer('span', 'libelle-court', symbole), creer('span', 'libelle-long', mot));
  bouton.addEventListener('click', action);
  return bouton;
}

// ---------- Actions ----------

// Applique les changements ; « Annuler » remet la tâche exactement comme avant.
async function agir(tache, changements, message) {
  const avant = { ...tache };
  await mettreAJourTache(tache.id, changements);
  afficherBandeau(message, async () => {
    await remettreTache(avant);
    await dessiner();
    quandCaChange();
  });
  await dessiner();
  quandCaChange();
}

// ---------- Petit outil ----------

// Crée un élément de page. Le texte est inséré tel quel (jamais interprété
// comme du code), ce qui protège contre les caractères spéciaux dans un titre.
function creer(balise, classe, contenu) {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  if (contenu instanceof Node) element.append(contenu);
  else if (contenu !== undefined) element.textContent = contenu;
  return element;
}

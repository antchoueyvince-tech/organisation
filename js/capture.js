/*
  capture.js : la fenêtre « Nouvelle tâche », utilisée depuis tous les écrans.
  - Entrée ou « Enregistrer » : la tâche part dans l'Inbox, la fenêtre reste
    ouverte et vide, prête pour la capture suivante.
  - Échap, « Fermer » ou un clic à côté : la fenêtre se ferme.
*/

import { ajouterTache } from './donnees.js';

let fenetre;
let formulaire;
let champ;
let message;
let apresAjout = () => {};
let minuterieMessage;

// À appeler une fois au démarrage. « surAjout » est appelé après chaque capture.
export function initialiserCapture({ surAjout }) {
  fenetre = document.getElementById('capture');
  formulaire = document.getElementById('formulaire-capture');
  champ = document.getElementById('champ-capture');
  message = document.getElementById('message-capture');
  if (surAjout) apresAjout = surAjout;

  formulaire.addEventListener('submit', enregistrer);
  document.getElementById('fermer-capture').addEventListener('click', fermerCapture);

  // Un clic sur le fond assombri, à côté de la fenêtre, la ferme.
  fenetre.addEventListener('click', (evenement) => {
    if (evenement.target === fenetre) fermerCapture();
  });
}

export function ouvrirCapture() {
  champ.value = '';
  afficherMessage('Entrée enregistre, Échap ferme', false);
  if (!fenetre.open) fenetre.showModal();
  champ.focus();
}

export function fermerCapture() {
  if (fenetre.open) fenetre.close();
}

export function captureEstOuverte() {
  return Boolean(fenetre && fenetre.open);
}

async function enregistrer(evenement) {
  evenement.preventDefault();
  const titre = champ.value.trim();
  if (!titre) {
    champ.focus();
    return;
  }
  // On vide le champ TOUT DE SUITE, avant même la fin de l'enregistrement :
  // si l'on tape vite la tâche suivante, les deux titres ne se mélangent pas.
  champ.value = '';
  champ.focus();
  try {
    await ajouterTache(titre);
    afficherMessage('Ajoutée à l\'Inbox', true);
    apresAjout();
  } catch (erreur) {
    console.error('La tâche n\'a pas pu être enregistrée :', erreur);
    // On rend le texte pour ne rien perdre (si rien d'autre n'a été tapé).
    if (!champ.value) champ.value = titre;
    afficherMessage('Erreur : la tâche n\'a pas été enregistrée', false);
  }
}

// Affiche un court message sous le champ ; un succès s'efface après 2 secondes.
function afficherMessage(texte, succes) {
  clearTimeout(minuterieMessage);
  message.textContent = texte;
  message.classList.toggle('succes', succes);
  if (succes) {
    minuterieMessage = setTimeout(() => afficherMessage('Entrée enregistre, Échap ferme', false), 2000);
  }
}

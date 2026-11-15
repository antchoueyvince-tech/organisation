/*
  bandeau.js : le petit message en bas de l'écran, avec un bouton « Annuler ».
  Règle de l'application : on ne demande pas « Êtes-vous sûre ? » ;
  on agit tout de suite et on laisse 5 secondes pour annuler (voir D-020).
*/

const DUREE = 5000; // 5 secondes
let minuterie;

// texte : le message ; surAnnuler : ce qu'il faut faire si l'on appuie sur « Annuler ».
export function afficherBandeau(texte, surAnnuler) {
  const bandeau = document.getElementById('bandeau');
  clearTimeout(minuterie);

  const message = document.createElement('span');
  message.textContent = texte;
  bandeau.replaceChildren(message);

  if (surAnnuler) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'bandeau-annuler';
    bouton.textContent = 'Annuler';
    bouton.addEventListener('click', () => {
      masquerBandeau();
      surAnnuler();
    });
    bandeau.append(bouton);
  }

  bandeau.classList.add('visible');
  minuterie = setTimeout(masquerBandeau, DUREE);
}

export function masquerBandeau() {
  clearTimeout(minuterie);
  document.getElementById('bandeau').classList.remove('visible');
}

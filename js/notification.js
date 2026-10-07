"use strict";

$("#app").innerHTML = `
  <div class="auth-page" style="flex-direction:column;gap:20px">
    <div class="card mail-card">
      <div class="mail-ico">${icon("mail")}</div>
      <h2>Nouvelle proposition d'aide</h2>
      <p>Bonjour Julie,</p>
      <p><b>Marc Petit</b> a proposé son aide pour votre demande « Mathématiques – L2 ».</p>
      <p class="center"><a class="btn btn-primary" href="demande.html?id=1">Voir la demande</a></p>
    </div>
    <div class="card mail-card hint">
      Vous recevez des e-mails selon votre rôle :
      <ul><li>demandeur : nouvelle proposition ;</li><li>tuteur accepté : adresse du demandeur ;</li><li>autres tuteurs : demande pourvue.</li></ul>
    </div>
  </div>`;

function efGetQrTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
}

async function efSendConfirmationEmail(qrToken) {
  if (!window.supabaseClient || !qrToken) return;

  try {
    // Appel à une edge function Supabase pour envoyer l'e-mail de confirmation
    const { error } = await window.supabaseClient.functions.invoke(
      "send-registration-email",
      {
        body: { qr_token: qrToken },
      }
    );

    if (error) {
      // On ne bloque pas l'affichage du QR si l'e-mail échoue
      // mais on laisse une trace discrète dans la console.
      console.warn("Erreur lors de l'envoi de l'e-mail de confirmation", error);
    }
  } catch (e) {
    console.warn("Erreur inattendue lors de l'appel de la fonction email", e);
  }
}

async function efSetupThankYouPage() {
  const token = efGetQrTokenFromUrl();
  const msgEl = document.getElementById("thankyou-message");

  if (!token) {
    if (msgEl) {
      msgEl.textContent =
        "Lien incomplet : il est possible que votre QR code ne puisse pas être affiché.";
    }
    return;
  }

  const canvas = document.getElementById("thankyou-qr");
  if (canvas && typeof QRCode !== "undefined") {
    try {
      await QRCode.toCanvas(canvas, token, {
        width: 220,
        margin: 1,
      });
    } catch (e) {
      console.error("Impossible de générer le QR code", e);
      if (msgEl) {
        msgEl.textContent =
          "Impossible d'afficher le QR code. Conservez tout de même cet e-mail de confirmation.";
      }
    }
  } else {
    console.warn("Bibliothèque QRCode non disponible ou canvas introuvable.");
    if (msgEl) {
      msgEl.textContent =
        "Impossible de charger la bibliothèque de QR code. Votre inscription est toutefois bien enregistrée.";
    }
  }

  if (msgEl && !msgEl.textContent) {
    msgEl.textContent =
      "Vous recevrez également un e-mail de confirmation avec ce QR code.";
  }

  await efSendConfirmationEmail(token);
}

document.addEventListener("DOMContentLoaded", efSetupThankYouPage);


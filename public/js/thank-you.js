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
  const summaryEl = document.getElementById("thankyou-event-summary");

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

  const eventInfo = await efLoadEventInfoFromToken(token, summaryEl);
  await efSendConfirmationEmail(token);

  const downloadBtn = document.getElementById("thankyou-download");
  if (downloadBtn && eventInfo) {
    downloadBtn.addEventListener("click", () =>
      efDownloadTicketPdf(eventInfo, token)
    );
  }
}

async function efLoadEventInfoFromToken(token, summaryEl) {
  if (!window.supabaseClient || !token) return null;

  try {
    const { data, error } = await window.supabaseClient
      .from("registrations")
      .select(
        "answers, event:events(titre, date_evenement, heure_evenement, lieu, adresse, latitude, longitude)"
      )
      .eq("qr_token", token)
      .maybeSingle();

    if (error || !data || !data.event) {
      console.warn("Impossible de charger les infos d'événement pour le billet", error);
      return null;
    }

    const ev = { ...data.event, answers: data.answers };

    if (summaryEl) {
      let html = "";
      html += `<strong>${ev.titre || "Événement"}</strong><br/>`;

      if (ev.date_evenement) {
        html += ev.date_evenement;
        if (ev.heure_evenement) {
          const time = String(ev.heure_evenement).slice(0, 5);
          html += ` à ${time}`;
        }
        html += "<br/>";
      }

      if (ev.lieu) {
        html += `${ev.lieu}<br/>`;
      }

      if (ev.adresse) {
        html += `${ev.adresse}<br/>`;
      }

      summaryEl.innerHTML = html;
    }

    return ev;
  } catch (e) {
    console.warn("Erreur inattendue lors du chargement des infos d'événement", e);
    return null;
  }
}

function efLoadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function efDownloadTicketPdf(ev, token) {
  if (!window.jspdf || !window.jspdf.jsPDF) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("Billet d'événement", 20, 20);

  doc.setFontSize(14);
  doc.text(ev.titre || "Événement", 20, 35);

  doc.setFontSize(11);
  let y = 45;

  if (ev.date_evenement) {
    let line = ev.date_evenement;
    if (ev.heure_evenement) {
      const time = String(ev.heure_evenement).slice(0, 5);
      line += ` à ${time}`;
    }
    doc.text(line, 20, y);
    y += 6;
  }

  if (ev.lieu) {
    doc.text(ev.lieu, 20, y);
    y += 6;
  }

  if (ev.adresse) {
    doc.text(doc.splitTextToSize(ev.adresse, 170), 20, y);
    y += 10;
  }

  // Infos du participant (on n'affiche que les valeurs)
  if (ev.answers && typeof ev.answers === "object") {
    const values = Object.values(ev.answers).filter(
      (v) => v !== null && v !== undefined && v !== ""
    );
    if (values.length) {
      doc.text("Participant :", 20, y);
      y += 6;
      doc.text(doc.splitTextToSize(values.join(" · "), 170), 20, y);
      y += 10;
    }
  }

  if (typeof ev.latitude === "number" && typeof ev.longitude === "number") {
    doc.text(
      `Coordonnées : ${ev.latitude.toFixed(5)}, ${ev.longitude.toFixed(5)}`,
      20,
      y
    );
    y += 10;
  }

  // Intègre le QR code depuis le canvas si disponible
  const canvas = document.getElementById("thankyou-qr");
  if (canvas) {
    try {
      const imgData = canvas.toDataURL("image/png");
      // Positionne le QR code à droite du texte
      doc.addImage(imgData, "PNG", 140, 30, 50, 50);
    } catch (e) {
      console.warn("Impossible d'intégrer le QR code dans le PDF", e);
    }
  }

  // Ajoute une image de carte statique centrée sur les coordonnées GPS
  if (typeof ev.latitude === "number" && typeof ev.longitude === "number") {
    const lat = ev.latitude;
    const lng = ev.longitude;
    const staticMapUrl =
      "https://staticmap.openstreetmap.de/staticmap.php?center=" +
      encodeURIComponent(lat + "," + lng) +
      "&zoom=14&size=400x250&markers=" +
      encodeURIComponent(lat + "," + lng + ",red-pushpin");

    try {
      const img = await efLoadImage(staticMapUrl);
      const mapCanvas = document.createElement("canvas");
      mapCanvas.width = img.width;
      mapCanvas.height = img.height;
      const ctx = mapCanvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const mapData = mapCanvas.toDataURL("image/png");
      // Positionne la carte sous le texte principal (en dessous des infos participant)
      doc.addImage(mapData, "PNG", 20, y, 120, 75);
    } catch (e) {
      console.warn("Impossible de charger la carte statique pour le PDF", e);
    }
  }

  doc.save("billet-evenement.pdf");
}

document.addEventListener("DOMContentLoaded", efSetupThankYouPage);


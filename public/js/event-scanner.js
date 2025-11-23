function efShowScannerMessage(type, text) {
  const box = document.getElementById("scanner-message");
  if (!box) return;
  box.textContent = text || "";
  box.className = "ef-auth-message";
  if (!text) return;
  if (type === "error") {
    box.classList.add("ef-auth-message-error");
  } else {
    box.classList.add("ef-auth-message-success");
  }
}

async function efHandleScanSuccess(decodedText, decodedResult, html5QrcodeScanner) {
  if (!decodedText) return;

  if (!window.supabaseClient) {
    efShowScannerMessage(
      "error",
      "Client Supabase non initialisé. Vérifiez la configuration."
    );
    return;
  }

  // On arrête temporairement le scanner pendant le traitement
  if (html5QrcodeScanner) {
    html5QrcodeScanner.clear().catch(() => {});
  }

  efShowScannerMessage("", "");

  try {
    const { data, error } = await window.supabaseClient.rpc("checkin", {
      p_qr_token: decodedText,
    });

    if (error) {
      efShowScannerMessage(
        "error",
        "Impossible d'enregistrer la présence : " +
          (error.message || "erreur inconnue.")
      );
    } else if (data && data.status === "ok") {
      efShowScannerMessage(
        "success",
        data.message || "Présence enregistrée. Bienvenue !"
      );
    } else if (data && data.status === "already") {
      efShowScannerMessage(
        "error",
        data.message || "Ce billet a déjà été scanné."
      );
    } else {
      efShowScannerMessage(
        "error",
        "Le code scanné n'est pas reconnu comme un billet valide."
      );
    }
  } catch (e) {
    efShowScannerMessage(
      "error",
      "Erreur inattendue lors du checkin : " + e.message
    );
  }

  // Redémarre le scanner après un court délai pour laisser lire le message
  setTimeout(efSetupScanner, 1500);
}

function efSetupScanner() {
  const qrRegionId = "qr-reader";
  const el = document.getElementById(qrRegionId);
  if (!el || typeof Html5QrcodeScanner === "undefined") {
    return;
  }

  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    rememberLastUsedCamera: true,
  };

  const scanner = new Html5QrcodeScanner(qrRegionId, config, false);

  scanner.render(
    (decodedText, decodedResult) =>
      efHandleScanSuccess(decodedText, decodedResult, scanner),
    (errorMessage) => {
      // erreurs de scan ignorées, on ne spam pas l'UI
      // console.debug("Scan error", errorMessage);
    }
  );
}

document.addEventListener("DOMContentLoaded", efSetupScanner);


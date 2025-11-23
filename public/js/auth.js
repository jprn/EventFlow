function efShowMessage(type, text) {
  const box = document.getElementById("auth-message");
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

async function efHandlePasswordLogin(event) {
  event.preventDefault();

  if (!window.supabaseClient) {
    efShowMessage(
      "error",
      "Le client Supabase n'est pas initialisé. Vérifiez la configuration."
    );
    return;
  }

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value : "";

  if (!email || !password) {
    efShowMessage("error", "Veuillez renseigner l'e-mail et le mot de passe.");
    return;
  }

  efShowMessage("", "");

  const { data, error } = await window.supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    efShowMessage(
      "error",
      "Connexion impossible : " + (error.message || "erreur inconnue.")
    );
    return;
  }

  if (data && data.session) {
    window.location.href = "dashboard.html";
  } else {
    efShowMessage(
      "error",
      "Connexion échouée. Vérifiez vos identifiants et réessayez."
    );
  }
}

async function efHandleMagicLink(event) {
  event.preventDefault();

  if (!window.supabaseClient) {
    efShowMessage(
      "error",
      "Le client Supabase n'est pas initialisé. Vérifiez la configuration."
    );
    return;
  }

  const emailInput = document.getElementById("email");
  const email = emailInput ? emailInput.value.trim() : "";

  if (!email) {
    efShowMessage(
      "error",
      "Veuillez renseigner votre adresse e-mail pour recevoir un lien magique."
    );
    return;
  }

  efShowMessage("", "");

  const redirectTo = window.location.origin + "/public/dashboard.html";

  const { error } = await window.supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    efShowMessage(
      "error",
      "Impossible d'envoyer le lien magique : " +
        (error.message || "erreur inconnue.")
    );
    return;
  }

  efShowMessage(
    "success",
    "Un lien de connexion vient de vous être envoyé par e-mail."
  );
}

function efSetupAuthPage() {
  const form = document.querySelector(".ef-form");
  const magicButton = document.getElementById("magic-link-button");

  if (form) {
    form.addEventListener("submit", efHandlePasswordLogin);
  }

  if (magicButton) {
    magicButton.addEventListener("click", efHandleMagicLink);
  }
}

document.addEventListener("DOMContentLoaded", efSetupAuthPage);


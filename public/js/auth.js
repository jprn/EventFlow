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

  // Récupère le plan choisi depuis l'URL (par défaut: free)
  const params = new URLSearchParams(window.location.search);
  const chosenPlan = params.get("plan") || "free";

  // Si plan payant (pro, business), on exige une simulation de paiement
  const isPaidPlan = chosenPlan === "pro" || chosenPlan === "business";
  if (isPaidPlan && !window.efSignupPaymentSimOk) {
    const paymentBlock = document.getElementById("signup-payment-sim");
    if (paymentBlock) {
      paymentBlock.style.display = "block";
      paymentBlock.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    efShowMessage(
      "error",
      "Avant de créer un compte sur un plan payant, veuillez valider le paiement (simulation)."
    );
    return;
  }

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

async function efHandleSignUp(event) {
  event.preventDefault();

  if (!window.supabaseClient) {
    efShowMessage(
      "error",
      "Le client Supabase n'est pas initialisé. Vérifiez la configuration."
    );
    return;
  }

  const emailInput = document.getElementById("signup-email");
  const passwordInput = document.getElementById("signup-password");
  const confirmInput = document.getElementById("signup-password-confirm");

  const email = emailInput ? emailInput.value.trim() : "";
  const password = passwordInput ? passwordInput.value : "";
  const confirm = confirmInput ? confirmInput.value : "";

  if (!email || !password || !confirm) {
    efShowMessage(
      "error",
      "Veuillez renseigner l'e-mail et les deux champs de mot de passe."
    );
    return;
  }

  if (password !== confirm) {
    efShowMessage("error", "Les mots de passe ne correspondent pas.");
    return;
  }

  if (password.length < 6) {
    efShowMessage(
      "error",
      "Le mot de passe doit contenir au moins 6 caractères."
    );
    return;
  }

  efShowMessage("", "");

  const { data, error } = await window.supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        initial_plan: chosenPlan,
      },
    },
  });

  if (error) {
    efShowMessage(
      "error",
      "Impossible de créer le compte : " + (error.message || "erreur inconnue.")
    );
    return;
  }

  // Inscription réussie : on retourne toujours sur la page de connexion
  // L'utilisateur pourra se connecter après avoir confirmé son e-mail si nécessaire.
  window.location.href = "login.html";
}

async function efHandleLogout() {
  if (!window.supabaseClient) {
    window.location.href = "login.html";
    return;
  }

  await window.supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

function efSetupAuthPage() {
  const form = document.querySelector(".ef-form");
  const magicButton = document.getElementById("magic-link-button");

  const signupForm = document.getElementById("signup-form");
  const isSignupPage = !!signupForm;

  if (form && !isSignupPage) {
    form.addEventListener("submit", efHandlePasswordLogin);
  }

  if (signupForm) {
    signupForm.addEventListener("submit", efHandleSignUp);
  }

  // Simulation de paiement sur la page signup (pour plans pro/business)
  if (isSignupPage) {
    const params = new URLSearchParams(window.location.search);
    const chosenPlan = params.get("plan") || "free";
    const isPaidPlan = chosenPlan === "pro" || chosenPlan === "business";

    const paymentBlock = document.getElementById("signup-payment-sim");
    const paymentBtn = document.getElementById("signup-payment-simulate-button");

    if (paymentBlock && isPaidPlan) {
      paymentBlock.style.display = "block";
    }

    if (paymentBtn && isPaidPlan) {
      paymentBtn.addEventListener("click", () => {
        const name = document.getElementById("signup-payment-name");

        if (name && !name.value.trim()) {
          efShowMessage(
            "error",
            "Veuillez renseigner au moins le nom sur la carte pour la simulation."
          );
          return;
        }

        window.efSignupPaymentSimOk = true;
        efShowMessage(
          "success",
          "Paiement simulé avec succès. Vous pouvez maintenant créer votre compte."
        );
      });
    }
  }

  if (magicButton) {
    magicButton.addEventListener("click", efHandleMagicLink);
  }

  // Bouton Déconnexion (header espace organisateur)
  const logoutButtons = document.querySelectorAll(".ef-nav .ef-link-button");
  logoutButtons.forEach((btn) => {
    btn.addEventListener("click", efHandleLogout);
  });
}

document.addEventListener("DOMContentLoaded", efSetupAuthPage);


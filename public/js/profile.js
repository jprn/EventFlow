function efShowProfileMessage(type, text) {
  const box = document.getElementById("profile-message");
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

async function efLoadProfile() {
  if (!window.supabaseClient) return;

  const {
    data: { session },
    error,
  } = await window.supabaseClient.auth.getSession();

  if (error || !session || !session.user) {
    // Pas de session : on renvoie vers la connexion
    window.location.href = "login.html";
    return;
  }

  const user = session.user;
  const emailInput = document.getElementById("profile-email");
  const nameInput = document.getElementById("profile-name");
  const orgInput = document.getElementById("profile-org");

  if (emailInput) emailInput.value = user.email || "";
  const metadata = user.user_metadata || {};
  if (nameInput) nameInput.value = metadata.full_name || "";
  if (orgInput) orgInput.value = metadata.organization || "";
}

async function efHandleProfileSubmit(event) {
  event.preventDefault();

  if (!window.supabaseClient) return;

  const nameInput = document.getElementById("profile-name");
  const orgInput = document.getElementById("profile-org");
  const passInput = document.getElementById("profile-password");
  const passConfInput = document.getElementById("profile-password-confirm");

  const full_name = nameInput ? nameInput.value.trim() : "";
  const organization = orgInput ? orgInput.value.trim() : "";
  const newPassword = passInput ? passInput.value : "";
  const confirmPassword = passConfInput ? passConfInput.value : "";

  if (newPassword || confirmPassword) {
    if (newPassword !== confirmPassword) {
      efShowProfileMessage("error", "Les mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 6) {
      efShowProfileMessage(
        "error",
        "Le mot de passe doit contenir au moins 6 caractères."
      );
      return;
    }
  }

  efShowProfileMessage("", "");

  const updatePayload = {
    data: {
      full_name,
      organization,
    },
  };

  if (newPassword) {
    updatePayload.password = newPassword;
  }

  const { error } = await window.supabaseClient.auth.updateUser(updatePayload);

  if (error) {
    efShowProfileMessage(
      "error",
      "Impossible de mettre à jour le profil : " +
        (error.message || "erreur inconnue.")
    );
    return;
  }

  // Nettoie les champs mots de passe après succès
  if (passInput) passInput.value = "";
  if (passConfInput) passConfInput.value = "";

  efShowProfileMessage("success", "Profil mis à jour avec succès.");
}

function efSetupProfilePage() {
  efLoadProfile();
  const form = document.getElementById("profile-form");
  if (form) {
    form.addEventListener("submit", efHandleProfileSubmit);
  }
}

document.addEventListener("DOMContentLoaded", efSetupProfilePage);

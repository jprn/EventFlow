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
    window.location.href = "login.html";
    return;
  }

  const user = session.user;
  const emailInput = document.getElementById("profile-email");
  const nameInput = document.getElementById("profile-name");
  const orgInput = document.getElementById("profile-org");
  const planBadge = document.getElementById("profile-plan");
  const planSelect = document.getElementById("profile-plan-select");

  if (emailInput) emailInput.value = user.email || "";

  const { data: profile, error: profileError } = await window.supabaseClient
    .from("profiles")
    .select("full_name, organization, plan")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profileError && profile) {
    if (nameInput) nameInput.value = profile.full_name || "";
    if (orgInput) orgInput.value = profile.organization || "";
    const plan = profile.plan || "free";
    if (planBadge) {
      let label = "";
      switch (plan) {
        case "event":
          label = "Pack Événement";
          break;
        case "pro":
          label = "Pro";
          break;
        case "business":
          label = "Business";
          break;
        default:
          label = "Gratuit";
      }
      planBadge.textContent = label;
    }
    if (planSelect) {
      planSelect.value = plan;
    }
    window.efCurrentPlan = plan;
  }
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
  const plan = planSelect ? planSelect.value : undefined;
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

  const {
    data: { session },
    error: sessionError,
  } = await window.supabaseClient.auth.getSession();

  if (sessionError || !session || !session.user) {
    window.location.href = "login.html";
    return;
  }

  const userId = session.user.id;

  const { error: profileError } = await window.supabaseClient
    .from("profiles")
    .upsert({
      user_id: userId,
      full_name,
      organization,
      plan,
    });

  if (profileError) {
    efShowProfileMessage(
      "error",
      "Impossible de mettre à jour le profil : " +
        (profileError.message || "erreur inconnue.")
    );
    return;
  }

  if (newPassword) {
    const { error: pwError } = await window.supabaseClient.auth.updateUser({
      password: newPassword,
    });

    if (pwError) {
      efShowProfileMessage(
        "error",
        "Profil mis à jour, mais le mot de passe n'a pas pu être modifié : " +
          (pwError.message || "erreur inconnue.")
      );
      return;
    }
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

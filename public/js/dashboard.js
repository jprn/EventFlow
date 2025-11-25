async function efRequireAuth() {
  if (!window.supabaseClient) {
    window.location.href = "login.html";
    return null;
  }

  const { data, error } = await window.supabaseClient.auth.getUser();

  if (error || !data || !data.user) {
    window.location.href = "login.html";
    return null;
  }

  return data.user;
}

function efRenderEmptyEvents(containerId, message) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const empty = document.createElement("div");
  empty.className = "ef-table-empty";
  empty.textContent = message;
  container.appendChild(empty);
}

function efRenderEvents(containerId, events) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  if (!events || events.length === 0) {
    const msg =
      containerId === "dashboard-events-future"
        ? "Aucun événement à venir."
        : "Aucun événement passé.";
    efRenderEmptyEvents(containerId, msg);
    return;
  }

  const list = document.createElement("div");
  list.className = "ef-events-list";

  const isPastContainer = containerId === "dashboard-events-past";

  events.forEach((event) => {
    const card = document.createElement("article");
    card.className = "ef-event-card";

    const header = document.createElement("div");
    header.className = "ef-event-card-header";

    const titleWrapper = document.createElement("div");
    const link = document.createElement("a");
    link.href = "event-view.html?id=" + encodeURIComponent(event.id);
    link.textContent = event.titre || "Sans titre";
    link.className = "ef-event-card-title";
    titleWrapper.appendChild(link);

    const meta = document.createElement("div");
    meta.className = "ef-event-card-meta";
    let dateText = event.date_evenement || "Date à définir";
    if (event.heure_evenement) {
      const time = String(event.heure_evenement).slice(0, 5); // HH:MM
      dateText += " · " + time;
    }
    const dateSpan = document.createElement("span");
    dateSpan.textContent = dateText;
    const lieuSpan = document.createElement("span");
    if (event.lieu) {
      lieuSpan.textContent = event.lieu;
    }
    meta.appendChild(dateSpan);
    if (event.lieu) {
      const sep = document.createElement("span");
      sep.textContent = " · ";
      meta.appendChild(sep);
      meta.appendChild(lieuSpan);
    }

    titleWrapper.appendChild(meta);

    const badge = document.createElement("span");
    badge.className = "ef-badge ef-event-status";
    badge.textContent = isPastContainer ? "Passé" : "À venir";

    header.appendChild(titleWrapper);
    header.appendChild(badge);

    const body = document.createElement("div");
    body.className = "ef-event-card-body";

    const count = document.createElement("div");
    count.className = "ef-event-card-count";
    const total =
      typeof event.inscriptions_total === "number"
        ? event.inscriptions_total
        : 0;
    count.textContent = `${total} inscrit${total > 1 ? "s" : ""}`;

    const actions = document.createElement("div");
    actions.className = "ef-event-card-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "ef-btn ef-btn-secondary";
    editBtn.textContent = "✏️";
    editBtn.title = "Modifier l'événement";
    editBtn.addEventListener("click", () => {
      window.location.href =
        "new-event.html?id=" + encodeURIComponent(event.id);
    });

    const scannerBtn = document.createElement("button");
    scannerBtn.type = "button";
    scannerBtn.className = "ef-btn ef-btn-secondary";
    scannerBtn.textContent = "📷";
    scannerBtn.title = "Ouvrir le scanner QR";
    scannerBtn.addEventListener("click", () => {
      window.location.href = `event-scanner.html?id=${encodeURIComponent(
        event.id
      )}`;
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "ef-btn ef-btn-danger";
    deleteBtn.textContent = "🗑";
    deleteBtn.title = "Supprimer l'événement";
    deleteBtn.addEventListener("click", () => efDeleteEvent(event.id));

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "ef-btn ef-btn-secondary";
    copyBtn.textContent = "🔗";
    copyBtn.title = "Copier l'URL publique";
    copyBtn.addEventListener("click", () => efCopyPublicUrl(event.slug));

    if (isPastContainer) {
      editBtn.disabled = true;
      copyBtn.disabled = true;
      scannerBtn.disabled = true;
      editBtn.classList.add("ef-btn-disabled");
      copyBtn.classList.add("ef-btn-disabled");
      scannerBtn.classList.add("ef-btn-disabled");
    }

    actions.appendChild(editBtn);
    actions.appendChild(scannerBtn);
    actions.appendChild(deleteBtn);
    actions.appendChild(copyBtn);

    body.appendChild(count);
    body.appendChild(actions);

    // Clic sur la carte : ouverture de la vue événement
    card.addEventListener("click", () => {
      window.location.href =
        "event-view.html?id=" + encodeURIComponent(event.id);
    });

    // Évite que les clics sur les boutons d'actions déclenchent le clic carte
    actions.addEventListener("click", (ev) => {
      ev.stopPropagation();
    });

    card.appendChild(header);
    card.appendChild(body);

    list.appendChild(card);
  });

  container.appendChild(list);
}

async function efCopyPublicUrl(slug) {
  if (!slug) return;
  const base = window.location.origin.replace(/\/$/, "");
  const url = base + "/" + slug;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
    }
    window.alert("Adresse publique copiée dans le presse-papiers.");
  } catch (_) {
    window.alert(
      "Impossible de copier l'adresse. Copiez-la manuellement : \n" + url
    );
  }
}

async function efDeleteEvent(eventId) {
  if (!window.supabaseClient) return;

  const ok = window.confirm(
    "Voulez-vous vraiment supprimer cet événement ? Cette action est définitive."
  );
  if (!ok) return;

  const { error } = await window.supabaseClient
    .from("events")
    .delete()
    .eq("id", eventId);

  if (error) {
    window.alert(
      "Impossible de supprimer l'événement : " + (error.message || "erreur inconnue.")
    );
    return;
  }

  await efLoadDashboard();
}

async function efLoadDashboard() {
  const user = await efRequireAuth();
  if (!user) return;

  // Message de bienvenue personnalisé
  const greetingEl = document.getElementById("ef-dashboard-greeting");
  if (greetingEl) {
    const meta = user.user_metadata || {};
    const fullNameFromMeta = meta.full_name || meta.fullname || "";
    const firstName = meta.first_name || meta.prenom || "";
    const lastName = meta.last_name || meta.nom || "";
    const fallbackComposed = `${firstName} ${lastName}`.trim();
    const displayName = (fullNameFromMeta || fallbackComposed).trim();

    let greetingName = "";

    if (fullNameFromMeta) {
      // Si full_name est défini dans Supabase, on l'utilise en priorité
      greetingName = fullNameFromMeta.toUpperCase();
    } else if (displayName) {
      // Sinon on extrait au moins le nom de famille en majuscules
      const parts = displayName.split(/\s+/).filter(Boolean);
      if (parts.length > 0) {
        greetingName = parts[parts.length - 1].toUpperCase();
      }
    }

    if (greetingName) {
      greetingEl.textContent = `Bonjour, ${greetingName} 👋`;
    } else {
      greetingEl.textContent = "Bonjour 👋";
    }
  }

  // Récupère le plan de l'utilisateur pour appliquer les limites
  let plan = "free";
  try {
    const { data: profile, error: profileError } = await window.supabaseClient
      .from("profiles")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profileError && profile && profile.plan) {
      plan = profile.plan;
    } else if (!profileError && !profile) {
      // Aucun profil en base : on récupère le plan initial dans les metadata
      const meta = user.user_metadata || {};
      const initialPlan = meta.initial_plan || "free";
      plan = initialPlan;

      try {
        await window.supabaseClient.from("profiles").insert({
          user_id: user.id,
          plan: initialPlan,
        });
      } catch (e) {
        // ignore
      }
    }
  } catch (e) {
    // en cas d'erreur, on reste sur le plan par défaut "free"
  }

  window.efCurrentPlan = plan;

  const statsEls = document.querySelectorAll(".ef-dashboard-stats .ef-stat-value");

  const { data, error } = await window.supabaseClient
    .from("events")
    .select("id, titre, slug, date_evenement, heure_evenement, lieu, registrations(count)")
    .eq("owner_id", user.id)
    .order("date_evenement", { ascending: true });

  if (error) {
    efRenderEmptyEvents("dashboard-events-future", "Aucun événement à venir.");
    efRenderEmptyEvents("dashboard-events-past", "Aucun événement passé.");
    if (statsEls[0]) statsEls[0].textContent = "0";
    if (statsEls[1]) statsEls[1].textContent = "0";
    if (statsEls[2]) statsEls[2].textContent = "0%";
    return;
  }

  const rawEvents = data || [];

  const events = rawEvents.map((ev) => {
    let inscriptions_total = 0;
    if (Array.isArray(ev.registrations) && ev.registrations[0]) {
      const c = ev.registrations[0].count;
      if (typeof c === "number") inscriptions_total = c;
    }
    return { ...ev, inscriptions_total };
  });

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureEvents = [];
  const pastEvents = [];

  for (const ev of events) {
    if (!ev.date_evenement) {
      futureEvents.push(ev);
      continue;
    }

    // Combine la date et l'heure pour savoir si l'événement est déjà passé
    const eventDateTime = new Date(ev.date_evenement);
    if (ev.heure_evenement) {
      const timeStr = String(ev.heure_evenement).slice(0, 5); // HH:MM
      const [h, m] = timeStr.split(":");
      eventDateTime.setHours(Number(h) || 0, Number(m) || 0, 0, 0);
    } else {
      // S'il n'y a pas d'heure, on considère minuit
      eventDateTime.setHours(0, 0, 0, 0);
    }

    if (eventDateTime >= now) {
      futureEvents.push(ev);
    } else {
      pastEvents.push(ev);
    }
  }

  efRenderEvents("dashboard-events-future", futureEvents);
  efRenderEvents("dashboard-events-past", pastEvents);

  // Statistiques globales (événements à venir uniquement)
  let totalRegistrations = 0;
  let totalPresent = 0;

  if (futureEvents.length > 0) {
    const futureIds = futureEvents.map((ev) => ev.id);
    try {
      const { data: regs, error: regsError } = await window.supabaseClient
        .from("registrations")
        .select("id, checked_in_at")
        .in("event_id", futureIds);

      if (!regsError && Array.isArray(regs)) {
        totalRegistrations = regs.length;
        totalPresent = regs.filter((r) => !!r.checked_in_at).length;
      }
    } catch (e) {
      // en cas d'erreur, on laisse les compteurs à 0
    }
  }

  const rate = totalRegistrations
    ? Math.round((totalPresent / totalRegistrations) * 100)
    : 0;

  // Mise à jour du résumé de plan dans le tableau de bord
  const planBox = document.getElementById("ef-plan-summary");
  if (planBox) {
    let title = "Plan actuel";
    let description = "";

    switch (plan) {
      case "free":
        title = "Plan Gratuit";
        description =
          "1 événement actif à la fois et jusqu'à environ 50 inscrits sur vos événements à venir.";
        break;
      case "event":
        title = "Pack Événement";
        description =
          "Idéal pour un événement ponctuel : jusqu'à environ 300 inscriptions sur vos événements à venir, avec accès aux exports et aux statistiques détaillées par événement.";
        break;
      case "pro":
        title = "Plan Pro";
        description =
          "Événements illimités et jusqu'à environ 5000 inscriptions à venir, avec accès aux statistiques globales Pro, aux statistiques par événement et aux exports.";
        break;
      case "business":
        title = "Plan Business";
        description =
          "Événements et inscriptions illimités (usage normal), avec toutes les statistiques Pro et les exports. Idéal pour les structures qui pilotent plusieurs équipes.";
        break;
      default:
        description =
          "Plan inconnu : certaines limites peuvent s'appliquer. Mettez à jour votre plan dans la page Profil si nécessaire.";
    }

    planBox.innerHTML = "";
    const h2 = document.createElement("h2");
    h2.textContent = title;
    const p = document.createElement("p");
    p.textContent = description;
    planBox.appendChild(h2);
    planBox.appendChild(p);
  }

  // Limites par plan pour le nombre d'événements
  // Nouveau modèle :
  // - Gratuit : 1 événement actif
  // - Pack Événement : pas de limite stricte d'événements dans cette V1
  // - Pro / Business : événements illimités
  let maxEvents;
  switch (plan) {
    case "free":
      maxEvents = 1;
      break;
    default:
      maxEvents = Infinity;
  }

  // On applique la limite sur le nombre total d'événements de l'organisateur
  const totalEventsCount = events.length;

  // Désactivation du bouton "Créer un nouvel événement" si la limite est atteinte
  const createBtn = document.getElementById("ef-create-event-btn");
  if (createBtn && typeof maxEvents === "number") {
    if (totalEventsCount >= maxEvents && maxEvents !== Infinity) {
      createBtn.classList.add("ef-btn-disabled");
      createBtn.addEventListener("click", (e) => {
        e.preventDefault();
        let msg = "Votre plan actuel ne vous permet pas de créer plus d'événements.";
        if (plan === "free") {
          msg =
            "Votre plan Gratuit permet de créer 1 événement actif. Passez à un plan supérieur pour gérer plusieurs événements.";
        }
        window.alert(msg);
      });
    }
  }

  // Limites par plan pour le nombre d'inscriptions (total futur)
  // On approxime les règles par un plafond global sur les inscriptions à venir :
  // - Gratuit : ~50 inscrits
  // - Pack Événement : ~300 inscrits
  // - Pro : ~5000 inscrits
  // - Business : illimité
  let maxRegistrations;
  switch (plan) {
    case "free":
      maxRegistrations = 50;
      break;
    case "event":
      maxRegistrations = 300;
      break;
    case "pro":
      maxRegistrations = 5000;
      break;
    case "business":
      maxRegistrations = Infinity;
      break;
    default:
      maxRegistrations = 50;
  }

  if (statsEls[0]) statsEls[0].textContent = String(futureEvents.length);

  if (statsEls[1]) {
    if (maxRegistrations === Infinity) {
      statsEls[1].textContent = String(totalRegistrations);
    } else {
      statsEls[1].textContent = `${totalRegistrations} / ${maxRegistrations}`;
    }
  }

  if (statsEls[2]) statsEls[2].textContent = `${rate}%`;
}

document.addEventListener("DOMContentLoaded", efLoadDashboard);


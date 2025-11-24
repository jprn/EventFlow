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

  const table = document.createElement("table");
  table.className = "ef-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headers = ["Titre", "Date / heure", "Lieu", "Inscriptions", "Actions"];

  headers.forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  events.forEach((event) => {
    const tr = document.createElement("tr");

    const tdTitle = document.createElement("td");
    const link = document.createElement("a");
    link.href = "event-view.html?id=" + encodeURIComponent(event.id);
    link.textContent = event.titre || "Sans titre";
    tdTitle.appendChild(link);

    const tdDate = document.createElement("td");
    let dateText = event.date_evenement || "-";
    if (event.heure_evenement) {
      const time = String(event.heure_evenement).slice(0, 5); // HH:MM
      dateText += " " + time;
    }
    tdDate.textContent = dateText;

    const tdLieu = document.createElement("td");
    tdLieu.textContent = event.lieu || "-";

    const tdCount = document.createElement("td");
    if (typeof event.inscriptions_total === "number") {
      tdCount.textContent = String(event.inscriptions_total);
    } else {
      tdCount.textContent = "-";
    }

    const tdActions = document.createElement("td");

    const actionsWrapper = document.createElement("div");
    actionsWrapper.style.display = "inline-flex";
    actionsWrapper.style.gap = "0.35rem";

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

    // Pour les événements passés, on désactive Modifier et Copier l'URL
    const isPastContainer = containerId === "dashboard-events-past";
    if (isPastContainer) {
      editBtn.disabled = true;
      copyBtn.disabled = true;
      scannerBtn.disabled = true;
      editBtn.classList.add("ef-btn-disabled");
      copyBtn.classList.add("ef-btn-disabled");
      scannerBtn.classList.add("ef-btn-disabled");
    }

    actionsWrapper.appendChild(editBtn);
    actionsWrapper.appendChild(scannerBtn);
    actionsWrapper.appendChild(deleteBtn);
    actionsWrapper.appendChild(copyBtn);

    tdActions.appendChild(actionsWrapper);

    tr.appendChild(tdTitle);
    tr.appendChild(tdDate);
    tr.appendChild(tdLieu);
    tr.appendChild(tdCount);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureEvents = [];
  const pastEvents = [];

  for (const ev of events) {
    if (!ev.date_evenement) {
      futureEvents.push(ev);
      continue;
    }
    const d = new Date(ev.date_evenement);
    d.setHours(0, 0, 0, 0);
    if (d >= today) {
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

  // Limites par plan pour le nombre d'événements actifs
  let maxEvents;
  switch (plan) {
    case "pro":
      maxEvents = 5;
      break;
    case "business":
      maxEvents = Infinity;
      break;
    default:
      maxEvents = 1; // plan gratuit ou inconnu
  }

  const activeEventsCount = futureEvents.length;

  // Désactivation du bouton "Créer un nouvel événement" si la limite est atteinte
  const createBtn = document.querySelector('a[href="new-event.html"]');
  if (createBtn && typeof maxEvents === "number") {
    if (activeEventsCount >= maxEvents && maxEvents !== Infinity) {
      createBtn.classList.add("ef-btn-disabled");
      createBtn.addEventListener("click", (e) => {
        e.preventDefault();
        let msg = "Votre plan actuel ne vous permet pas de créer plus d'événements.";
        if (plan === "free") {
          msg =
            "Votre plan Gratuit permet de créer 1 événement actif. Passez à un plan supérieur pour en créer davantage.";
        } else if (plan === "pro") {
          msg =
            "Votre plan Pro permet de créer jusqu'à 5 événements actifs. Passez au plan Business pour aller au-delà.";
        }
        window.alert(msg);
      });
    }
  }

  // Limites par plan pour le nombre d'inscriptions (total futur)
  let maxRegistrations;
  switch (plan) {
    case "pro":
      maxRegistrations = 500;
      break;
    case "business":
      maxRegistrations = Infinity;
      break;
    default:
      maxRegistrations = 25; // plan gratuit ou inconnu
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


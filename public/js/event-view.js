let efEventRegs = [];
let efEventRegsFilter = "all";
let efEventRegsChannel = null;

function efGetEventIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function efShowEventViewMessage(type, text) {
  const box = document.getElementById("event-view-message");
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

async function efLoadEventView() {
  if (!window.supabaseClient) return;

  const eventId = efGetEventIdFromUrl();
  if (!eventId) {
    efShowEventViewMessage(
      "error",
      "Impossible d'afficher l'événement (paramètre id manquant)."
    );
    return;
  }

  const { data: event, error } = await window.supabaseClient
    .from("events")
    .select("titre, date_evenement, heure_evenement, lieu")
    .eq("id", eventId)
    .maybeSingle();

  if (error || !event) {
    efShowEventViewMessage(
      "error",
      "Cet événement est introuvable ou n'est plus accessible."
    );
    return;
  }

  const titleEl = document.getElementById("event-view-title");
  const metaEl = document.getElementById("event-view-meta");

  if (titleEl) {
    titleEl.textContent = event.titre || "Vue d'ensemble de l'événement";
  }

  if (metaEl) {
    let meta = "";
    if (event.date_evenement) {
      meta += event.date_evenement;
      if (event.heure_evenement) {
        const time = String(event.heure_evenement).slice(0, 5);
        meta += " à " + time;
      }
    }
    if (event.lieu) {
      if (meta) meta += " · ";
      meta += event.lieu;
    }
    metaEl.textContent = meta;
  }

  await efLoadEventRegistrations(eventId);
  efSetupEventViewFilters();
}

function efSetupEventViewPage() {
  efLoadEventView();
  efUpdateEventSidebarLinks();
}

function efUpdateEventSidebarLinks() {
  const eventId = efGetEventIdFromUrl();
  if (!eventId) return;

  const links = document.querySelectorAll(".ef-sidebar-nav a");
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;

    const url = new URL(href, window.location.href);
    url.searchParams.set("id", eventId);
    link.setAttribute("href", url.pathname + url.search);
  });
}

async function efLoadEventRegistrations(eventId) {
  const container = document.getElementById("event-view-registrations");
  if (!container || !window.supabaseClient) return;

  container.innerHTML = "";

  const { data, error } = await window.supabaseClient
    .from("registrations")
    .select("id, created_at, answers, checked_in_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error) {
    const empty = document.createElement("div");
    empty.className = "ef-table-empty";
    empty.textContent =
      "Impossible de charger les inscriptions pour le moment.";
    container.appendChild(empty);
    return;
  }

  efEventRegs = data || [];
  efRenderEventRegistrations();

  // Abonnement temps réel aux inscriptions de cet événement
  if (!efEventRegsChannel && window.supabaseClient) {
    efEventRegsChannel = window.supabaseClient
      .channel("event-registrations-" + eventId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registrations",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            efEventRegs.push(payload.new);
          } else if (payload.eventType === "UPDATE") {
            const idx = efEventRegs.findIndex((r) => r.id === payload.new.id);
            if (idx !== -1) {
              efEventRegs[idx] = payload.new;
            }
          } else if (payload.eventType === "DELETE") {
            efEventRegs = efEventRegs.filter((r) => r.id !== payload.old.id);
          }
          efRenderEventRegistrations();
        }
      )
      .subscribe();
  }
}

function efRenderEventRegistrations() {
  const container = document.getElementById("event-view-registrations");
  if (!container) return;

  container.innerHTML = "";

  if (!efEventRegs || efEventRegs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "ef-table-empty";
    empty.textContent = "Aucune inscription pour le moment.";
    container.appendChild(empty);
    efUpdateEventCounts();
    return;
  }

  const filtered = efEventRegs.filter((reg) => {
    if (efEventRegsFilter === "present") {
      return !!reg.checked_in_at;
    }
    if (efEventRegsFilter === "absent") {
      return !reg.checked_in_at;
    }
    return true;
  });

  efUpdateEventCounts();

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "ef-table-empty";
    empty.textContent = "Aucune inscription pour ce filtre.";
    container.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "ef-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Date", "Détails", "Présence"].forEach((label, index) => {
    const th = document.createElement("th");
    th.textContent = label;
    if (index === 2) {
      th.style.textAlign = "center";
    }
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  filtered.forEach((reg) => {
    const tr = document.createElement("tr");

    const tdDate = document.createElement("td");
    const d = new Date(reg.created_at);
    const dateStr = d.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const timeStr = d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    tdDate.textContent = `${dateStr} ${timeStr}`;

    const tdDetails = document.createElement("td");
    const answers = reg.answers || {};
    const parts = [];
    Object.keys(answers).forEach((key) => {
      const val = answers[key];
      if (val === null || val === undefined || val === "") return;
      parts.push(String(val));
    });
    tdDetails.textContent = parts.join(" · ");

    const tdPresence = document.createElement("td");
    tdPresence.style.textAlign = "center";
    if (reg.checked_in_at) {
      tdPresence.textContent = "✅ Présent";
      tdPresence.style.color = "#15803d"; // vert
    } else {
      tdPresence.textContent = "❌ Non scanné";
      tdPresence.style.color = "#b91c1c"; // rouge
    }

    tr.appendChild(tdDate);
    tr.appendChild(tdDetails);
    tr.appendChild(tdPresence);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

function efUpdateEventCounts() {
  const total = efEventRegs.length;
  const present = efEventRegs.filter((r) => !!r.checked_in_at).length;
  const absent = total - present;

  const totalEl = document.getElementById("ev-count-total");
  const presentEl = document.getElementById("ev-count-present");
  const absentEl = document.getElementById("ev-count-absent");

  if (totalEl) totalEl.textContent = `Total : ${total}`;
  if (presentEl) presentEl.textContent = `Présents : ${present}`;
  if (absentEl) absentEl.textContent = `Non scannés : ${absent}`;
}

function efSetupEventViewFilters() {
  const buttons = document.querySelectorAll(".ev-filter-btn");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const value = btn.getAttribute("data-ev-filter") || "all";
      efEventRegsFilter = value;

      buttons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      efRenderEventRegistrations();
    });
  });
}

document.addEventListener("DOMContentLoaded", efSetupEventViewPage);


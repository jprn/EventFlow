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
    .select("created_at, answers")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) {
    const empty = document.createElement("div");
    empty.className = "ef-table-empty";
    empty.textContent = "Aucune inscription pour le moment.";
    container.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "ef-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Date", "Détails"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  data.forEach((reg) => {
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

    tr.appendChild(tdDate);
    tr.appendChild(tdDetails);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

document.addEventListener("DOMContentLoaded", efSetupEventViewPage);


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
  const headers = ["Titre", "Date", "Lieu", "Inscriptions", "Actions"];

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
    tdDate.textContent = event.date_evenement || "-";

    const tdLieu = document.createElement("td");
    tdLieu.textContent = event.lieu || "-";

    const tdCount = document.createElement("td");
    if (typeof event.inscriptions_total === "number") {
      tdCount.textContent = String(event.inscriptions_total);
    } else {
      tdCount.textContent = "-";
    }

    const tdActions = document.createElement("td");

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "ef-btn ef-btn-secondary";
    editBtn.textContent = "✏️";
    editBtn.title = "Modifier l'événement";
    editBtn.addEventListener("click", () => {
      window.location.href =
        "new-event.html?id=" + encodeURIComponent(event.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "ef-btn ef-btn-secondary";
    deleteBtn.textContent = "🗑️";
    deleteBtn.title = "Supprimer l'événement";
    deleteBtn.addEventListener("click", () => efDeleteEvent(event.id));

    tdActions.appendChild(editBtn);
    tdActions.appendChild(deleteBtn);

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

  const statsEls = document.querySelectorAll(".ef-dashboard-stats .ef-stat-value");

  const { data, error } = await window.supabaseClient
    .from("events")
    .select("id, titre, date_evenement, lieu")
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

  const events = data || [];

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

  if (statsEls[0]) statsEls[0].textContent = String(events.length);
  if (statsEls[1]) statsEls[1].textContent = "0";
  if (statsEls[2]) statsEls[2].textContent = "0%";
}

document.addEventListener("DOMContentLoaded", efLoadDashboard);


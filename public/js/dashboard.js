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

function efRenderEmptyEvents() {
  const container = document.getElementById("dashboard-events-container");
  if (!container) return;
  container.innerHTML = "";

  const empty = document.createElement("div");
  empty.className = "ef-table-empty";
  empty.textContent = "Aucun événement créé pour le moment.";
  container.appendChild(empty);
}

function efRenderEvents(events) {
  const container = document.getElementById("dashboard-events-container");
  if (!container) return;

  container.innerHTML = "";

  if (!events || events.length === 0) {
    efRenderEmptyEvents();
    return;
  }

  const table = document.createElement("table");
  table.className = "ef-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headers = [
    "Titre",
    "Date",
    "Lieu",
    "Inscriptions",
  ];

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

    tr.appendChild(tdTitle);
    tr.appendChild(tdDate);
    tr.appendChild(tdLieu);
    tr.appendChild(tdCount);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

async function efLoadDashboard() {
  const user = await efRequireAuth();
  if (!user) return;

  const statsEls = document.querySelectorAll(".ef-dashboard-stats .ef-stat-value");

  const { data, error } = await window.supabaseClient
    .from("events")
    .select("id, titre, date_evenement, lieu")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    efRenderEmptyEvents();
    if (statsEls[0]) statsEls[0].textContent = "0";
    if (statsEls[1]) statsEls[1].textContent = "0";
    if (statsEls[2]) statsEls[2].textContent = "0%";
    return;
  }

  const events = data || [];

  efRenderEvents(events);

  if (statsEls[0]) statsEls[0].textContent = String(events.length);
  if (statsEls[1]) statsEls[1].textContent = "0";
  if (statsEls[2]) statsEls[2].textContent = "0%";
}

document.addEventListener("DOMContentLoaded", efLoadDashboard);


let efEventRegs = [];
let efEventRegsFilter = "all";
let efEventSearchTerm = "";
let efEventRegsChannel = null;
let efEventFieldDefs = [];

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
    .select("id, titre, date_evenement, heure_evenement, lieu, slug")
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

  // Met à jour les liens des actions (Modifier / Scanner) et des onglets avec l'id courant
  const editBtn = document.getElementById("ev-edit-button");
  const scanBtn = document.getElementById("ev-scan-button");
  const tabStats = document.getElementById("ev-tab-stats");
  const tabSettingsToggle = document.getElementById("ev-tab-settings-toggle");
  if (editBtn) {
    const url = new URL("new-event.html", window.location.href);
    url.searchParams.set("id", eventId);
    editBtn.href = url.pathname + url.search;
  }
  if (scanBtn) {
    const url = new URL("event-scanner.html", window.location.href);
    url.searchParams.set("id", eventId);
    scanBtn.href = url.pathname + url.search;
  }
  if (tabStats) {
    const url = new URL("stats-event-pro.html", window.location.href);
    url.searchParams.set("id", eventId);
    tabStats.href = url.pathname + url.search;
  }

  // Bouton "Configurer les champs" (dans le panneau Réglages)
  const openFormConfigBtn = document.getElementById("ev-open-form-config");
  if (openFormConfigBtn) {
    const url = new URL("event-settings.html", window.location.href);
    url.searchParams.set("id", eventId);
    openFormConfigBtn.addEventListener("click", () => {
      window.location.href = url.pathname + url.search;
    });
  }

  // Lien public d'inscription
  const publicUrlInput = document.getElementById("public_url");
  const copyPublicBtn = document.getElementById("copy-public-url-button");
  if (publicUrlInput && event.slug) {
    const base = window.location.origin.replace(/\/$/, "");
    const publicUrl = `${base}/publicevent?slug=${encodeURIComponent(
      event.slug
    )}`;
    publicUrlInput.value = publicUrl;

    if (copyPublicBtn) {
      copyPublicBtn.addEventListener("click", async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(publicUrl);
          }
          window.alert("Lien d'inscription copié dans le presse-papiers.");
        } catch (e) {
          window.alert("Impossible de copier le lien, copiez-le manuellement.");
        }
      });
    }
  }

  // Gestion des onglets locaux Participants / Réglages
  const participantsPanel = document.getElementById("ev-participants-panel");
  const settingsPanel = document.getElementById("ev-settings-panel");
  const tabButtons = document.querySelectorAll(
    '.ef-event-tab[data-ev-tab]'
  );

  function setActiveTab(name) {
    tabButtons.forEach((btn) => {
      const tabName = btn.getAttribute("data-ev-tab");
      if (tabName === name) {
        btn.classList.add("is-active");
      } else {
        btn.classList.remove("is-active");
      }
    });
    if (participantsPanel && settingsPanel) {
      if (name === "settings") {
        participantsPanel.style.display = "none";
        settingsPanel.style.display = "block";
      } else {
        participantsPanel.style.display = "block";
        settingsPanel.style.display = "none";
      }
    }
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabName = btn.getAttribute("data-ev-tab") || "participants";
      setActiveTab(tabName);
    });
  });

  // Charge la définition des champs de formulaire pour construire le tableau
  await efLoadEventFieldDefs(eventId);

  await efLoadEventRegistrations(eventId);
  efSetupEventViewFilters();
}

async function efLoadEventFieldDefs(eventId) {
  efEventFieldDefs = [
    { id: "base_nom", label: "Nom" },
    { id: "base_prenom", label: "Prénom" },
    { id: "base_email", label: "Email" },
  ];

  if (!window.supabaseClient) return;

  try {
    const { data, error } = await window.supabaseClient
      .from("event_fields")
      .select("id, label, ordre")
      .eq("event_id", eventId)
      .order("ordre", { ascending: true });

    if (!error && Array.isArray(data)) {
      data.forEach((f) => {
        efEventFieldDefs.push({ id: String(f.id), label: f.label });
      });
    }
  } catch (e) {
    // en cas d'erreur, on garde simplement les 3 champs de base
  }
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
    if (efEventRegsFilter === "present" && !reg.checked_in_at) {
      return false;
    }
    if (efEventRegsFilter === "absent" && reg.checked_in_at) {
      return false;
    }

    if (efEventSearchTerm) {
      const answers = reg.answers || {};
      const text = Object.values(answers)
        .join(" ")
        .toLowerCase();
      if (!text.includes(efEventSearchTerm)) {
        return false;
      }
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

  // Mode dynamique si on connaît les champs du formulaire
  const canUseDynamic = efEventFieldDefs && efEventFieldDefs.length;

  if (canUseDynamic) {
    const table = document.createElement("table");
    table.className = "ef-table ef-registrations-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const cols = [];
    efEventFieldDefs.forEach((def) => cols.push(def.label));
    cols.push("Inscription", "Statut");

    cols.forEach((label) => {
      const th = document.createElement("th");
      th.textContent = label;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    filtered.forEach((reg) => {
      const tr = document.createElement("tr");
      const answers = reg.answers || {};

      efEventFieldDefs.forEach((def, index) => {
        const value = answers[def.id] ?? "";
        const td = document.createElement("td");

        if (index === 0) {
          // Première colonne : avatar + valeur principale
          td.className = "ef-reg-name-cell";

          const avatar = document.createElement("div");
          avatar.className = "ef-reg-avatar";

          const primaryText = value ? String(value) : "Participant";
          const initials = primaryText
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((s) => s[0].toUpperCase())
            .join("");
          avatar.textContent = initials || "?";

          const nameWrapper = document.createElement("div");
          nameWrapper.className = "ef-reg-name-wrapper";
          const nameMain = document.createElement("div");
          nameMain.className = "ef-reg-name-main";
          nameMain.textContent = primaryText;
          nameWrapper.appendChild(nameMain);

          td.appendChild(avatar);
          td.appendChild(nameWrapper);
        } else {
          if (value !== null && value !== undefined) {
            td.textContent = String(value);
          }
        }

        tr.appendChild(td);
      });

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

      const tdStatus = document.createElement("td");
      tdStatus.className = "ef-reg-status-cell";
      const statusBadge = document.createElement("span");
      statusBadge.className = "ef-reg-status-badge";
      if (reg.checked_in_at) {
        statusBadge.textContent = "Présent";
        statusBadge.classList.add("is-present");
      } else {
        statusBadge.textContent = "En attente";
        statusBadge.classList.add("is-pending");
      }
      tdStatus.appendChild(statusBadge);

      // Clic sur le statut : marquer comme présent
      tdStatus.style.cursor = "pointer";
      tdStatus.title =
        "Cliquer pour marquer ce participant comme Présent (sans scanner)";
      tdStatus.addEventListener("click", () => {
        efMarkRegistrationPresent(reg.id);
      });

      tr.appendChild(tdDate);
      tr.appendChild(tdStatus);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
    return;
  }

  // Mode de repli : ancien tableau simple Date / Détails / Présence
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

    tdPresence.style.cursor = "pointer";
    tdPresence.title =
      "Cliquer pour marquer ce participant comme Présent (sans scanner)";
    tdPresence.addEventListener("click", () => {
      efMarkRegistrationPresent(reg.id);
    });

    tr.appendChild(tdDate);
    tr.appendChild(tdDetails);
    tr.appendChild(tdPresence);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

async function efMarkRegistrationPresent(regId) {
  if (!window.supabaseClient || !regId) return;

  try {
    const { error } = await window.supabaseClient
      .from("registrations")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("id", regId);

    if (error) {
      window.alert(
        "Impossible de mettre à jour le statut de ce participant : " +
          (error.message || "erreur inconnue.")
      );
      return;
    }

    // Met à jour le tableau localement sans recharger toute la page
    const idx = efEventRegs.findIndex((r) => r.id === regId);
    if (idx !== -1) {
      efEventRegs[idx] = {
        ...efEventRegs[idx],
        checked_in_at: new Date().toISOString(),
      };
    }
    efRenderEventRegistrations();
  } catch (e) {
    window.alert(
      "Erreur inattendue lors de la mise à jour du statut de ce participant."
    );
  }
}

function efUpdateEventCounts() {
  const total = efEventRegs.length;
  const present = efEventRegs.filter((r) => !!r.checked_in_at).length;
  const absent = total - present;

  const totalEl = document.getElementById("ev-count-total");
  const presentEl = document.getElementById("ev-count-present");
  const absentEl = document.getElementById("ev-count-absent");
  const rateEl = document.getElementById("ev-rate");

  if (totalEl) totalEl.textContent = String(total);
  if (presentEl) presentEl.textContent = String(present);
  if (absentEl) absentEl.textContent = String(absent);

  if (rateEl) {
    const rate = total ? Math.round((present / total) * 100) : 0;
    rateEl.textContent = `${rate}%`;
  }
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

  const searchInput = document.getElementById("ev-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      efEventSearchTerm = (searchInput.value || "").toLowerCase();
      efRenderEventRegistrations();
    });
  }

  const exportBtn = document.getElementById("ev-export-csv");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      if (!efEventRegs || efEventRegs.length === 0) return;

      const header = ["Date inscription", "Statut", "Détails"];
      const rows = [header];

      efEventRegs.forEach((reg) => {
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
        const answers = reg.answers || {};
        const details = Object.values(answers)
          .filter((v) => v !== null && v !== undefined && v !== "")
          .join(" · ");
        const statut = reg.checked_in_at ? "Présent" : "En attente";
        rows.push([`${dateStr} ${timeStr}`, statut, details]);
      });

      const csv = rows
        .map((row) =>
          row
            .map((cell) => {
              const s = String(cell || "").replace(/"/g, '""');
              return `"${s}"`;
            })
            .join(",")
        )
        .join("\n");

      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "participants.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }
}

document.addEventListener("DOMContentLoaded", efSetupEventViewPage);


async function efProRequireAuthWithPlanExports() {
  if (!window.supabaseClient) {
    window.location.href = "login.html";
    return null;
  }

  const { data, error } = await window.supabaseClient.auth.getUser();
  if (error || !data || !data.user) {
    window.location.href = "login.html";
    return null;
  }

  const user = data.user;
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
      const meta = user.user_metadata || {};
      plan = meta.initial_plan || "free";
    }
  } catch (e) {}

  if (plan !== "event" && plan !== "pro" && plan !== "business") {
    window.alert(
      "Les exports (CSV et rapports) sont réservés aux packs Événement, Pro et Business. Modifiez votre plan dans le profil pour y accéder."
    );
    window.location.href = "dashboard.html";
    return null;
  }

  return user;
}

function efProExportShowMessage(text) {
  const box = document.getElementById("pro-export-message");
  if (!box) return;
  box.textContent = text || "";
}

function efDownloadCsv(filename, rows) {
  const process = rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell === null || cell === undefined) return "";
          const s = String(cell).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([process], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function efLoadExportsPro() {
  const user = await efProRequireAuthWithPlanExports();
  if (!user) return;
  if (!window.supabaseClient) return;

  const select = document.getElementById("pro-export-event-select");
  if (!select) return;

  const { data: events, error: evError } = await window.supabaseClient
    .from("events")
    .select("id, titre, date_evenement")
    .eq("owner_id", user.id)
    .order("date_evenement", { ascending: false });

  if (evError) {
    efProExportShowMessage("Impossible de charger la liste des événements.");
    return;
  }

  select.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choisissez un événement";
  select.appendChild(placeholder);

  (events || []).forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e.id;
    opt.textContent = e.titre || "Sans titre";
    if (e.date_evenement) {
      opt.textContent += " — " + e.date_evenement;
    }
    select.appendChild(opt);
  });

  const btnParticipants = document.getElementById("pro-export-participants");
  const btnCheckins = document.getElementById("pro-export-checkins");
  const btnReport = document.getElementById("pro-export-report");
  const reportPreview = document.getElementById("pro-export-report-preview");
  const reportContent = document.getElementById("pro-export-report-content");
  const btnPrint = document.getElementById("pro-export-print");

  async function loadRegs(eventId) {
    const { data: regs, error: regError } = await window.supabaseClient
      .from("registrations")
      .select("answers, created_at, checked_in_at")
      .eq("event_id", eventId);

    if (regError) {
      efProExportShowMessage("Impossible de charger les inscriptions.");
      return [];
    }
    return regs || [];
  }

  if (btnParticipants) {
    btnParticipants.addEventListener("click", async () => {
      const eventId = select.value;
      if (!eventId) {
        efProExportShowMessage("Veuillez d'abord choisir un événement.");
        return;
      }

      const regs = await loadRegs(eventId);
      const header = ["Date inscription", "Présent", "Données brutes"];
      const rows = [header];
      regs.forEach((r) => {
        rows.push([
          r.created_at,
          r.checked_in_at ? "Oui" : "Non",
          JSON.stringify(r.answers || {}),
        ]);
      });
      efDownloadCsv("participants.csv", rows);
    });
  }

  if (btnCheckins) {
    btnCheckins.addEventListener("click", async () => {
      const eventId = select.value;
      if (!eventId) {
        efProExportShowMessage("Veuillez d'abord choisir un événement.");
        return;
      }

      const regs = await loadRegs(eventId);
      const header = ["Date inscription", "Date check-in"];
      const rows = [header];
      regs.forEach((r) => {
        if (!r.checked_in_at) return;
        rows.push([r.created_at, r.checked_in_at]);
      });
      efDownloadCsv("checkins.csv", rows);
    });
  }

  if (btnReport && reportPreview && reportContent && btnPrint) {
    btnReport.addEventListener("click", async () => {
      const eventId = select.value;
      if (!eventId) {
        efProExportShowMessage("Veuillez d'abord choisir un événement.");
        return;
      }

      const { data: ev, error: evError2 } = await window.supabaseClient
        .from("events")
        .select("id, titre, date_evenement, heure_evenement, lieu")
        .eq("id", eventId)
        .maybeSingle();

      if (evError2 || !ev) {
        efProExportShowMessage("Impossible de charger l'événement.");
        return;
      }

      const regs = await loadRegs(eventId);
      const total = regs.length;
      const present = regs.filter((r) => !!r.checked_in_at).length;
      const noshow = total - present;
      const rate = total ? Math.round((present / total) * 100) : 0;

      let html = "";
      html += `<h3>${ev.titre || "Événement"}</h3>`;
      if (ev.date_evenement) {
        html += `<p><strong>Date :</strong> ${ev.date_evenement}`;
        if (ev.heure_evenement) {
          const t = String(ev.heure_evenement).slice(0, 5);
          html += ` à ${t}`;
        }
        html += "</p>";
      }
      if (ev.lieu) {
        html += `<p><strong>Lieu :</strong> ${ev.lieu}</p>`;
      }

      html += `<p><strong>Inscriptions :</strong> ${total}</p>`;
      html += `<p><strong>Présents :</strong> ${present} (${rate}%)</p>`;
      html += `<p><strong>No-show :</strong> ${noshow}</p>`;

      reportContent.innerHTML = html;
      reportPreview.style.display = "block";
    });

    btnPrint.addEventListener("click", () => {
      window.print();
    });
  }
}

document.addEventListener("DOMContentLoaded", efLoadExportsPro);

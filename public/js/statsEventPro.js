async function efProRequireAuthWithPlanEvent() {
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
      "Les statistiques détaillées par événement sont réservées aux packs Événement, Pro et Business. Modifiez votre plan dans le profil pour y accéder."
    );
    window.location.href = "dashboard.html";
    return null;
  }

  return user;
}

function efProGetEventIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function efLoadStatsEventPro() {
  const user = await efProRequireAuthWithPlanEvent();
  if (!user) return;
  if (!window.supabaseClient) return;

  const eventId = efProGetEventIdFromUrl();
  if (!eventId) {
    window.location.href = "dashboard.html";
    return;
  }

  const msgEl = document.getElementById("pro-ev-message");

  const { data: ev, error: evError } = await window.supabaseClient
    .from("events")
    .select("id, titre, date_evenement, heure_evenement, lieu")
    .eq("id", eventId)
    .maybeSingle();

  if (evError || !ev) {
    if (msgEl) {
      msgEl.textContent = "Événement introuvable ou non accessible.";
    }
    return;
  }

  const titleEl = document.getElementById("pro-event-title");
  const metaEl = document.getElementById("pro-event-meta");

  if (titleEl) {
    titleEl.textContent = `Statistiques Pro — ${ev.titre || "Événement"}`;
  }
  if (metaEl) {
    let meta = "";
    if (ev.date_evenement) {
      meta += ev.date_evenement;
      if (ev.heure_evenement) {
        const time = String(ev.heure_evenement).slice(0, 5);
        meta += ` à ${time}`;
      }
    }
    if (ev.lieu) {
      if (meta) meta += " · ";
      meta += ev.lieu;
    }
    metaEl.textContent = meta;
  }

  const { data: regs, error: regError } = await window.supabaseClient
    .from("registrations")
    .select("created_at, checked_in_at")
    .eq("event_id", ev.id);

  const registrations = !regError && Array.isArray(regs) ? regs : [];

  const total = registrations.length;
  const present = registrations.filter((r) => !!r.checked_in_at).length;
  const noshow = total - present;
  const rate = total ? Math.round((present / total) * 100) : 0;

  const kReg = document.getElementById("pro-ev-kpi-registrations");
  const kPres = document.getElementById("pro-ev-kpi-present");
  const kNoshow = document.getElementById("pro-ev-kpi-noshow");

  if (kReg) kReg.textContent = String(total);
  if (kPres) kPres.textContent = `${present} (${rate}%)`;
  if (kNoshow) kNoshow.textContent = String(noshow);

  // Inscriptions par jour
  const byDay = new Map();
  registrations.forEach((r) => {
    const d = new Date(r.created_at);
    const key = d.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) || 0) + 1);
  });

  const regDayContainer = document.getElementById("pro-ev-registrations-by-day");
  if (regDayContainer) {
    regDayContainer.innerHTML = "";
    Array.from(byDay.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .forEach(([day, count]) => {
        const row = document.createElement("div");
        row.className = "ef-pro-bar-row";
        const label = document.createElement("span");
        label.className = "ef-pro-bar-label";
        label.textContent = day;
        const outer = document.createElement("div");
        outer.className = "ef-pro-bar-outer";
        const inner = document.createElement("div");
        inner.className = "ef-pro-bar-inner";
        inner.style.width = Math.min(100, count * 5) + "%";
        inner.textContent = String(count);
        outer.appendChild(inner);
        row.appendChild(label);
        row.appendChild(outer);
        regDayContainer.appendChild(row);
      });
  }

  // Check-ins par heure le jour J
  const checkinsByHour = new Map();
  registrations.forEach((r) => {
    if (!r.checked_in_at) return;
    const d = new Date(r.checked_in_at);
    const hour = d.getHours();
    checkinsByHour.set(hour, (checkinsByHour.get(hour) || 0) + 1);
  });

  const checkinContainer = document.getElementById("pro-ev-checkins-by-hour");
  if (checkinContainer) {
    checkinContainer.innerHTML = "";
    Array.from(checkinsByHour.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([hour, count]) => {
        const row = document.createElement("div");
        row.className = "ef-pro-bar-row";
        const label = document.createElement("span");
        label.className = "ef-pro-bar-label";
        label.textContent = `${hour}h`;
        const outer = document.createElement("div");
        outer.className = "ef-pro-bar-outer";
        const inner = document.createElement("div");
        inner.className = "ef-pro-bar-inner";
        inner.style.width = Math.min(100, count * 10) + "%";
        inner.textContent = String(count);
        outer.appendChild(inner);
        row.appendChild(label);
        row.appendChild(outer);
        checkinContainer.appendChild(row);
      });
  }

  // Temps d'arrivée moyen et pics
  const arrivalEl = document.getElementById("pro-ev-arrival-summary");
  if (arrivalEl && registrations.length > 0) {
    const times = registrations
      .filter((r) => r.checked_in_at)
      .map((r) => new Date(r.checked_in_at).getTime());

    if (times.length === 0) {
      arrivalEl.textContent =
        "Aucun participant scanné pour le moment. Les données d'arrivée apparaîtront ici.";
    } else {
      const avgTs =
        times.reduce((sum, t) => sum + t, 0) / times.length;
      const avgDate = new Date(avgTs);
      const avgHour = String(avgDate.getHours()).padStart(2, "0");
      const avgMin = String(avgDate.getMinutes()).padStart(2, "0");

      // Pic : heure avec le plus de check-ins
      let peakHour = null;
      let peakCount = 0;
      checkinsByHour.forEach((count, hour) => {
        if (count > peakCount) {
          peakCount = count;
          peakHour = hour;
        }
      });

      let text = `Heure moyenne d'arrivée : ${avgHour}h${avgMin}.`;
      if (peakHour !== null) {
        text += ` Pic de check-ins autour de ${peakHour}h (${peakCount} passages).`;
      }
      arrivalEl.textContent = text;
    }
  }
}

document.addEventListener("DOMContentLoaded", efLoadStatsEventPro);

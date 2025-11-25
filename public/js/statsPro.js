async function efProRequireAuthWithPlan() {
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

  // Récupère le plan pro depuis profiles ou user_metadata
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
  } catch (e) {
    // keep default
  }

  if (plan !== "pro" && plan !== "business") {
    window.alert(
      "Les statistiques Pro globales sont réservées aux plans Pro et Business. Modifiez votre plan dans le profil pour y accéder."
    );
    window.location.href = "dashboard.html";
    return null;
  }

  return user;
}

function efProShowMessage(text) {
  const box = document.getElementById("pro-stats-message");
  if (!box) return;
  box.textContent = text || "";
}

async function efLoadStatsPro() {
  const user = await efProRequireAuthWithPlan();
  if (!user) return;

  if (!window.supabaseClient) return;

  // Lien de retour : si un id d'événement est présent, on retourne vers cet événement
  const params = new URLSearchParams(window.location.search);
  const fromEventId = params.get("id");
  const backLink = document.getElementById("pro-global-back");
  if (backLink) {
    if (fromEventId) {
      const url = new URL("event-view.html", window.location.href);
      url.searchParams.set("id", fromEventId);
      backLink.href = url.pathname + url.search;
      backLink.textContent = "Retour à l'événement";
    } else {
      backLink.href = "dashboard.html";
      backLink.textContent = "Retour au tableau de bord";
    }
  }

  const today = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const d30 = new Date(today.getTime() - 30 * dayMs);
  const d90 = new Date(today.getTime() - 90 * dayMs);

  const { data: events, error: evError } = await window.supabaseClient
    .from("events")
    .select("id, titre, date_evenement, heure_evenement")
    .eq("owner_id", user.id)
    .order("date_evenement", { ascending: true });

  if (evError) {
    efProShowMessage("Impossible de charger les événements.");
    return;
  }

  const allEvents = events || [];
  const eventIds = allEvents.map((e) => e.id);

  let registrations = [];
  if (eventIds.length > 0) {
    const { data: regs, error: regError } = await window.supabaseClient
      .from("registrations")
      .select("event_id, created_at, checked_in_at, utm_source")
      .in("event_id", eventIds);

    if (!regError && Array.isArray(regs)) {
      registrations = regs;
    }
  }

  // Helpers
  function toDateOnly(d) {
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  // KPIs 30 / 90 jours
  const ev30 = allEvents.filter((e) => {
    if (!e.date_evenement) return false;
    return new Date(e.date_evenement) >= d30;
  });

  const ev90 = allEvents.filter((e) => {
    if (!e.date_evenement) return false;
    return new Date(e.date_evenement) >= d90;
  });

  const regs30 = registrations.filter(
    (r) => new Date(r.created_at) >= d30
  );
  const regs90 = registrations.filter(
    (r) => new Date(r.created_at) >= d90
  );

  const present30 = regs30.filter((r) => !!r.checked_in_at);
  const present90 = regs90.filter((r) => !!r.checked_in_at);

  const rateAvg = regs90.length
    ? Math.round((present90.length / regs90.length) * 100)
    : 0;

  const kEv30 = document.getElementById("pro-kpi-events-30");
  const kReg30 = document.getElementById("pro-kpi-reg-30");
  const kPres30 = document.getElementById("pro-kpi-present-30");
  const kEv90 = document.getElementById("pro-kpi-events-90");
  const kReg90 = document.getElementById("pro-kpi-reg-90");
  const kRate = document.getElementById("pro-kpi-rate-avg");

  if (kEv30) kEv30.textContent = String(ev30.length);
  if (kReg30) kReg30.textContent = String(regs30.length);
  if (kPres30) kPres30.textContent = String(present30.length);
  if (kEv90) kEv90.textContent = String(ev90.length);
  if (kReg90) kReg90.textContent = String(regs90.length);
  if (kRate) kRate.textContent = rateAvg + "%";

  // Inscriptions par semaine (8 dernières semaines)
  const weeklyContainer = document.getElementById("pro-weekly-chart");
  if (weeklyContainer) {
    weeklyContainer.innerHTML = "";
    const weeks = [];
    const now = toDateOnly(today);
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now.getTime() - i * 7 * dayMs);
      const end = new Date(start.getTime() + 7 * dayMs);
      weeks.push({ start, end });
    }

    weeks.forEach((w) => {
      const count = registrations.filter((r) => {
        const d = new Date(r.created_at);
        return d >= w.start && d < w.end;
      }).length;
      const bar = document.createElement("div");
      bar.className = "ef-pro-bar-row";
      const label = document.createElement("span");
      label.className = "ef-pro-bar-label";
      label.textContent =
        w.start.toLocaleDateString() + " - " + w.end.toLocaleDateString();
      const barOuter = document.createElement("div");
      barOuter.className = "ef-pro-bar-outer";
      const barInner = document.createElement("div");
      barInner.className = "ef-pro-bar-inner";
      barInner.style.width = Math.min(100, count * 5) + "%";
      barInner.textContent = String(count);
      barOuter.appendChild(barInner);
      bar.appendChild(label);
      bar.appendChild(barOuter);
      weeklyContainer.appendChild(bar);
    });
  }

  // Top événements
  const byEvent = new Map();
  registrations.forEach((r) => {
    const eId = r.event_id;
    if (!byEvent.has(eId)) {
      byEvent.set(eId, { total: 0, present: 0 });
    }
    const obj = byEvent.get(eId);
    obj.total++;
    if (r.checked_in_at) obj.present++;
  });

  const eventsById = new Map(allEvents.map((e) => [e.id, e]));

  const arr = Array.from(byEvent.entries()).map(([id, v]) => {
    const ev = eventsById.get(id) || {};
    const rate = v.total ? v.present / v.total : 0;
    return { id, title: ev.titre || "Événement", total: v.total, rate };
  });

  const topByReg = [...arr]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);
  const topByRate = [...arr]
    .filter((x) => x.total >= 5)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);

  const listReg = document.getElementById("pro-top-by-registrations");
  const listRate = document.getElementById("pro-top-by-rate");

  if (listReg) {
    listReg.innerHTML = "";
    topByReg.forEach((ev) => {
      const li = document.createElement("li");
      li.textContent = `${ev.title} — ${ev.total} inscrits`;
      listReg.appendChild(li);
    });
  }

  if (listRate) {
    listRate.innerHTML = "";
    topByRate.forEach((ev) => {
      const li = document.createElement("li");
      li.textContent = `${ev.title} — ${Math.round(ev.rate * 100)}% présence`;
      listRate.appendChild(li);
    });
  }

  // Sources UTM simples
  const sourceMap = new Map();
  registrations.forEach((r) => {
    const src = r.utm_source || "Direct / inconnu";
    sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
  });

  const listSources = document.getElementById("pro-top-sources");
  if (listSources) {
    listSources.innerHTML = "";
    Array.from(sourceMap.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([src, count]) => {
        const li = document.createElement("li");
        li.textContent = `${src} — ${count} inscrits`;
        listSources.appendChild(li);
      });
  }
}

document.addEventListener("DOMContentLoaded", efLoadStatsPro);

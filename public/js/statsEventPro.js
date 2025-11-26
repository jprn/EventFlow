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

  // Les statistiques détaillées par événement sont accessibles à tous les plans
  // (free, event, pro, business). On ne bloque que les plans inconnus.
  if (
    plan !== "free" &&
    plan !== "event" &&
    plan !== "pro" &&
    plan !== "business"
  ) {
    window.alert(
      "Votre type de plan n'est pas reconnu. Mettez à jour votre profil pour accéder aux statistiques."
    );
    window.location.href = "dashboard.html";
    return null;
  }

  // Expose le plan courant pour les autres scripts de cette page
  window.efCurrentPlan = plan;

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

  // Met à jour les liens de navigation (retour / onglets) avec l'id courant
  const backLink = document.getElementById("pro-ev-back");
  const tabParticipants = document.getElementById("pro-ev-tab-participants");
  const tabSettings = document.getElementById("pro-ev-tab-settings");
  const globalStatsBtn = document.getElementById("pro-ev-open-global-stats");

  [backLink, tabParticipants, tabSettings, globalStatsBtn].forEach((link) => {
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href) return;
    const url = new URL(href, window.location.href);
    url.searchParams.set("id", eventId);
    link.setAttribute("href", url.pathname + url.search);
  });

  // Affiche le bouton vers les statistiques globales, mais le désactive
  // pour les plans non Pro / Business (UX cohérente avec le header).
  const plan = window.efCurrentPlan || "free";
  if (globalStatsBtn) {
    if (plan === "pro" || plan === "business") {
      globalStatsBtn.classList.remove("ef-btn-disabled");
      globalStatsBtn.removeAttribute("aria-disabled");
    } else {
      globalStatsBtn.classList.add("ef-btn-disabled");
      globalStatsBtn.setAttribute("aria-disabled", "true");
      // On neutralise le clic même si un href est présent
      globalStatsBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }
  }

  // Désactive également le lien "Statistiques Pro" du header pour les
  // plans non Pro / Business sur cette page.
  const headerStatsLink = document.getElementById("header-nav-stats-pro");
  if (headerStatsLink && !(plan === "pro" || plan === "business")) {
    headerStatsLink.classList.add("ef-nav-link-disabled");
    headerStatsLink.setAttribute("aria-disabled", "true");
    headerStatsLink.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  }

  const { data: regs, error: regError } = await window.supabaseClient
    .from("registrations")
    .select("created_at, checked_in_at, answers")
    .eq("event_id", ev.id);

  const registrations = !regError && Array.isArray(regs) ? regs : [];

  const total = registrations.length;
  const present = registrations.filter((r) => !!r.checked_in_at).length;
  const noshow = total - present;
  const rate = total ? Math.round((present / total) * 100) : 0;

  const kReg = document.getElementById("pro-ev-kpi-registrations");
  const kPres = document.getElementById("pro-ev-kpi-present");
  const kPending = document.getElementById("pro-ev-kpi-pending");
  const kRate = document.getElementById("pro-ev-kpi-rate");

  if (kReg) kReg.textContent = String(total);
  if (kPres) kPres.textContent = String(present);
  if (kPending) kPending.textContent = String(noshow);
  if (kRate) kRate.textContent = `${rate}%`;

  // Carte Taux de présence (cercle)
  const circle = document.getElementById("pro-ev-presence-circle");
  const percentEl = document.getElementById("pro-ev-presence-percent");
  if (percentEl) {
    percentEl.textContent = `${rate}%`;
  }
  if (circle) {
    const safeRate = Math.max(0, Math.min(100, rate));
    circle.style.backgroundImage = `conic-gradient(#22c55e ${safeRate}%, #e5e7eb ${safeRate}% 100%)`;
  }

  // Carte Capacité (barre simple basée sur le total)
  const capBar = document.getElementById("pro-ev-capacity-bar");
  const capCount = document.getElementById("pro-ev-capacity-count");
  if (capBar) {
    const width = total === 0 ? 0 : Math.min(100, 10 + total * 5);
    capBar.style.width = `${width}%`;
  }
  if (capCount) {
    capCount.textContent = String(total);
  }

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

  // Statistiques par options pour les champs personnalisés (plans Event/Pro/Business)
  const optionsContainer = document.getElementById("pro-ev-options-stats");
  const optionsUpsell = document.getElementById("pro-ev-options-upsell");
  if (optionsContainer && optionsUpsell) {
    optionsContainer.innerHTML = "";

    if (plan === "free") {
      optionsUpsell.textContent =
        "Les statistiques détaillées sur les réponses aux champs personnalisés sont disponibles avec les plans Événement, Pro et Business. Modifiez votre plan dans la page Profil pour y accéder.";
      return;
    }

    optionsUpsell.textContent =
      "Basé sur les réponses aux champs personnalisés (listes déroulantes, cases à cocher).";

    try {
      const { data: fields, error: fieldsError } = await window.supabaseClient
        .from("event_fields")
        .select("id, label, type, options, ordre")
        .eq("event_id", ev.id)
        .order("ordre", { ascending: true });

      if (fieldsError) {
        return;
      }

      const optionFields = (fields || []).filter(
        (f) =>
          (f.type === "select" || f.type === "checkbox") &&
          Array.isArray(f.options) &&
          f.options.length > 0
      );

      if (optionFields.length === 0) {
        const empty = document.createElement("p");
        empty.className = "ef-form-help";
        empty.textContent =
          "Aucun champ à options n'a été configuré pour cet événement.";
        optionsContainer.appendChild(empty);
        return;
      }

      const statsByField = new Map();
      optionFields.forEach((field) => {
        statsByField.set(field.id, {
          field,
          counts: new Map(),
          total: 0,
        });
      });

      registrations.forEach((reg) => {
        const answers = reg.answers || {};
        optionFields.forEach((field) => {
          const value = answers[field.id];
          const stat = statsByField.get(field.id);
          if (!stat) return;

          if (field.type === "select") {
            if (!value) return;
            const key = String(value);
            stat.total += 1;
            stat.counts.set(key, (stat.counts.get(key) || 0) + 1);
          } else if (field.type === "checkbox") {
            if (typeof value !== "boolean") return;
            const key = value ? "Coché" : "Non coché";
            stat.total += 1;
            stat.counts.set(key, (stat.counts.get(key) || 0) + 1);
          }
        });
      });

      statsByField.forEach((stat) => {
        if (!stat.total || stat.counts.size === 0) return;

        const card = document.createElement("article");
        card.className = "ef-card";

        const title = document.createElement("h3");
        title.textContent = stat.field.label;
        card.appendChild(title);

        const chart = document.createElement("div");
        chart.className = "ef-pro-chart";

        let maxCount = 0;
        stat.counts.forEach((count) => {
          if (count > maxCount) maxCount = count;
        });

        Array.from(stat.counts.entries())
          .sort((a, b) => b[1] - a[1])
          .forEach(([optionLabel, count]) => {
            const row = document.createElement("div");
            row.className = "ef-pro-bar-row";

            const label = document.createElement("span");
            label.className = "ef-pro-bar-label";
            label.textContent = optionLabel;

            const outer = document.createElement("div");
            outer.className = "ef-pro-bar-outer";

            const inner = document.createElement("div");
            inner.className = "ef-pro-bar-inner";
            const width = maxCount ? Math.min(100, (count / maxCount) * 100) : 0;
            inner.style.width = `${width}%`;
            const percent = Math.round((count / stat.total) * 100);
            inner.textContent = `${count} · ${percent}%`;

            outer.appendChild(inner);
            row.appendChild(label);
            row.appendChild(outer);
            chart.appendChild(row);
          });

        card.appendChild(chart);
        optionsContainer.appendChild(card);
      });

      if (!optionsContainer.hasChildNodes()) {
        const empty = document.createElement("p");
        empty.className = "ef-form-help";
        empty.textContent =
          "Aucune réponse exploitable n'a encore été enregistrée sur les champs à options.";
        optionsContainer.appendChild(empty);
      }
    } catch (e) {
      // En cas d'erreur silencieuse, on n'affiche simplement pas les stats d'options
    }
  }
}

document.addEventListener("DOMContentLoaded", efLoadStatsEventPro);

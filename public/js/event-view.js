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

document.addEventListener("DOMContentLoaded", efSetupEventViewPage);


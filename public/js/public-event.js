function efGetSlugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  let slug = params.get("slug");

  // Si aucun paramètre slug n'est présent, on tente de le déduire depuis le chemin
  if (!slug) {
    const path = window.location.pathname.replace(/\/+$/, "");
    const segments = path.split("/");
    const last = segments[segments.length - 1];
    if (last && last !== "public-event.html") {
      slug = last;
    }
  }

  return slug;
}

function efShowPublicMessage(type, text) {
  const box = document.getElementById("public-event-message");
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

async function efLoadPublicEvent() {
  if (!window.supabaseClient) return;
  const slug = efGetSlugFromUrl();
  if (!slug) {
    efShowPublicMessage(
      "error",
      "Lien invalide : aucun identifiant d'événement fourni."
    );
    return;
  }

  const { data: event, error } = await window.supabaseClient
    .from("events")
    .select("id, titre, date_evenement, heure_evenement, lieu, adresse, latitude, longitude")
    .eq("slug", slug)
    .eq("est_public", true)
    .maybeSingle();

  if (error || !event) {
    efShowPublicMessage(
      "error",
      "L'événement est introuvable ou n'est plus accessible."
    );
    return;
  }

  const titleEl = document.getElementById("public-event-title");
  const metaEl = document.getElementById("public-event-meta");
  const descEl = document.getElementById("public-event-description");
  const addressEl = document.getElementById("public-event-address");

  if (titleEl) titleEl.textContent = event.titre || "Inscription à l'événement";

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

  if (descEl) {
    descEl.textContent =
      "Vos informations seront utilisées uniquement pour gérer votre participation à cet événement.";
  }

  if (addressEl) {
    addressEl.textContent = event.adresse || "";
  }

  efInitPublicMap(event);
  await efLoadPublicFields(event.id);
}

let efPublicMap;

function efInitPublicMap(event) {
  const mapContainer = document.getElementById("public-event-map");
  if (!mapContainer || !window.L) return;

  const hasCoords =
    typeof event.latitude === "number" && typeof event.longitude === "number";

  if (!hasCoords) {
    mapContainer.style.display = "none";
    return;
  }

  const lat = event.latitude;
  const lng = event.longitude;

  if (!efPublicMap) {
    efPublicMap = L.map(mapContainer, {
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
    }).setView([lat, lng], 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(efPublicMap);
  } else {
    efPublicMap.setView([lat, lng], 14);
  }

  L.marker([lat, lng]).addTo(efPublicMap);
}

async function efLoadPublicFields(eventId) {
  if (!window.supabaseClient) return;
  const container = document.getElementById("public-event-dynamic-fields");
  if (!container) return;
  container.innerHTML = "";

  // Champs de base toujours présents : Nom, Prénom, Email
  function addBaseField({ label, idKey, type }) {
    const group = document.createElement("div");
    group.className = "ef-form-group";

    const labelEl = document.createElement("label");
    const inputId = "field-" + idKey;
    labelEl.textContent = label + " *";
    labelEl.setAttribute("for", inputId);

    const inputEl = document.createElement("input");
    inputEl.id = inputId;
    inputEl.type = type;
    inputEl.required = true;
    inputEl.dataset.fieldId = idKey;
    inputEl.dataset.fieldType = type === "email" ? "email" : "short_text";

    group.appendChild(labelEl);
    group.appendChild(inputEl);
    container.appendChild(group);
  }

  addBaseField({ label: "Nom", idKey: "base_nom", type: "text" });
  addBaseField({ label: "Prénom", idKey: "base_prenom", type: "text" });
  addBaseField({ label: "Email", idKey: "base_email", type: "email" });

  const { data, error } = await window.supabaseClient
    .from("event_fields")
    .select("id, label, type, requis, options, ordre")
    .eq("event_id", eventId)
    .order("ordre", { ascending: true });

  if (error) {
    efShowPublicMessage(
      "error",
      "Impossible de charger les champs du formulaire."
    );
    return;
  }

  const fields = data || [];
  fields.forEach((field) => {
    const group = document.createElement("div");
    group.className = "ef-form-group";

    const labelEl = document.createElement("label");
    labelEl.textContent = field.label + (field.requis ? " *" : "");
    const inputId = "field-" + field.id;
    labelEl.setAttribute("for", inputId);

    let inputEl;

    switch (field.type) {
      case "long_text": {
        inputEl = document.createElement("textarea");
        inputEl.rows = 3;
        break;
      }
      case "email": {
        inputEl = document.createElement("input");
        inputEl.type = "email";
        break;
      }
      case "phone": {
        inputEl = document.createElement("input");
        inputEl.type = "tel";
        break;
      }
      case "select": {
        inputEl = document.createElement("select");
        const opts = Array.isArray(field.options) ? field.options : [];
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Sélectionnez une option";
        inputEl.appendChild(placeholder);
        opts.forEach((opt) => {
          const o = document.createElement("option");
          o.value = opt;
          o.textContent = opt;
          inputEl.appendChild(o);
        });
        break;
      }
      case "checkbox": {
        inputEl = document.createElement("input");
        inputEl.type = "checkbox";
        break;
      }
      case "short_text":
      default: {
        inputEl = document.createElement("input");
        inputEl.type = "text";
      }
    }

    inputEl.id = inputId;
    inputEl.dataset.fieldId = field.id;
    inputEl.dataset.fieldType = field.type;
    if (field.requis) {
      inputEl.required = true;
    }

    group.appendChild(labelEl);
    group.appendChild(inputEl);
    container.appendChild(group);
  });
}

function efGenerateQrToken() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  ).toUpperCase();
}

async function efHandlePublicSubmit(event) {
  event.preventDefault();
  if (!window.supabaseClient) return;

  const slug = efGetSlugFromUrl();
  if (!slug) {
    efShowPublicMessage(
      "error",
      "Lien invalide : aucun identifiant d'événement fourni."
    );
    return;
  }

  const { data: ev, error: evError } = await window.supabaseClient
    .from("events")
    .select("id")
    .eq("slug", slug)
    .eq("est_public", true)
    .maybeSingle();

  if (evError || !ev) {
    efShowPublicMessage(
      "error",
      "L'événement est introuvable ou n'est plus accessible."
    );
    return;
  }

  const eventId = ev.id;

  const dynamicContainer = document.getElementById(
    "public-event-dynamic-fields"
  );
  const answers = {};
  if (dynamicContainer) {
    const inputs = dynamicContainer.querySelectorAll("[data-field-id]");
    inputs.forEach((input) => {
      const id = input.dataset.fieldId;
      const type = input.dataset.fieldType;
      let value;
      if (type === "checkbox") {
        value = input.checked;
      } else {
        value = input.value;
      }
      answers[id] = value;
    });
  }

  const qrToken = efGenerateQrToken();

  efShowPublicMessage("", "");

  const { error: regError } = await window.supabaseClient
    .from("registrations")
    .insert({
      event_id: eventId,
      answers,
      qr_token: qrToken,
    });

  if (regError) {
    efShowPublicMessage(
      "error",
      "Impossible d'enregistrer votre inscription : " +
        (regError.message || "erreur inconnue.")
    );
    return;
  }

  window.location.href =
    "thank-you.html?token=" + encodeURIComponent(qrToken);
}

function efSetupPublicEventPage() {
  const form = document.getElementById("public-event-form");
  if (form) {
    form.addEventListener("submit", efHandlePublicSubmit);
  }

  efLoadPublicEvent();
}

document.addEventListener("DOMContentLoaded", efSetupPublicEventPage);


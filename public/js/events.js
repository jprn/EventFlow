async function efRequireAuthForEvents() {
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

function efGetEventIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function efShowEventMessage(type, text) {
  const box = document.getElementById("event-message");
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

async function efHandleCreateEvent(event) {
  event.preventDefault();

  const user = await efRequireAuthForEvents();
  if (!user) return;

  const existingEventId = efGetEventIdFromUrl();

  const titreInput = document.getElementById("titre");
  const slugInput = document.getElementById("slug");
  const dateInput = document.getElementById("date_evenement");
  const heureInput = document.getElementById("heure_evenement");
  const capaciteInput = document.getElementById("capacite");
  const lieuInput = document.getElementById("lieu");
  const adresseInput = document.getElementById("adresse");
  const latitudeInput = document.getElementById("latitude");
  const longitudeInput = document.getElementById("longitude");

  const titre = titreInput ? titreInput.value.trim() : "";
  const slug = slugInput ? slugInput.value.trim() : "";
  const date_evenement = dateInput ? dateInput.value : null;
  const heure_evenement = heureInput ? heureInput.value : null;
  const capaciteValue = capaciteInput ? capaciteInput.value : "";
  const lieu = lieuInput ? lieuInput.value.trim() : "";
  const adresse = adresseInput ? adresseInput.value.trim() : "";
  const latitudeValue = latitudeInput ? latitudeInput.value : "";
  const longitudeValue = longitudeInput ? longitudeInput.value : "";

  if (!titre || !slug) {
    efShowEventMessage(
      "error",
      "Veuillez renseigner au minimum le titre et l'adresse publique (slug)."
    );
    return;
  }

  const capacite = capaciteValue ? Number(capaciteValue) : null;
  const latitude = latitudeValue ? Number(latitudeValue) : null;
  const longitude = longitudeValue ? Number(longitudeValue) : null;
  const est_public = true;

  efShowEventMessage("", "");

  const payload = {
    titre,
    slug,
    date_evenement,
    heure_evenement,
    lieu,
    adresse,
    capacite,
    est_public,
    latitude,
    longitude,
  };

  let data, error;
  if (existingEventId) {
    const { data: updData, error: updError } = await window.supabaseClient
      .from("events")
      .update(payload)
      .eq("id", existingEventId)
      .select("id");

    // updData est un tableau de lignes ; si vide, aucune ligne modifiée
    if (!updError && Array.isArray(updData) && updData.length === 0) {
      error = {
        message:
          "Aucune modification appliquée (événement introuvable ou non autorisé).",
      };
      data = null;
    } else {
      error = updError;
      data = updData && updData[0] ? updData[0] : { id: existingEventId };
    }
  } else {
    const res = await window.supabaseClient
      .from("events")
      .insert({ owner_id: user.id, ...payload })
      .select("id")
      .single();
    data = res.data;
    error = res.error;
  }

  if (error) {
    efShowEventMessage(
      "error",
      "Impossible de créer l'événement : " +
        (error.message || "erreur inconnue.")
    );
    return;
  }

  efShowEventMessage(
    "success",
    existingEventId
      ? "Événement mis à jour. Redirection en cours..."
      : "Événement créé avec succès. Redirection en cours..."
  );

  const eventId = data && data.id;
  // Popup de confirmation avant de fermer le formulaire
  const message = existingEventId
    ? "L'événement a bien été mis à jour."
    : "L'événement a bien été créé.";
  window.alert(message);

  if (eventId) {
    window.location.href = "event-view.html?id=" + encodeURIComponent(eventId);
  } else {
    window.location.href = "dashboard.html";
  }
}

function efSetupNewEventForm() {
  const form = document.querySelector(".ef-form");
  if (form) {
    // Empêche toute soumission implicite (touche Entrée)
    form.addEventListener("submit", (e) => e.preventDefault());
  }

  const createButton = document.getElementById("create-event-button");
  if (createButton) {
    createButton.addEventListener("click", efHandleCreateEvent);
  }

  const titreInput = document.getElementById("titre");
  const slugInput = document.getElementById("slug");
  const publicUrlInput = document.getElementById("public_url");
  if (titreInput && slugInput) {
    let slugEditable = false;

    const editButton = document.getElementById("edit-slug-button");
    if (editButton) {
      editButton.addEventListener("click", () => {
        // Si on est actuellement en mode lecture seule -> passer en édition
        if (!slugEditable) {
          slugEditable = true;
          slugInput.removeAttribute("readonly");
          editButton.textContent = "Valider le slug";
          slugInput.focus();
        } else {
          // Validation : on fige la valeur et on repasse en readonly,
          // sans réactiver l'auto-sync depuis le titre
          slugEditable = true; // reste vrai pour empêcher toute auto-mise à jour
          slugInput.setAttribute("readonly", "readonly");
          editButton.textContent = "Modifier le slug";
        }
        efUpdatePublicUrl(slugInput, publicUrlInput);
      });
    }

    titreInput.addEventListener("input", () => {
      if (slugEditable) return;
      const value = titreInput.value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      slugInput.value = value;
      efUpdatePublicUrl(slugInput, publicUrlInput);
    });
  }

  const copyButton = document.getElementById("copy-public-url-button");
  if (copyButton && publicUrlInput) {
    copyButton.addEventListener("click", async () => {
      const url = publicUrlInput.value.trim();
      if (!url) return;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        }
        efShowEventMessage("success", "Adresse copiée dans le presse-papiers.");
      } catch (_) {
        efShowEventMessage(
          "error",
          "Impossible de copier l'adresse. Copiez-la manuellement."
        );
      }
    });
  }

  efInitMap();
  efLoadEventIfEditing();
}

async function efLoadEventIfEditing() {
  const eventId = efGetEventIdFromUrl();
  if (!eventId || !window.supabaseClient) return;

  const { data, error } = await window.supabaseClient
    .from("events")
    .select(
      "titre, slug, date_evenement, heure_evenement, lieu, adresse, capacite, latitude, longitude"
    )
    .eq("id", eventId)
    .single();

  if (error || !data) return;

  const titreInput = document.getElementById("titre");
  const slugInput = document.getElementById("slug");
  const dateInput = document.getElementById("date_evenement");
  const heureInput = document.getElementById("heure_evenement");
  const capaciteInput = document.getElementById("capacite");
  const lieuInput = document.getElementById("lieu");
  const adresseInput = document.getElementById("adresse");
  const latitudeInput = document.getElementById("latitude");
  const longitudeInput = document.getElementById("longitude");
  const publicUrlInput = document.getElementById("public_url");
  const createButton = document.getElementById("create-event-button");

  if (titreInput) titreInput.value = data.titre || "";
  if (slugInput) slugInput.value = data.slug || "";
  if (dateInput && data.date_evenement)
    dateInput.value = data.date_evenement;
  if (heureInput && data.heure_evenement)
    heureInput.value = data.heure_evenement;
  if (capaciteInput && data.capacite)
    capaciteInput.value = String(data.capacite);
  if (lieuInput) lieuInput.value = data.lieu || "";
  if (adresseInput) adresseInput.value = data.adresse || "";
  if (latitudeInput && data.latitude != null)
    latitudeInput.value = String(data.latitude);
  if (longitudeInput && data.longitude != null)
    longitudeInput.value = String(data.longitude);

  if (slugInput && publicUrlInput) {
    efUpdatePublicUrl(slugInput, publicUrlInput);
  }

   if (createButton) {
     createButton.textContent = "Confirmer la modification";
   }

  // Met à jour la carte si lat/lng présents
  if (latitudeInput && longitudeInput) {
    const event = new Event("change");
    latitudeInput.dispatchEvent(event);
    longitudeInput.dispatchEvent(event);
  }
}

function efUpdatePublicUrl(slugInput, publicUrlInput) {
  if (!slugInput || !publicUrlInput) return;
  const slug = slugInput.value.trim();
  if (!slug) {
    publicUrlInput.value = "";
    return;
  }
  const base = window.location.origin;
  // Adresse publique basée sur le slug, ex: https://site/mon-evenement
  publicUrlInput.value = base.replace(/\/$/, "") + "/" + slug;
}

function efInitMap() {
  const mapContainer = document.getElementById("event-map");
  if (!mapContainer || !window.L) return;

  const latitudeInput = document.getElementById("latitude");
  const longitudeInput = document.getElementById("longitude");
  const adresseInput = document.getElementById("adresse");

  const map = L.map("event-map").setView([48.8566, 2.3522], 12);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(map);

  let marker = null;

  function updateMarker(lat, lng) {
    if (!isFinite(lat) || !isFinite(lng)) return;
    const latLng = L.latLng(lat, lng);
    if (marker) {
      marker.setLatLng(latLng);
    } else {
      marker = L.marker(latLng).addTo(map);
    }
    map.setView(latLng, 14);
  }

  map.on("click", async (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    if (latitudeInput) latitudeInput.value = lat.toFixed(6);
    if (longitudeInput) longitudeInput.value = lng.toFixed(6);
    updateMarker(lat, lng);

    // Géocodage inverse pour renseigner automatiquement l'adresse
    if (adresseInput) {
      try {
        const response = await fetch(
          "https://nominatim.openstreetmap.org/reverse?format=json&lat=" +
            encodeURIComponent(lat) +
            "&lon=" +
            encodeURIComponent(lng)
        );
        const data = await response.json();
        if (data && data.display_name) {
          adresseInput.value = data.display_name;
        }
      } catch (_) {}
    }
  });

  function tryUpdateFromInputs() {
    if (!latitudeInput || !longitudeInput) return;
    const lat = parseFloat(latitudeInput.value);
    const lng = parseFloat(longitudeInput.value);
    if (isFinite(lat) && isFinite(lng)) {
      updateMarker(lat, lng);
    }
  }

  if (latitudeInput) {
    latitudeInput.addEventListener("change", tryUpdateFromInputs);
  }
  if (longitudeInput) {
    longitudeInput.addEventListener("change", tryUpdateFromInputs);
  }

  if (adresseInput) {
    adresseInput.addEventListener("change", async () => {
      const value = adresseInput.value.trim();
      if (!value) return;
      try {
        const response = await fetch(
          "https://nominatim.openstreetmap.org/search?format=json&q=" +
            encodeURIComponent(value)
        );
        const results = await response.json();
        if (Array.isArray(results) && results.length > 0) {
          const first = results[0];
          const lat = parseFloat(first.lat);
          const lng = parseFloat(first.lon);
          if (latitudeInput) latitudeInput.value = lat.toFixed(6);
          if (longitudeInput) longitudeInput.value = lng.toFixed(6);
          updateMarker(lat, lng);
        }
      } catch (_) {}
    });
  }
}

document.addEventListener("DOMContentLoaded", efSetupNewEventForm);

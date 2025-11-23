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

  const titreInput = document.getElementById("titre");
  const slugInput = document.getElementById("slug");
  const dateInput = document.getElementById("date_evenement");
  const heureInput = document.getElementById("heure_evenement");
  const capaciteInput = document.getElementById("capacite");
  const lieuInput = document.getElementById("lieu");
  const adresseInput = document.getElementById("adresse");
  const latitudeInput = document.getElementById("latitude");
  const longitudeInput = document.getElementById("longitude");
  const estPublicInput = document.getElementById("est_public");

  const titre = titreInput ? titreInput.value.trim() : "";
  const slug = slugInput ? slugInput.value.trim() : "";
  const date_evenement = dateInput ? dateInput.value : null;
  const heure_evenement = heureInput ? heureInput.value : null;
  const capaciteValue = capaciteInput ? capaciteInput.value : "";
  const lieu = lieuInput ? lieuInput.value.trim() : "";
  const adresse = adresseInput ? adresseInput.value.trim() : "";
  const latitudeValue = latitudeInput ? latitudeInput.value : "";
  const longitudeValue = longitudeInput ? longitudeInput.value : "";
  const est_public = !!(estPublicInput && estPublicInput.checked);

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

  efShowEventMessage("", "");

  const { data, error } = await window.supabaseClient
    .from("events")
    .insert({
      owner_id: user.id,
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
    })
    .select("id")
    .single();

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
    "Événement créé avec succès. Redirection en cours..."
  );

  const eventId = data && data.id;
  if (eventId) {
    window.location.href = "event-view.html?id=" + encodeURIComponent(eventId);
  } else {
    window.location.href = "dashboard.html";
  }
}

function efSetupNewEventForm() {
  const form = document.querySelector(".ef-form");
  if (!form) return;
  form.addEventListener("submit", efHandleCreateEvent);

  const titreInput = document.getElementById("titre");
  const slugInput = document.getElementById("slug");
  if (titreInput && slugInput) {
    titreInput.addEventListener("input", () => {
      if (!slugInput.value) {
        const value = titreInput.value
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        slugInput.value = value;
      }
    });
  }

  efInitMap();
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

  map.on("click", (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    if (latitudeInput) latitudeInput.value = lat.toFixed(6);
    if (longitudeInput) longitudeInput.value = lng.toFixed(6);
    updateMarker(lat, lng);
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

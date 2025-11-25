async function efRequireAuthForFields() {
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

function efShowFieldsMessage(type, text) {
  const box = document.getElementById("fields-message");
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

const EF_FIELD_TYPES = {
  short_text: "Texte court",
  long_text: "Texte long",
  email: "E-mail",
  phone: "Téléphone",
  select: "Sélection",
  checkbox: "Case à cocher",
};

function efRenderFieldsList(fields) {
  const container = document.getElementById("fields-list");
  if (!container) return;
  container.innerHTML = "";

  if (!fields || fields.length === 0) {
    const empty = document.createElement("div");
    empty.className = "ef-table-empty";
    empty.textContent = "Aucun champ personnalisé pour le moment.";
    container.appendChild(empty);
    return;
  }

  const table = document.createElement("table");
  table.className = "ef-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Libellé", "Type", "Requis", "Actions"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  fields.forEach((field) => {
    const tr = document.createElement("tr");

    const tdLabel = document.createElement("td");
    tdLabel.textContent = field.label;

    const tdType = document.createElement("td");
    tdType.textContent = EF_FIELD_TYPES[field.type] || field.type;

    const tdRequired = document.createElement("td");
    tdRequired.textContent = field.requis ? "Oui" : "Non";

    const tdActions = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "ef-btn ef-btn-secondary";
    editBtn.textContent = "Modifier";
    editBtn.addEventListener("click", () => efFillFormForEdit(field));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "ef-btn ef-btn-secondary";
    deleteBtn.textContent = "Supprimer";
    deleteBtn.addEventListener("click", () => efDeleteField(field.id));

    tdActions.appendChild(editBtn);
    tdActions.appendChild(deleteBtn);

    tr.appendChild(tdLabel);
    tr.appendChild(tdType);
    tr.appendChild(tdRequired);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

function efFillFormForEdit(field) {
  const idInput = document.getElementById("field-id");
  const labelInput = document.getElementById("field-label");
  const typeSelect = document.getElementById("field-type");
  const requiredInput = document.getElementById("field-required");
  const optionsInput = document.getElementById("field-options");

  if (!idInput || !labelInput || !typeSelect || !requiredInput || !optionsInput)
    return;

  idInput.value = field.id;
  labelInput.value = field.label || "";
  typeSelect.value = field.type || "short_text";
  requiredInput.checked = !!field.requis;

  if (field.type === "select") {
    const optsArray = Array.isArray(field.options) ? field.options : [];
    optionsInput.value = optsArray.join("\n");
  } else {
    optionsInput.value = "";
  }

  efUpdateOptionsVisibility();

  // Affiche le formulaire lorsqu'on édite un champ
  efToggleFieldForm(true);
}

async function efDeleteField(fieldId) {
  if (!window.supabaseClient) return;
  const eventId = efGetEventIdFromUrl();
  if (!eventId) return;

  const ok = window.confirm("Supprimer ce champ ?");
  if (!ok) return;

  const { error } = await window.supabaseClient
    .from("event_fields")
    .delete()
    .eq("id", fieldId)
    .eq("event_id", eventId);

  if (error) {
    efShowFieldsMessage(
      "error",
      "Impossible de supprimer le champ : " + (error.message || "")
    );
    return;
  }

  efShowFieldsMessage("success", "Champ supprimé.");
  efLoadFields();
}

function efUpdateOptionsVisibility() {
  const typeSelect = document.getElementById("field-type");
  const optionsGroup = document.getElementById("field-options-group");
  if (!typeSelect || !optionsGroup) return;

  if (typeSelect.value === "select") {
    optionsGroup.style.display = "block";
  } else {
    optionsGroup.style.display = "none";
  }
}

async function efHandleFieldSubmit(event) {
  event.preventDefault();

  const user = await efRequireAuthForFields();
  if (!user) return;

  const eventId = efGetEventIdFromUrl();
  if (!eventId) {
    efShowFieldsMessage(
      "error",
      "Impossible d'identifier l'événement (paramètre id manquant)."
    );
    return;
  }

  const idInput = document.getElementById("field-id");
  const labelInput = document.getElementById("field-label");
  const typeSelect = document.getElementById("field-type");
  const requiredInput = document.getElementById("field-required");
  const optionsInput = document.getElementById("field-options");

  const label = labelInput ? labelInput.value.trim() : "";
  const type = typeSelect ? typeSelect.value : "short_text";
  const requis = !!(requiredInput && requiredInput.checked);

  if (!label) {
    efShowFieldsMessage("error", "Veuillez renseigner un libellé.");
    return;
  }

  let options = null;
  if (type === "select" && optionsInput) {
    const lines = optionsInput.value
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    options = lines;
  }

  const payload = {
    event_id: eventId,
    label,
    type,
    requis,
    options,
  };

  const fieldId = idInput ? idInput.value : "";

  let error;
  if (fieldId) {
    const { error: updError } = await window.supabaseClient
      .from("event_fields")
      .update(payload)
      .eq("id", fieldId)
      .eq("event_id", eventId);
    error = updError;
  } else {
    const { error: insError } = await window.supabaseClient
      .from("event_fields")
      .insert(payload);
    error = insError;
  }

  if (error) {
    efShowFieldsMessage(
      "error",
      "Impossible d'enregistrer le champ : " + (error.message || "")
    );
    return;
  }

  if (idInput) idInput.value = "";
  labelInput.value = "";
  typeSelect.value = "short_text";
  requiredInput.checked = false;
  if (optionsInput) optionsInput.value = "";
  efUpdateOptionsVisibility();

  efShowFieldsMessage("success", "Champ enregistré.");
  efLoadFields();
}

async function efLoadFields() {
  const user = await efRequireAuthForFields();
  if (!user) return;

  const eventId = efGetEventIdFromUrl();
  if (!eventId) {
    efShowFieldsMessage(
      "error",
      "Impossible d'identifier l'événement (paramètre id manquant)."
    );
    return;
  }

  const { data, error } = await window.supabaseClient
    .from("event_fields")
    .select("id, label, type, requis, options, ordre")
    .eq("event_id", eventId)
    .order("ordre", { ascending: true });

  if (error) {
    efShowFieldsMessage(
      "error",
      "Impossible de charger les champs : " + (error.message || "")
    );
    return;
  }

  efRenderFieldsList(data || []);
}

function efSetupFieldsPage() {
  const form = document.getElementById("field-form");
  if (form) {
    form.addEventListener("submit", efHandleFieldSubmit);
  }

  const typeSelect = document.getElementById("field-type");
  if (typeSelect) {
    typeSelect.addEventListener("change", efUpdateOptionsVisibility);
    efUpdateOptionsVisibility();
  }

  const addButton = document.getElementById("field-add-button");
  if (addButton) {
    addButton.addEventListener("click", () => {
      const idInput = document.getElementById("field-id");
      const labelInput = document.getElementById("field-label");
      const typeSelectEl = document.getElementById("field-type");
      const requiredInput = document.getElementById("field-required");
      const optionsInput = document.getElementById("field-options");

      if (idInput) idInput.value = "";
      if (labelInput) labelInput.value = "";
      if (typeSelectEl) typeSelectEl.value = "short_text";
      if (requiredInput) requiredInput.checked = false;
      if (optionsInput) optionsInput.value = "";

      efUpdateOptionsVisibility();
      efToggleFieldForm(true);
    });
  }

  efUpdateEventLinksForSettings();
  efLoadFields();
}

function efToggleFieldForm(show) {
  const wrapper = document.getElementById("field-form-wrapper");
  if (!wrapper) return;
  if (show) {
    wrapper.classList.remove("is-hidden");
  } else {
    wrapper.classList.add("is-hidden");
  }
}

function efUpdateEventLinksForSettings() {
  const eventId = efGetEventIdFromUrl();
  if (!eventId) return;

  const backLink = document.getElementById("ef-back-to-event");
  const finishLink = document.getElementById("ef-finish-config");

  [backLink, finishLink].forEach((link) => {
    if (!link) return;
    const href = link.getAttribute("href");
    if (!href) return;

    const url = new URL(href, window.location.href);
    url.searchParams.set("id", eventId);
    link.setAttribute("href", url.pathname + url.search);
  });
}

document.addEventListener("DOMContentLoaded", efSetupFieldsPage);


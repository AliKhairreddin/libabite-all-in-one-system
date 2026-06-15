import { state } from "./state.js";
import { escapeHtml } from "../shared/html.js";

const ADDRESS_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const ADDRESS_SUGGESTION_LIMIT = 5;
const ADDRESS_FETCH_DELAY_MS = 260;

let addressSearchTimer: number | undefined;
let addressSearchRequestId = 0;

function cleanAddressText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function deliverySearchLocationHint() {
  const configured = cleanAddressText(state.restaurantSettings?.location);
  return /netherlands|nederland/i.test(configured) ? configured : configured ? `${configured}, Netherlands` : "Roermond, Netherlands";
}

function addressSuggestionKey(value) {
  return cleanAddressText(value).toLowerCase();
}

function matchesQuery(value, query) {
  const normalizedValue = addressSuggestionKey(value);
  const terms = addressSuggestionKey(query).split(" ").filter(Boolean);
  return terms.every((term) => normalizedValue.includes(term));
}

function storedAddressSuggestions(query) {
  const suggestions = new Map();
  const pushSuggestion = (address, source, detail = "") => {
    const label = cleanAddressText(address);
    const key = addressSuggestionKey(label);
    if (!label || suggestions.has(key)) return;
    suggestions.set(key, {
      label,
      detail: cleanAddressText(detail),
      source
    });
  };

  (state.customers || []).forEach((customer) => {
    (customer.addresses || []).forEach((address) => pushSuggestion(address, "Saved customer", customer.name));
  });
  (state.orders || [])
    .slice()
    .sort((first, second) => (Number(second.createdAtMs) || 0) - (Number(first.createdAtMs) || 0))
    .forEach((order) => pushSuggestion(order.deliveryAddress, "Recent delivery", order.customerName || order.customer));

  const allSuggestions = [...suggestions.values()];
  const filtered = query ? allSuggestions.filter((suggestion) => matchesQuery(suggestion.label, query)) : allSuggestions;
  return filtered
    .sort((first, second) => {
      const firstStarts = addressSuggestionKey(first.label).startsWith(addressSuggestionKey(query)) ? 0 : 1;
      const secondStarts = addressSuggestionKey(second.label).startsWith(addressSuggestionKey(query)) ? 0 : 1;
      return firstStarts - secondStarts || first.label.localeCompare(second.label);
    })
    .slice(0, ADDRESS_SUGGESTION_LIMIT);
}

function comboboxFor(element) {
  return element?.closest?.("[data-address-combobox]") || null;
}

function suggestionsNodeFor(input) {
  return comboboxFor(input)?.querySelector("[data-address-suggestions]") || null;
}

function helperNodeFor(input) {
  return comboboxFor(input)?.querySelector("[data-address-helper]") || null;
}

function setHiddenAddressValue(input, name, value) {
  const field = comboboxFor(input)?.querySelector(`[name="${name}"]`) as HTMLInputElement | null;
  if (field) field.value = cleanAddressText(value);
}

function setAddressMetadata(input, suggestion: any = {}) {
  setHiddenAddressValue(input, "deliveryAddressLabel", suggestion.label || input.value);
  setHiddenAddressValue(input, "deliveryAddressLat", suggestion.lat || "");
  setHiddenAddressValue(input, "deliveryAddressLng", suggestion.lng || "");
  setHiddenAddressValue(input, "deliveryAddressSource", suggestion.source || "");
  setHiddenAddressValue(input, "deliveryAddressPlaceId", suggestion.placeId || "");
}

function resetAddressMetadata(input) {
  setAddressMetadata(input, {});
}

function setAddressHelper(input, text) {
  const helper = helperNodeFor(input);
  if (helper) helper.textContent = text || "";
}

function activeSuggestionButtons(input) {
  return [...(suggestionsNodeFor(input)?.querySelectorAll("[data-address-suggestion]") || [])] as HTMLButtonElement[];
}

function setActiveSuggestion(input, index) {
  const buttons = activeSuggestionButtons(input);
  buttons.forEach((button, buttonIndex) => {
    const active = buttonIndex === index;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    if (active) input.setAttribute("aria-activedescendant", button.id);
  });
  if (index < 0) input.removeAttribute("aria-activedescendant");
  input.dataset.addressActiveIndex = String(index);
}

function renderAddressSuggestions(input, suggestions, status = "") {
  const list = suggestionsNodeFor(input);
  if (!list) return;
  const limitedSuggestions = suggestions.slice(0, ADDRESS_SUGGESTION_LIMIT);
  const statusHtml = status ? `<div class="customer-address-status">${escapeHtml(status)}</div>` : "";
  list.innerHTML = limitedSuggestions.length
    ? `${statusHtml}${limitedSuggestions.map((suggestion, index) => {
      const id = `address-option-${index}`;
      const detail = [suggestion.source, suggestion.detail].filter(Boolean).join(" - ");
      return `
        <button
          id="${escapeHtml(id)}"
          class="customer-address-option"
          type="button"
          role="option"
          data-address-suggestion
          data-address-label="${escapeHtml(suggestion.label)}"
          data-address-lat="${escapeHtml(suggestion.lat || "")}"
          data-address-lng="${escapeHtml(suggestion.lng || "")}"
          data-address-source="${escapeHtml(suggestion.source || "")}"
          data-address-place-id="${escapeHtml(suggestion.placeId || "")}"
          aria-selected="false"
        >
          <strong>${escapeHtml(suggestion.label)}</strong>
          ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
        </button>
      `;
    }).join("")}`
    : statusHtml;
  list.hidden = !limitedSuggestions.length && !status;
  input.setAttribute("aria-expanded", list.hidden ? "false" : "true");
  setActiveSuggestion(input, limitedSuggestions.length ? 0 : -1);
}

function nominatimSuggestion(result) {
  const address = result?.address || {};
  const streetLine = [
    address.road || address.pedestrian || address.footway || address.cycleway || address.path,
    address.house_number
  ].filter(Boolean).join(" ");
  const cityLine = [
    address.postcode,
    address.city || address.town || address.village || address.municipality || "Roermond"
  ].filter(Boolean).join(" ");
  const label = cleanAddressText(streetLine || result?.display_name);
  const detail = cleanAddressText(cityLine || result?.display_name);
  const lat = Number(result?.lat);
  const lng = Number(result?.lon);
  if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    label,
    detail,
    source: "Address match",
    lat: String(lat),
    lng: String(lng),
    placeId: String(result?.place_id || "")
  };
}

async function fetchRemoteAddressSuggestions(query) {
  const params = new URLSearchParams({
    format: "jsonv2",
    limit: String(ADDRESS_SUGGESTION_LIMIT),
    addressdetails: "1",
    dedupe: "1",
    countrycodes: "nl",
    "accept-language": "nl,en",
    q: /roermond|netherlands|nederland/i.test(query) ? query : `${query}, ${deliverySearchLocationHint()}`
  });
  const response = await fetch(`${ADDRESS_SEARCH_URL}?${params.toString()}`);
  if (!response.ok) throw new Error("Address lookup failed");
  const payload = await response.json();
  return (Array.isArray(payload) ? payload : [])
    .map(nominatimSuggestion)
    .filter(Boolean);
}

function mergeSuggestions(primary, secondary) {
  const merged = new Map();
  [...primary, ...secondary].forEach((suggestion) => {
    const key = addressSuggestionKey(suggestion.label);
    if (!key || merged.has(key)) return;
    merged.set(key, suggestion);
  });
  return [...merged.values()].slice(0, ADDRESS_SUGGESTION_LIMIT);
}

export function createAddressAutocompleteRuntime() {
  function closeAddressSuggestions(input = document.querySelector("[data-address-input]")) {
    const list = suggestionsNodeFor(input);
    if (!list) return;
    list.hidden = true;
    list.innerHTML = "";
    input?.setAttribute?.("aria-expanded", "false");
    input?.removeAttribute?.("aria-activedescendant");
    const inputElement = input as HTMLElement | null;
    if (inputElement?.dataset) inputElement.dataset.addressActiveIndex = "-1";
  }

  function handleAddressInput(input) {
    const query = cleanAddressText(input.value);
    resetAddressMetadata(input);
    window.clearTimeout(addressSearchTimer);
    addressSearchRequestId += 1;

    if (!query) {
      renderAddressSuggestions(input, storedAddressSuggestions(""), "Recent delivery addresses");
      setAddressHelper(input, "");
      return;
    }

    const localSuggestions = storedAddressSuggestions(query);
    renderAddressSuggestions(input, localSuggestions, query.length >= 3 ? "Checking address matches" : "");

    if (query.length < 3) return;
    const requestId = addressSearchRequestId;
    addressSearchTimer = window.setTimeout(async () => {
      try {
        const remoteSuggestions = await fetchRemoteAddressSuggestions(query);
        if (requestId !== addressSearchRequestId) return;
        const merged = mergeSuggestions(remoteSuggestions, localSuggestions);
        renderAddressSuggestions(input, merged, merged.length ? "" : "No address matches found");
      } catch {
        if (requestId !== addressSearchRequestId) return;
        renderAddressSuggestions(input, localSuggestions, localSuggestions.length ? "" : "Keep typing the full address");
      }
    }, ADDRESS_FETCH_DELAY_MS);
  }

  function handleAddressFocus(input) {
    if (cleanAddressText(input.value)) {
      handleAddressInput(input);
      return;
    }
    renderAddressSuggestions(input, storedAddressSuggestions(""), "Recent delivery addresses");
  }

  function chooseAddressSuggestion(button) {
    const combobox = comboboxFor(button);
    const input = combobox?.querySelector("[data-address-input]") as HTMLInputElement | null;
    if (!input) return;
    const suggestion = {
      label: button.dataset.addressLabel || "",
      lat: button.dataset.addressLat || "",
      lng: button.dataset.addressLng || "",
      source: button.dataset.addressSource || "",
      placeId: button.dataset.addressPlaceId || ""
    };
    input.value = suggestion.label;
    setAddressMetadata(input, suggestion);
    setAddressHelper(input, suggestion.source ? `Selected ${suggestion.source.toLowerCase()}` : "");
    closeAddressSuggestions(input);
    input.focus();
  }

  function handleAddressKeydown(event) {
    const input = event.target.closest("[data-address-input]");
    if (!input) return;
    const buttons = activeSuggestionButtons(input);
    if (!buttons.length && event.key === "ArrowDown") {
      handleAddressFocus(input);
      event.preventDefault();
      return;
    }
    if (!buttons.length) return;

    const currentIndex = Number(input.dataset.addressActiveIndex || 0);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion(input, Math.min(buttons.length - 1, currentIndex + 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion(input, Math.max(0, currentIndex - 1));
    }
    if (event.key === "Enter" && currentIndex >= 0) {
      event.preventDefault();
      chooseAddressSuggestion(buttons[currentIndex]);
    }
    if (event.key === "Escape") {
      closeAddressSuggestions(input);
    }
  }

  function handleAddressFocusOut(target) {
    window.setTimeout(() => {
      const combobox = comboboxFor(target);
      if (combobox?.contains(document.activeElement)) return;
      closeAddressSuggestions(combobox?.querySelector("[data-address-input]"));
    }, 80);
  }

  return {
    chooseAddressSuggestion,
    closeAddressSuggestions,
    handleAddressFocus,
    handleAddressFocusOut,
    handleAddressInput,
    handleAddressKeydown
  };
}

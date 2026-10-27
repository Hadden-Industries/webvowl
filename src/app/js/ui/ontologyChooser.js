import {
  findOntologySuggestions,
  ontologySuggestions,
} from "./ontologySuggestions.js";
import { resolveOntologySubmission } from "./ontologySourceSubmission.js";

export function createOntologyChooser({
  documentObject,
  submitSource,
  catalogue = ontologySuggestions,
  windowObject = globalThis.window,
}) {
  const input = documentObject.getElementById("iri-converter-input");
  const form = documentObject.getElementById("iri-converter-form");
  const button = documentObject.getElementById("iri-converter-button");
  const hint = documentObject.getElementById("iri-converter-hint");
  const clear = documentObject.getElementById("ontology-source-clear");
  const list = documentObject.getElementById("ontology-suggestions");
  const status = documentObject.getElementById("ontology-source-status");
  const popover = documentObject.getElementById("m_select");
  const listeners = [];
  let open = false;
  let activeId = null;
  let composing = false;
  let compositionEnter = false;
  let dirty = false;
  let submittedUrl = null;
  let latestState = null;
  let loadWasPending = false;
  let validationWasShown = false;
  let noMatches = false;
  let announcement;
  let pointerInList = false;
  let blurTimer;
  let options = new Map();

  function on(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    listeners.push(() => target.removeEventListener(type, listener, options));
  }
  function announce(text) {
    windowObject.clearTimeout(announcement);
    announcement = windowObject.setTimeout(() => {
      status.textContent = text;
    }, 300);
  }
  function setOpen(value) {
    open = value;
    list.hidden = !open;
    input.setAttribute("aria-expanded", String(open));
    if (!open) {
      activeId = null;
    }
    renderActive();
  }
  function renderActive() {
    input.removeAttribute("aria-activedescendant");
    for (const [id, element] of options) {
      element.classList.toggle(
        "ontology-suggestion-active",
        open && id === activeId,
      );
      if (open && id === activeId) {
        input.setAttribute("aria-activedescendant", element.id);
        element.scrollIntoView?.({ block: "nearest" });
      }
    }
  }
  function renderSuggestions({ resetActive = false } = {}) {
    const result = findOntologySuggestions(input.value, catalogue);
    if (resetActive) {
      activeId = result.activeId;
    }
    if (!result.matches.some(({ id }) => id === activeId)) {
      activeId = null;
    }
    list.replaceChildren();
    options = new Map();
    let group;
    let groupName;
    for (const entry of result.matches) {
      if (entry.group !== groupName) {
        groupName = entry.group;
        group = documentObject.createElement("div");
        group.setAttribute("role", "group");
        const heading = documentObject.createElement("div");
        heading.id = "ontology-group-" + entry.id;
        group.setAttribute("aria-labelledby", heading.id);
        heading.className = "ontology-suggestion-group";
        heading.setAttribute("aria-hidden", "true");
        heading.textContent = groupName;
        group.appendChild(heading);
        list.appendChild(group);
      }
      const option = documentObject.createElement("div");
      option.id = "ontology-suggestion-" + entry.id;
      option.className = "ontology-suggestion";
      option.setAttribute("role", "option");
      option.setAttribute("data-suggestion-id", entry.id);
      option.setAttribute(
        "aria-selected",
        String(result.committed?.id === entry.id),
      );
      const title = documentObject.createElement("span");
      title.className = "ontology-suggestion-title";
      title.id = option.id + "-title";
      option.setAttribute("aria-labelledby", title.id);
      title.textContent = entry.title;
      const badge = documentObject.createElement("span");
      badge.className = "ontology-suggestion-badge";
      badge.id = option.id + "-description";
      badge.textContent = entry.presetKey
        ? entry.badge
        : entry.category + " · " + entry.badge;
      badge.textContent = entry.group + " · " + badge.textContent;
      const url = documentObject.createElement("span");
      url.className = "ontology-suggestion-url";
      url.id = option.id + "-url";
      url.textContent = entry.url;
      option.setAttribute("aria-describedby", badge.id + " " + url.id);
      option.appendChild(title);
      option.appendChild(badge);
      option.appendChild(url);
      if (result.committed?.id === entry.id) {
        const selected = documentObject.createElement("span");
        selected.className = "ontology-suggestion-selected";
        selected.textContent = "✓ Selected";
        option.appendChild(selected);
      }
      group.appendChild(option);
      options.set(entry.id, option);
    }
    noMatches = result.matches.length === 0;
    if (noMatches && open) {
      setOpen(false);
      announce("No suggestions match. Enter a full URL starting with https://");
    }
    renderHint();
    renderActive();
    if (open) {
      announce(
        result.matches.length
          ? `${result.matches.length} suggestions. Use arrow keys to explore; Enter chooses without loading.`
          : "No suggestions match. Enter a full URL starting with https://",
      );
    }
  }
  function validate({ normalize = false, showError = false } = {}) {
    const result = resolveOntologySubmission(input.value, catalogue);
    if (normalize && result.valid) {
      input.value = result.normalizedUrl;
    }
    button.disabled = !result.valid;
    clear.hidden = input.value.length === 0;
    validationWasShown ||= showError;
    const error = validationWasShown && !result.empty && !result.valid;
    if (error) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
    hint.classList.toggle("converter-input-hint--error", error);
    renderHint(result);
    return result;
  }
  function renderHint(
    result = resolveOntologySubmission(input.value, catalogue),
  ) {
    hint.textContent =
      validationWasShown && !result.empty && !result.valid
        ? result.message
        : latestState?.status === "error"
          ? "Last load failed. " +
            (latestState.error?.message || "Check the address and try again.")
          : noMatches && !result.valid
            ? "No suggestions match. Enter a full URL starting with https://"
            : "";
    hint.hidden = !hint.textContent;
  }
  function commit(id) {
    const entry = catalogue.find((item) => item.id === id);
    if (!entry) {
      return;
    }
    input.value = entry.url;
    compositionEnter = false;
    dirty = true;
    submittedUrl = null;
    validationWasShown = false;
    validate();
    input.focus({ preventScroll: true });
    setOpen(false);
    renderSuggestions();
    announce(`${entry.title} selected. Activate Visualize to load.`);
  }
  function submit(value = input.value) {
    input.value = value;
    const result = validate({ normalize: true, showError: true });
    if (!result.valid) {
      input.focus();
      return result;
    }
    submittedUrl = result.normalizedUrl;
    dirty = true; // Remains protected through failure until this source is accepted.
    setOpen(false);
    renderSuggestions();
    announce("Loading ontology…");
    return submitSource(input.value);
  }

  on(input, "input", () => {
    dirty = true;
    submittedUrl = null;
    validate();
    if (!composing) {
      setOpen(true);
      renderSuggestions({ resetActive: true });
    }
  });
  on(input, "focus", () => {
    setOpen(true);
    renderSuggestions();
  });
  on(input, "pointerdown", () => {
    setOpen(true);
    renderSuggestions();
  });
  on(input, "change", () => {
    validate({ normalize: true, showError: true });
    // Touch-generated mouse events blur the field before the click. Replacing
    // options here would detach the pressed target and lose that native click.
    if (!pointerInList) {
      renderSuggestions();
    }
  });
  on(input, "compositionstart", () => {
    composing = true;
    compositionEnter = false;
  });
  on(input, "compositionend", () => {
    composing = false;
    setOpen(true);
    renderSuggestions({ resetActive: true });
  });
  on(input, "keyup", (event) => {
    if (event.key === "Enter" || !composing) {
      compositionEnter = false;
    }
  });
  on(input, "keydown", (event) => {
    // Some IMEs end composition before the final keydown. The 229 marker
    // covers that native ordering without suppressing the next ordinary Enter.
    // eslint-disable-next-line no-restricted-syntax -- Owner-approved IME boundary marker; see UI implementation evidence.
    if (event.isComposing || composing || event.keyCode === 229) {
      compositionEnter ||= event.key === "Enter";
      return;
    }
    if (event.key === "Enter") {
      if (event.repeat || compositionEnter) {
        event.preventDefault();
        return;
      }
      if (open && activeId) {
        event.preventDefault();
        commit(activeId);
        return;
      }
      if (!validate({ normalize: true, showError: true }).valid) {
        event.preventDefault();
      }
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (event.altKey) {
        setOpen(event.key === "ArrowDown");
        renderSuggestions();
        return;
      }
      if (!open) {
        setOpen(true);
        renderSuggestions();
      }
      const ids = [...options.keys()];
      const index = ids.indexOf(activeId);
      activeId = ids.length
        ? ids[
            (index +
              (event.key === "ArrowDown" ? 1 : index < 0 ? 0 : -1) +
              ids.length) %
              ids.length
          ]
        : null;
      renderActive();
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  });
  on(input, "blur", () => {
    validate({ normalize: true, showError: dirty });
    if (!pointerInList) {
      setOpen(false);
    }
    reflectState();
  });
  on(clear, "click", () => {
    input.value = "";
    dirty = true;
    submittedUrl = null;
    validationWasShown = false;
    validate();
    setOpen(true);
    renderSuggestions();
    input.focus({ preventScroll: true });
  });
  // Prevent mouse focus from leaving the field before click commitment. Touch
  // remains scrollable; click, not pointerdown, commits so dragging never does.
  on(list, "pointerdown", (event) => {
    pointerInList = true;
    if (event.pointerType !== "touch") {
      event.preventDefault();
    }
  });
  on(list, "pointermove", (event) => {
    if (event.pointerType === "touch") {
      return;
    }
    const option = event.target.closest("[data-suggestion-id]");
    if (option && list.contains(option)) {
      activeId = option.getAttribute("data-suggestion-id");
      renderActive();
    }
  });
  on(list, "pointerup", () => {
    windowObject.clearTimeout(blurTimer);
    blurTimer = windowObject.setTimeout(() => {
      pointerInList = false;
      if (documentObject.activeElement !== input) {
        setOpen(false);
      }
    }, 0);
  });
  on(list, "pointercancel", () => {
    pointerInList = false;
    if (documentObject.activeElement !== input) {
      setOpen(false);
    }
  });
  on(list, "click", (event) => {
    const option = event.target.closest("[data-suggestion-id]");
    if (option && list.contains(option)) {
      commit(option.getAttribute("data-suggestion-id"));
    }
  });
  on(button, "click", (event) => {
    if (documentObject.activeElement !== input) {
      compositionEnter = false;
    }
    if (!validate({ normalize: true, showError: true }).valid) {
      event.preventDefault();
    }
  });
  on(form, "submit", (event) => {
    event.preventDefault();
    if (!composing && !compositionEnter) {
      submit();
    }
  });
  on(form, "keydown", (event) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  });
  on(popover, "toggle", (event) => {
    if (event.newState === "closed") {
      setOpen(false);
    } else if (latestState?.status === "error") {
      renderHint();
      input.focus({ preventScroll: true });
    }
  });

  function reflectState() {
    if (!latestState || !["ready", "relaxing"].includes(latestState.status)) {
      return;
    }
    const source = latestState.source;
    const remote = ["ontology-document-iri", "vowl-json-url"].includes(
      source?.kind,
    );
    if (remote && source.identity === submittedUrl) {
      dirty = false;
    }
    if (dirty || documentObject.activeElement === input) {
      return;
    }
    input.value = remote ? source.identity : "";
    validate();
    renderSuggestions();
  }
  validate();
  setOpen(false);
  renderSuggestions();
  return Object.freeze({
    submit,
    renderControllerState(state) {
      latestState = state;
      if (state.status === "loading") {
        loadWasPending = true;
        announce("Loading ontology…");
      } else if (
        ["ready", "relaxing"].includes(state.status) &&
        loadWasPending
      ) {
        loadWasPending = false;
        // A submitted value is no longer an unsubmitted draft. An accepted
        // replacement (including an agent load) may reflect once focus leaves.
        if (submittedUrl !== null) {
          dirty = false;
          submittedUrl = null;
        }
        announce("Ontology loaded.");
      } else if (state.status === "error") {
        loadWasPending = false;
        announce("Ontology loading failed.");
      }
      renderHint();
      reflectState();
    },
    dispose() {
      windowObject.clearTimeout(announcement);
      windowObject.clearTimeout(blurTimer);
      for (const remove of listeners) {
        remove();
      }
      setOpen(false);
    },
  });
}

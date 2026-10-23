// A 360px inspector must leave at least 640px of canvas. Short/zoomed windows
// use the same modal presentation as compact screens, without a stored preference.
export function canDockDetails({ innerWidth, innerHeight }) {
  return innerWidth > 1024 && innerWidth - 360 >= 640 && innerHeight >= 480;
}

export function createAdaptiveDetailsSurface({
  documentObject = document,
  windowObject = window,
  setDockVisible,
  hideNavigationMenus,
}) {
  const doc = documentObject;
  const lifecycle = new AbortController();
  const panel = doc.getElementById("detailsArea");
  const content = doc.getElementById("generalDetails");
  const editor = doc.getElementById("generalDetailsEdit");
  const palette = doc.getElementById("containerForLeftSideBar");
  const paletteParent = palette.parentNode;
  const paletteNext = palette.nextSibling;
  const dialog = doc.getElementById("entity-details-dialog");
  const editorDialog = doc.getElementById("ontology-editor-dialog");
  const pin = doc.getElementById("entity-details-pin");
  const toggle = doc.getElementById("sidebarExpandButton");
  const editorOpen = doc.getElementById("ontology-editor-open");
  let isEditor = false;
  let editorDockOpen = true;
  let previousWide;
  let detailsOpen = false;
  let pinned = false;
  let invoker;
  let ignoreClose = 0;
  let onDetailsClose = () => {};
  let onDetailsOpen = () => {};

  function on(element, type, listener) {
    element.addEventListener(type, listener, { signal: lifecycle.signal });
  }
  function closeModal() {
    if (dialog.open) {
      ignoreClose++;
      dialog.close();
    }
  }
  function restoreEditor() {
    if (editor.parentNode !== panel) {
      panel.prepend(editor);
    }
    if (palette.parentNode !== paletteParent) {
      paletteParent.insertBefore(palette, paletteNext);
    }
  }
  function apply() {
    const wide = canDockDetails(windowObject);
    const focused = doc.activeElement;
    const focusInEditor = editor.contains(focused) || palette.contains(focused);
    const focusInDetails = content.contains(focused);
    pin.hidden = !wide;
    editorOpen.hidden = !isEditor || wide;
    toggle.hidden = isEditor && !wide;
    if (isEditor) {
      closeModal();
      if (wide) {
        if (editorDialog.open) {
          editorDialog.close();
        }
        restoreEditor();
      } else {
        const body = doc.getElementById("ontology-editor-body");
        if (editor.parentNode !== body) {
          body.append(editor, palette);
        }
        if (previousWide && editorDockOpen && !editorDialog.open) {
          editorDialog.showModal();
        }
      }
      setDockVisible(wide && editorDockOpen ? 1 : 0, true);
      if (focusInEditor) {
        focused.focus();
      } else if (wide && editorDialog.contains(focused)) {
        toggle.focus();
      } else if (!wide && previousWide && editorDialog.open) {
        doc.getElementById("ontology-editor-heading").focus();
      }
    } else {
      if (editorDialog.open) {
        editorDialog.close();
      }
      restoreEditor();
      const docked = detailsOpen && pinned && wide;
      if (docked || !detailsOpen) {
        closeModal();
        if (content.parentNode !== panel) {
          panel.append(content);
        }
      } else {
        const body = doc.getElementById("entity-details-body");
        if (content.parentNode !== body) {
          body.append(content);
        }
        if (!dialog.open) {
          dialog.showModal();
        }
      }
      setDockVisible(docked ? 1 : 0, true);
      toggle.setAttribute("aria-expanded", String(detailsOpen));
      toggle.setAttribute(
        "aria-label",
        detailsOpen ? "Close details" : "Open details",
      );
      if (focusInDetails && detailsOpen) {
        focused.focus();
      }
    }
    previousWide = wide;
  }
  function openDetails(source = doc.activeElement, { pinToSide = false } = {}) {
    if (isEditor) {
      return;
    }
    invoker = source;
    detailsOpen = true;
    pinned = pinToSide && canDockDetails(windowObject);
    hideNavigationMenus();
    onDetailsOpen();
    apply();
    (pinned
      ? doc.getElementById("entity-inspector-heading")
      : doc.getElementById("entity-details-heading")
    )?.focus();
  }
  function closeDetails() {
    if (!detailsOpen) {
      return;
    }
    detailsOpen = false;
    pinned = false;
    apply();
    onDetailsClose();
    (invoker?.isConnected
      ? invoker
      : doc.getElementById("ontology-overview-open")
    )?.focus();
  }
  on(dialog, "close", () => {
    if (ignoreClose) {
      ignoreClose--;
    } else {
      closeDetails();
    }
  });
  on(pin, "click", () => {
    pinned = true;
    apply();
    doc.getElementById("entity-inspector-heading").focus();
  });
  on(doc.getElementById("entity-inspector-close"), "click", closeDetails);
  on(editorOpen, "click", () => {
    hideNavigationMenus();
    editorDialog.showModal();
    doc.getElementById("ontology-editor-heading").focus();
  });
  on(editorDialog, "close", () => {
    if (isEditor && !canDockDetails(windowObject)) {
      editorOpen.focus();
    }
  });
  on(windowObject, "resize", apply);
  apply();
  return Object.freeze({
    openDetails,
    closeDetails,
    toggleDetails() {
      if (isEditor) {
        if (!canDockDetails(windowObject)) {
          editorDialog.showModal();
          doc.getElementById("ontology-editor-heading").focus();
        } else {
          editorDockOpen = !editorDockOpen;
          apply();
        }
      } else if (detailsOpen) {
        closeDetails();
      } else {
        openDetails(toggle, { pinToSide: canDockDetails(windowObject) });
      }
    },
    applyShareLinkVisibility(value) {
      // A compact bookmark never opens a modal or reduces the graph width.
      if (canDockDetails(windowObject) && value === 1) {
        openDetails(toggle, { pinToSide: true });
      } else {
        closeDetails();
      }
    },
    renderEditorMode(value) {
      const changed = isEditor !== value;
      isEditor = value;
      if (changed && isEditor) {
        detailsOpen = false;
        pinned = false;
        editorDockOpen = true;
        onDetailsClose();
      }
      apply();
      if (changed && isEditor && !canDockDetails(windowObject)) {
        editorDialog.showModal();
        doc.getElementById("ontology-editor-heading").focus();
      }
    },
    onClose(listener) {
      onDetailsClose = listener;
    },
    onOpen(listener) {
      onDetailsOpen = listener;
    },
    isOpen: () => detailsOpen,
    isDocked: () => detailsOpen && pinned && canDockDetails(windowObject),
    dispose() {
      lifecycle.abort();
      closeModal();
      if (editorDialog.open) {
        editorDialog.close();
      }
      panel.append(content);
      restoreEditor();
    },
  });
}

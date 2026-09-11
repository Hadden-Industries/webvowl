import { runVisualizationControlAction } from "../ui/visualizationControlAction.js";

/**
 * Presents ontology search results and requests visualization focus.
 */
export function createSearchMenu({
  documentObject = globalThis.document,
  onOntologyIriEntered,
  webVowlController,
  windowObject = globalThis.window,
} = {}) {
  const searchMenu = {};
  let focusableElementCountsBySearchEntry = [];
  let hasVisualizationFocus = false;
  let dictionary = [];
  let entryNames = [];
  let searchLineEdit;
  let mergedStringsList;
  let mergedIdList;
  const maxEntries = 6;
  let inputText;
  let menuEnabled = true;
  let locateAvailable = false;
  let visualViewportAnimationFrame;

  let results = [];
  let resultID = [];
  const c_locate = documentObject.getElementById("locateSearchResult");
  const listbox = documentObject.getElementById("search-results-listbox");

  // The controller owns element identity and visibility, so the dropdown is
  // built from what it reports rather than from the renderer's own dictionary.
  function loadSearchResultsForQuery(queryText) {
    mergedStringsList = [];
    mergedIdList = [];
    focusableElementCountsBySearchEntry = [];
    dictionary = [];
    entryNames = [];
    if (webVowlController === undefined || queryText.length === 0) {
      return;
    }

    let searchResult;
    try {
      // The reader sees every match, as before; bounding belongs to the agent
      // protocol rather than to this control.
      searchResult = webVowlController.findOntologyElements({
        query: queryText,
      });
    } catch {
      // No ontology is loaded, so there is nothing to offer.
      return;
    }

    const groupsByLabel = new Map();
    for (const ontologyElementMatch of searchResult.matches) {
      const group = groupsByLabel.get(ontologyElementMatch.displayLabel) ?? {
        references: [],
        focusableCount: 0,
      };
      group.references.push(ontologyElementMatch.ontologyElementReference);
      if (ontologyElementMatch.isFocusable) {
        group.focusableCount += 1;
      }
      groupsByLabel.set(ontologyElementMatch.displayLabel, group);
    }

    for (const [displayLabel, group] of groupsByLabel) {
      mergedStringsList.push(displayLabel);
      mergedIdList.push(group.references);
      focusableElementCountsBySearchEntry.push(group.focusableCount);
      dictionary.push(displayLabel);
      entryNames.push(displayLabel);
    }
  }

  function setLocateButtonState(enabled) {
    locateAvailable = Boolean(enabled);
    const effectiveEnabled = menuEnabled && locateAvailable;
    if (c_locate) {
      if (effectiveEnabled) {
        c_locate.classList.add("highlighted");
      } else {
        c_locate.classList.remove("highlighted");
      }
      c_locate.disabled = !effectiveEnabled;
      const titleText = effectiveEnabled
        ? "Locate focused element"
        : "Nothing to locate";
      c_locate.title = titleText;
      c_locate.setAttribute("aria-label", titleText);
    }
  }

  function expandMobileSearch() {
    documentObject.getElementById("c_search").classList.add("search-expanded");
    documentObject
      .getElementById("scrollLeftButton")
      .classList.add("hidden-by-search");
    documentObject
      .getElementById("scrollRightButton")
      .classList.add("hidden-by-search");
    updateClearButtonVisibility();
  }

  function collapseMobileSearch() {
    documentObject
      .getElementById("c_search")
      .classList.remove("search-expanded");
    documentObject
      .getElementById("scrollLeftButton")
      .classList.remove("hidden-by-search");
    documentObject
      .getElementById("scrollRightButton")
      .classList.remove("hidden-by-search");
  }

  function updateVisualViewportMetrics() {
    if (
      !windowObject.visualViewport ||
      !documentObject.documentElement ||
      !documentObject.documentElement.style
    ) {
      return;
    }

    const updateMetrics = function () {
      visualViewportAnimationFrame = undefined;
      documentObject.documentElement.style.setProperty(
        "--visual-viewport-height",
        windowObject.visualViewport.height + "px",
      );
      documentObject.documentElement.style.setProperty(
        "--visual-viewport-offset-top",
        windowObject.visualViewport.offsetTop + "px",
      );
    };

    if (
      visualViewportAnimationFrame !== undefined &&
      typeof cancelAnimationFrame === "function"
    ) {
      cancelAnimationFrame(visualViewportAnimationFrame);
    }
    if (typeof requestAnimationFrame === "function") {
      visualViewportAnimationFrame = requestAnimationFrame(updateMetrics);
    } else {
      updateMetrics();
    }
  }

  function portalSearchResults() {
    const overlayLayer = documentObject.getElementById(
      "applicationOverlayLayer",
    );
    const listboxNode = listbox;
    if (
      overlayLayer &&
      listboxNode &&
      listboxNode.parentNode !== overlayLayer
    ) {
      overlayLayer.appendChild(listboxNode);
    }
  }

  searchMenu.setup = function () {
    // clear dictionary;
    dictionary = [];

    portalSearchResults();

    setLocateButtonState(false);

    searchLineEdit = documentObject.getElementById("search-input-text");

    searchLineEdit.addEventListener("input", userInput);
    searchLineEdit.addEventListener("keydown", userNavigation);
    searchLineEdit.addEventListener("click", function () {
      updateSelectionStatusFlags();
      searchMenu.showSearchEntries();
    });
    searchLineEdit.addEventListener("focus", hoverSearchEntryView);

    const mobileToggleBtn = documentObject.getElementById(
      "mobile-search-toggle-btn",
    );
    mobileToggleBtn.addEventListener("click", function (event) {
      if (!menuEnabled) {
        return;
      }
      if (event) {
        event.stopPropagation();
      }
      expandMobileSearch();
      if (searchLineEdit) {
        searchLineEdit.focus();
      }
      updateSelectionStatusFlags();
      searchMenu.showSearchEntries();
    });

    const clearBtn = documentObject.getElementById("search-clear-btn");
    clearBtn.addEventListener("click", function (event) {
      if (!menuEnabled) {
        return;
      }
      if (event) {
        event.stopPropagation();
      }
      searchMenu.clearText();
      searchMenu.clearVisualizationFocus();
      if (searchLineEdit) {
        searchLineEdit.focus();
      }
    });

    if (c_locate) {
      c_locate.addEventListener("click", function () {
        if (c_locate.classList.contains("highlighted")) {
          searchMenu.advanceToNextFocusedElement();
        }
      });
    }

    // Light dismiss: Close search listbox & mobile overlay when tapping outside c_search or search-results-listbox
    const dismissSearchOnOutsideTap = function (event) {
      const cSearchNode = documentObject.getElementById("c_search");
      const listboxNode = listbox;
      const cLocateNode = documentObject.getElementById("c_locate");
      if (event && event.target) {
        if (cSearchNode && cSearchNode.contains(event.target)) {
          return;
        }
        if (listboxNode && listboxNode.contains(event.target)) {
          return;
        }
        if (cLocateNode && cLocateNode.contains(event.target)) {
          return;
        }
      }
      searchMenu.hideSearchEntries();
      collapseMobileSearch();
    };

    documentObject.addEventListener("click", dismissSearchOnOutsideTap);
    documentObject.addEventListener("pointerdown", dismissSearchOnOutsideTap);
    documentObject.addEventListener("touchstart", dismissSearchOnOutsideTap);

    if (listbox) {
      listbox.addEventListener("click", function (event) {
        let target = event && event.target;
        while (target && target !== this && target.tagName !== "LI") {
          target = target.parentElement;
        }
        if (
          target &&
          target.classList &&
          target.classList.contains("search-option") &&
          !target.classList.contains("search-entry-disabled")
        ) {
          const elementId = target.getAttribute("elementID");
          if (elementId !== null && elementId !== undefined) {
            selectSearchResult(parseInt(elementId, 10), event);
          }
        }
      });
    }

    if (windowObject.visualViewport) {
      const handleVisualViewportChange = function () {
        updateVisualViewportMetrics();
        if (listbox && !listbox.classList.contains("hidden")) {
          searchMenu.showSearchEntries();
        }
      };

      updateVisualViewportMetrics();
      windowObject.visualViewport.addEventListener(
        "resize",
        handleVisualViewportChange,
      );
      windowObject.visualViewport.addEventListener(
        "scroll",
        handleVisualViewportChange,
      );
    }
  };

  function hoverSearchEntryView() {
    updateSelectionStatusFlags();
    searchMenu.showSearchEntries();
  }

  searchMenu.hideSearchEntries = function () {
    if (listbox) {
      listbox.classList.add("hidden");
    }
    if (searchLineEdit) {
      searchLineEdit.setAttribute("aria-expanded", "false");
      searchLineEdit.removeAttribute("aria-activedescendant");
    }
  };

  searchMenu.showSearchEntries = function () {
    if (listbox && listbox.children.length > 0) {
      listbox.classList.remove("hidden");
      if (searchLineEdit) {
        searchLineEdit.setAttribute("aria-expanded", "true");
      }
    } else {
      searchMenu.hideSearchEntries();
    }
  };

  function updateSelectionStatusFlags() {
    if (searchLineEdit.value.length === 0) {
      createSearchEntries();
      return;
    }
    handleAutoCompletion();
  }

  function userNavigation(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      searchMenu.hideSearchEntries();
      collapseMobileSearch();
      return;
    }

    if (!listbox) {
      return;
    }
    const htmlCollection = listbox.children;
    const numEntries = htmlCollection.length;

    let move = 0;
    let i;
    let selectedEntry = -1;
    for (i = 0; i < numEntries; i++) {
      if (
        htmlCollection[i].getAttribute("aria-selected") === "true" ||
        htmlCollection[i].classList.contains("selected")
      ) {
        selectedEntry = i;
      }
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (selectedEntry >= 0 && selectedEntry < numEntries) {
        const elementId =
          htmlCollection[selectedEntry].getAttribute("elementID");
        selectSearchResult(parseInt(elementId, 10), event);
        searchMenu.hideSearchEntries();
      } else if (numEntries === 0) {
        let ontologyUrl;
        try {
          ontologyUrl = new URL(
            searchLineEdit.value.replace(/%20/g, " ").trim(),
          );
        } catch {
          return;
        }
        if (
          ["http:", "https:"].includes(ontologyUrl.protocol) &&
          onOntologyIriEntered
        ) {
          onOntologyIriEntered(ontologyUrl.href);
          searchLineEdit.value = "";
        }
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      move = -1;
      searchMenu.showSearchEntries();
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move = +1;
      searchMenu.showSearchEntries();
    }

    const newSelection = selectedEntry + move;
    if (newSelection !== selectedEntry && numEntries > 0) {
      let targetIdx = newSelection;
      if (targetIdx < 0) {
        targetIdx = numEntries - 1;
      } else if (targetIdx >= numEntries) {
        targetIdx = 0;
      }

      for (i = 0; i < numEntries; i++) {
        htmlCollection[i].setAttribute("aria-selected", "false");
        htmlCollection[i].classList.remove("selected");
      }

      const activeOpt = htmlCollection[targetIdx];
      activeOpt.setAttribute("aria-selected", "true");
      activeOpt.classList.add("selected");
      searchLineEdit.setAttribute("aria-activedescendant", activeOpt.id);
    }
  }

  searchMenu.getSearchString = function () {
    return searchLineEdit.value;
  };

  function clearSearchEntries() {
    if (listbox) {
      const htmlCollection = listbox.children;
      const numEntries = htmlCollection.length;
      for (let i = 0; i < numEntries; i++) {
        htmlCollection[0].remove();
      }
    }
    results = [];
    resultID = [];
  }

  function createSearchEntries() {
    inputText = searchLineEdit.value;
    // The controller already matched the query, so every entry is a result.
    loadSearchResultsForQuery(inputText);
    for (let i = 0; i < dictionary.length; i++) {
      results.push(dictionary[i]);
      resultID.push(i);
    }
  }

  function highlightQueryMatch(fullText, query) {
    const label = documentObject.createElement("span");
    const idx = fullText.toLowerCase().indexOf(query.toLowerCase());
    if (!query || idx === -1) {
      label.textContent = fullText;
      return label;
    }
    label.appendChild(
      documentObject.createTextNode(fullText.substring(0, idx)),
    );
    const match = documentObject.createElement("mark");
    match.classList.add("search-match");
    match.textContent = fullText.substring(idx, idx + query.length);
    label.appendChild(match);
    label.appendChild(
      documentObject.createTextNode(fullText.substring(idx + query.length)),
    );
    return label;
  }

  function createDropDownElements() {
    if (!listbox) {
      return;
    }
    // The controller ranks matches by relevance (exact label, then prefix,
    // then containment), so the dropdown presents them in that order.
    const newResults = [...results];
    const newResultsIds = [...resultID];

    let i;
    let numEntries = newResults.length;
    if (numEntries > maxEntries) {
      numEntries = maxEntries;
    }

    for (i = 0; i < numEntries; i++) {
      const optionId = "search-option-" + i;
      const testEntry = documentObject.createElement("li");
      testEntry.setAttribute("id", optionId);
      testEntry.setAttribute("role", "option");
      testEntry.setAttribute("aria-selected", "false");
      testEntry.setAttribute("elementID", newResultsIds[i]);
      testEntry.onclick = handleClick(newResultsIds[i]);
      testEntry.setAttribute("class", "search-option");

      const entries = mergedIdList[newResultsIds[i]];
      const eLen = entries.length;

      const referenceKeyOf = (elementReference) =>
        elementReference.iri ?? elementReference.localId;
      const el0 = referenceKeyOf(entries[0]);
      let allSame = true;
      const visible =
        focusableElementCountsBySearchEntry[newResultsIds[i]] ?? 0;

      for (let a = 0; a < eLen; a++) {
        if (el0 !== referenceKeyOf(entries[a])) {
          allSame = false;
        }
      }

      const rawTitle = newResults[i];
      const queryStr = searchLineEdit.value;
      testEntry.appendChild(highlightQueryMatch(rawTitle, queryStr));

      if (eLen > 1 && allSame === false) {
        const badge = documentObject.createElement("span");
        badge.classList.add("search-count-badge");
        badge.textContent =
          eLen !== visible ? `${visible}/${eLen} visible` : String(eLen);
        testEntry.appendChild(badge);
      }

      if (eLen === 1 || allSame === true) {
        if (visible < 1) {
          testEntry.classList.add("search-entry-disabled");
          testEntry.title = rawTitle + "\nElement is filtered out.";
          testEntry.onclick = function () {};
        }
      } else {
        if (visible < 1) {
          testEntry.classList.add("search-entry-disabled");
          testEntry.onclick = function () {};
          testEntry.title = rawTitle + "\nAll elements are filtered out.";
        } else {
          testEntry.classList.remove("search-entry-disabled");
        }
        if (visible < eLen && visible > 1) {
          testEntry.title =
            rawTitle + "\n" + visible + "/" + eLen + " elements are visible.";
        }
      }

      listbox.appendChild(testEntry);
    }
  }

  function handleAutoCompletion() {
    clearSearchEntries();
    createSearchEntries();
    createDropDownElements();
  }

  function updateClearButtonVisibility() {
    const clearBtn = documentObject.getElementById("search-clear-btn");
    if (clearBtn) {
      const hasValue = searchLineEdit && searchLineEdit.value.length > 0;
      if (!hasValue && !hasVisualizationFocus) {
        clearBtn.classList.add("hidden");
      } else {
        clearBtn.classList.remove("hidden");
      }
    }
  }

  function userInput() {
    setLocateButtonState(false);

    searchMenu.clearVisualizationFocus();

    // The controller answers each query, so there is no dictionary to
    // populate ahead of time and nothing to guard against here.
    inputText = searchLineEdit.value;
    updateClearButtonVisibility();

    clearSearchEntries();
    if (inputText.length !== 0) {
      createSearchEntries();
      createDropDownElements();
    }

    searchMenu.showSearchEntries();
  }

  function handleClick(elementId) {
    return function (event) {
      selectSearchResult(elementId, event);
    };
  }

  // The same standing focus drives these controls regardless of its caller.
  // Query text and the details-panel selection are independent of that focus.
  searchMenu.renderVisualizationFocus = function ({
    focus,
    focusableElementCount,
  }) {
    hasVisualizationFocus = focus.length > 0;
    setLocateButtonState(focusableElementCount > 0);
    updateClearButtonVisibility();
  };

  // Clearing highlights is a controller action; presenting its resulting state
  // does not issue another request or change the detail selection.
  searchMenu.clearVisualizationFocus = function () {
    if (hasVisualizationFocus === false) {
      return undefined;
    }
    hasVisualizationFocus = false;
    setLocateButtonState(false);
    updateClearButtonVisibility();
    return runVisualizationControlAction(
      () => webVowlController?.setVisualizationView({ focus: [] }),
      documentObject,
    );
  };

  // Both human search results and agent references use the same focus action.
  searchMenu.focusOntologyElements = function (ontologyElementReferences) {
    if (
      webVowlController === undefined ||
      ontologyElementReferences.length === 0
    ) {
      return undefined;
    }
    hasVisualizationFocus = true;
    return runVisualizationControlAction(
      () =>
        webVowlController.setVisualizationView({
          focus: [...ontologyElementReferences],
        }),
      documentObject,
    );
  };

  // Locating is its own action: the reader asks to see the next element among
  // those already highlighted, and the runtime decides how to move the view.
  searchMenu.advanceToNextFocusedElement = function () {
    return runVisualizationControlAction(
      () => webVowlController?.setVisualizationView({ viewport: "focus-next" }),
      documentObject,
    );
  };

  function selectSearchResult(elementId, event) {
    if (event && event.stopPropagation) {
      event.stopPropagation();
    }
    const id = parseInt(elementId, 10);
    const correspondingIds = mergedIdList[id];
    const autoComStr = entryNames[id];
    if (searchLineEdit) {
      searchLineEdit.value = autoComStr;
    }
    updateClearButtonVisibility();

    // Locating is offered only when at least one match is actually drawn,
    // which is what the controller reports through isFocusable.
    setLocateButtonState((focusableElementCountsBySearchEntry[id] ?? 0) > 0);
    if (correspondingIds) {
      searchMenu.focusOntologyElements(correspondingIds);
    }
    if (autoComStr !== inputText) {
      handleAutoCompletion();
    }
    searchMenu.hideSearchEntries();
  }

  searchMenu.clearText = function () {
    if (searchLineEdit) {
      searchLineEdit.value = "";
    }
    setLocateButtonState(false);
    updateClearButtonVisibility();
    if (listbox) {
      const htmlCollection = listbox.children;
      const numEntries = htmlCollection.length;
      for (let i = 0; i < numEntries; i++) {
        htmlCollection[0].remove();
      }
    }
  };

  searchMenu.setMenuMode = function (enabled) {
    menuEnabled = Boolean(enabled);
    documentObject.getElementById("search-input-text").disabled = !menuEnabled;
    documentObject.getElementById("mobile-search-toggle-btn").disabled =
      !menuEnabled;
    documentObject.getElementById("search-clear-btn").disabled = !menuEnabled;
    setLocateButtonState(locateAvailable);
    if (!menuEnabled) {
      searchMenu.hideSearchEntries();
      collapseMobileSearch();
    }
  };

  return searchMenu;
}

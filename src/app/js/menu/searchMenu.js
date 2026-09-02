import { applicationUiModule } from "../ui/applicationUiRegistry.js";
/**
 * Contains the search "engine"
 *
 * @param graph the associated webvowl graph
 * @returns {{}}
 */
export function createSearchMenu(
  graph,
  {
    documentObject = globalThis.document,
    webVowlController,
    windowObject = globalThis.window,
  } = {},
) {
  const searchMenu = {};
  let focusableElementCountsBySearchEntry = [];
  let hasReportedOntologySelection = false;
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

  String.prototype.beginsWith = function (string) {
    return this.indexOf(string) === 0;
  };

  searchMenu.requestDictionaryUpdate = function () {
    if (listbox) {
      while (listbox.children.length > 0) {
        listbox.children[0].remove();
      }
    }
    if (searchLineEdit) {
      searchLineEdit.value = "";
    }
  };

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
    const hasSearchText =
      searchLineEdit && searchLineEdit.value.trim().length > 0;
    locateAvailable = Boolean(enabled) && hasSearchText;
    const effectiveEnabled = menuEnabled && locateAvailable;
    if (c_locate) {
      if (effectiveEnabled) {
        c_locate.classList.add("highlighted");
      } else {
        c_locate.classList.remove("highlighted");
      }
      c_locate.disabled = !effectiveEnabled;
      const titleText = effectiveEnabled
        ? "Locate search term"
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
      searchMenu.reportClearedOntologySelection();
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

  function ValidURL(str) {
    const urlregex =
      /^(https?|ftp):\/\/([a-zA-Z0-9.-]+(:[a-zA-Z0-9.&%$-]+)*@)*((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}|([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.(com|edu|gov|int|mil|net|org|biz|arpa|info|name|pro|aero|coop|museum|[a-zA-Z]{2}))(:[0-9]+)*(\/($|[a-zA-Z0-9.,?'\\+&%$#=~_-]+))*$/;
    return urlregex.test(str);
  }

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
        inputText = searchLineEdit.value;
        let clearedText = inputText.replace(/%20/g, " ");
        while (clearedText.beginsWith(" ")) {
          clearedText = clearedText.substr(1, clearedText.length);
        }
        while (clearedText.endsWith(" ")) {
          clearedText = clearedText.substr(0, clearedText.length - 1);
        }
        const iri = clearedText.replace(/ /g, "%20");

        const valid = ValidURL(iri);
        if (valid) {
          const ontM = applicationUiModule("ontologyMenu");
          ontM.setIriText(iri);
          searchLineEdit.value = "";
        } else {
          console.warn(iri + " is not a valid URL!");
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
    if (!query) {
      return fullText;
    }
    const idx = fullText.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) {
      return fullText;
    }
    const before = fullText.substring(0, idx);
    const match = fullText.substring(idx, idx + query.length);
    const after = fullText.substring(idx + query.length);
    return before + '<mark class="search-match">' + match + "</mark>" + after;
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
      const matchHtml = highlightQueryMatch(rawTitle, queryStr);
      let badgeHtml = "";

      if (eLen > 1 && allSame === false) {
        if (eLen !== visible) {
          badgeHtml =
            '<span class="search-count-badge">' +
            visible +
            "/" +
            eLen +
            " visible</span>";
        } else {
          badgeHtml = '<span class="search-count-badge">' + eLen + "</span>";
        }
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

      testEntry.innerHTML = "<span>" + matchHtml + "</span>" + badgeHtml;
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
      if (!hasValue) {
        clearBtn.classList.add("hidden");
      } else {
        clearBtn.classList.remove("hidden");
      }
    }
  }

  function userInput() {
    setLocateButtonState(false);

    searchMenu.reportClearedOntologySelection();

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

  // Presentation of the controller's selection. Rendering never reports, so a
  // selection the renderer originated cannot echo back as a new fact.
  searchMenu.renderSelectedOntologyElements = function (
    selectedOntologyElementReferences,
  ) {
    if (selectedOntologyElementReferences.length > 0) {
      return;
    }
    hasReportedOntologySelection = false;
    searchMenu.clearText();
  };

  // Reporting that nothing is selected is as much a fact as reporting a
  // selection, so the runtime clears its own highlight. Applying that change
  // makes the renderer announce the cleared search, which the application
  // routes back into clearText, so only a real change is reported.
  searchMenu.reportClearedOntologySelection = function () {
    if (hasReportedOntologySelection === false) {
      return undefined;
    }
    hasReportedOntologySelection = false;
    return webVowlController?.setVisualizationView({ focus: [] });
  };

  // The menu reports which ontology element the reader picked. What focusing
  // means for the visible graph is the runtime's decision, not this module's.
  searchMenu.reportSelectedOntologyElements = function (
    ontologyElementReferences,
  ) {
    if (
      webVowlController === undefined ||
      ontologyElementReferences.length === 0
    ) {
      return undefined;
    }
    hasReportedOntologySelection = true;
    return webVowlController.setVisualizationView({
      focus: [...ontologyElementReferences],
    });
  };

  // Locating is its own action: the reader asks to see the next element among
  // those already highlighted, and the runtime decides how to move the view.
  searchMenu.advanceToNextFocusedElement = function () {
    return webVowlController?.setVisualizationView({ viewport: "focus-next" });
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
      searchMenu.reportSelectedOntologyElements(correspondingIds);
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

  searchMenu.updateLocateButtonVisibility = function (hasVisibleNodes) {
    setLocateButtonState(hasVisibleNodes);
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

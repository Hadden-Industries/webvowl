/**
 * Contains the search "engine"
 *
 * @param graph the associated webvowl graph
 * @returns {{}}
 */
module.exports = function (graph) {
  const searchMenu = {};
  let dictionary = [];
  let entryNames = [];
  let searchLineEdit;
  let mergedStringsList;
  let mergedIdList;
  const maxEntries = 6;
  let dictionaryUpdateRequired = true;
  let labelDictionary;
  let inputText;
  let menuEnabled = true;
  let locateAvailable = false;
  let visualViewportAnimationFrame;

  let results = [];
  let resultID = [];
  const c_locate = d3.select("#locateSearchResult");
  const listbox = d3.select("#search-results-listbox");

  String.prototype.beginsWith = function (string) {
    return this.indexOf(string) === 0;
  };

  searchMenu.requestDictionaryUpdate = function () {
    dictionaryUpdateRequired = true;
    if (listbox.node()) {
      const htmlCollection = listbox.node().children;
      const numEntries = htmlCollection.length;
      for (let i = 0; i < numEntries; i++) {
        htmlCollection[0].remove();
      }
    }
    if (searchLineEdit && searchLineEdit.node()) {
      searchLineEdit.node().value = "";
    }
  };

  function updateSearchDictionary() {
    labelDictionary = graph.getUpdateDictionary();
    dictionaryUpdateRequired = false;
    dictionary = [];
    entryNames = [];
    const idList = [];
    const stringList = [];

    let i;
    for (i = 0; i < labelDictionary.length; i++) {
      const lEntry = labelDictionary[i].labelForCurrentLanguage();
      idList.push(labelDictionary[i].id());
      stringList.push(lEntry);
      // add all equivalents to the search space;
      if (
        labelDictionary[i].equivalents &&
        labelDictionary[i].equivalents().length > 0
      ) {
        const eqs = labelDictionary[i].equivalentsString();
        const eqsLabels = eqs.split(", ");
        for (let e = 0; e < eqsLabels.length; e++) {
          idList.push(labelDictionary[i].id());
          stringList.push(eqsLabels[e]);
        }
      }
    }

    mergedStringsList = [];
    mergedIdList = [];
    let indexInStringList;
    let currentString;
    let currentObjectId;

    for (i = 0; i < stringList.length; i++) {
      if (i === 0) {
        // just add the elements
        mergedStringsList.push(stringList[i]);
        mergedIdList.push([]);
        mergedIdList[0].push(idList[i]);
        continue;
      } else {
        currentString = stringList[i];
        currentObjectId = idList[i];
        indexInStringList = mergedStringsList.indexOf(currentString);
      }
      if (indexInStringList === -1) {
        mergedStringsList.push(stringList[i]);
        mergedIdList.push([]);
        const lastEntry = mergedIdList.length;
        mergedIdList[lastEntry - 1].push(currentObjectId);
      } else {
        mergedIdList[indexInStringList].push(currentObjectId);
      }
    }

    for (i = 0; i < mergedStringsList.length; i++) {
      const aString = mergedStringsList[i];
      dictionary.push(aString);
      entryNames.push(aString);
    }
  }

  function setLocateButtonState(enabled) {
    const hasSearchText =
      searchLineEdit &&
      searchLineEdit.node() &&
      searchLineEdit.node().value.trim().length > 0;
    locateAvailable = Boolean(enabled) && hasSearchText;
    const effectiveEnabled = menuEnabled && locateAvailable;
    if (c_locate && c_locate.node()) {
      c_locate.classed("highlighted", effectiveEnabled);
      c_locate.property("disabled", !effectiveEnabled);
      if (typeof c_locate.node().disabled !== "undefined") {
        c_locate.node().disabled = !effectiveEnabled;
      }
      const titleText = effectiveEnabled
        ? "Locate search term"
        : "Nothing to locate";
      c_locate.node().title = titleText;
      c_locate.attr("aria-label", titleText);
    }
  }

  function expandMobileSearch() {
    d3.select("#c_search").classed("search-expanded", true);
    d3.select("#scrollLeftButton").classed("hidden-by-search", true);
    d3.select("#scrollRightButton").classed("hidden-by-search", true);
    updateClearButtonVisibility();
  }

  function collapseMobileSearch() {
    d3.select("#c_search").classed("search-expanded", false);
    d3.select("#scrollLeftButton").classed("hidden-by-search", false);
    d3.select("#scrollRightButton").classed("hidden-by-search", false);
  }

  function updateVisualViewportMetrics() {
    if (
      !window.visualViewport ||
      !document.documentElement ||
      !document.documentElement.style
    ) {
      return;
    }

    const updateMetrics = function () {
      visualViewportAnimationFrame = undefined;
      document.documentElement.style.setProperty(
        "--visual-viewport-height",
        window.visualViewport.height + "px",
      );
      document.documentElement.style.setProperty(
        "--visual-viewport-offset-top",
        window.visualViewport.offsetTop + "px",
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
    const overlayLayer = document.getElementById("applicationOverlayLayer");
    const listboxNode = listbox.node();
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

    searchLineEdit = d3.select("#search-input-text");

    searchLineEdit.on("input", userInput);
    searchLineEdit.on("keydown", userNavigation);
    searchLineEdit.on("click", function () {
      updateSelectionStatusFlags();
      searchMenu.showSearchEntries();
    });
    searchLineEdit.on("focus", hoverSearchEntryView);

    const mobileToggleBtn = d3.select("#mobile-search-toggle-btn");
    mobileToggleBtn.on("click", function (event) {
      if (!menuEnabled) {
        return;
      }
      if (event) {
        event.stopPropagation();
      }
      expandMobileSearch();
      if (searchLineEdit && searchLineEdit.node()) {
        searchLineEdit.node().focus();
      }
      updateSelectionStatusFlags();
      searchMenu.showSearchEntries();
    });

    const clearBtn = d3.select("#search-clear-btn");
    clearBtn.on("click", function (event) {
      if (!menuEnabled) {
        return;
      }
      if (event) {
        event.stopPropagation();
      }
      searchMenu.clearText();
      if (searchLineEdit && searchLineEdit.node()) {
        searchLineEdit.node().focus();
      }
    });

    c_locate.on("click", function () {
      if (c_locate.classed("highlighted")) {
        graph.locateSearchResult();
      }
    });

    // Light dismiss: Close search listbox & mobile overlay when tapping outside c_search or search-results-listbox
    const dismissSearchOnOutsideTap = function (event) {
      const cSearchNode = d3.select("#c_search").node();
      const listboxNode = listbox.node();
      const cLocateNode = d3.select("#c_locate").node();
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

    d3.select(document)
      .on("click.searchCombobox", dismissSearchOnOutsideTap)
      .on("pointerdown.searchCombobox", dismissSearchOnOutsideTap)
      .on("touchstart.searchCombobox", dismissSearchOnOutsideTap);

    listbox.on("click", function (event) {
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

    if (window.visualViewport) {
      const handleVisualViewportChange = function () {
        updateVisualViewportMetrics();
        if (listbox.node() && !listbox.classed("hidden")) {
          searchMenu.showSearchEntries();
        }
      };

      updateVisualViewportMetrics();
      window.visualViewport.addEventListener(
        "resize",
        handleVisualViewportChange,
      );
      window.visualViewport.addEventListener(
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
    listbox.classed("hidden", true);
    if (searchLineEdit && searchLineEdit.node()) {
      searchLineEdit.attr("aria-expanded", "false");
      searchLineEdit.attr("aria-activedescendant", null);
    }
  };

  searchMenu.showSearchEntries = function () {
    if (listbox.node() && listbox.node().children.length > 0) {
      listbox.classed("hidden", false);
      if (searchLineEdit && searchLineEdit.node()) {
        searchLineEdit.attr("aria-expanded", "true");
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
    if (searchLineEdit.node().value.length === 0) {
      createSearchEntries();
      return;
    }
    handleAutoCompletion();
  }

  function userNavigation(event) {
    if (dictionaryUpdateRequired) {
      updateSearchDictionary();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      searchMenu.hideSearchEntries();
      collapseMobileSearch();
      return;
    }

    const htmlCollection = listbox.node().children;
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
        inputText = searchLineEdit.node().value;
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
          const ontM = graph.options().ontologyMenu();
          ontM.setIriText(iri);
          searchLineEdit.node().value = "";
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
      searchLineEdit.attr("aria-activedescendant", activeOpt.id);
    }
  }

  searchMenu.getSearchString = function () {
    return searchLineEdit.node().value;
  };

  function clearSearchEntries() {
    if (listbox.node()) {
      const htmlCollection = listbox.node().children;
      const numEntries = htmlCollection.length;
      for (let i = 0; i < numEntries; i++) {
        htmlCollection[0].remove();
      }
    }
    results = [];
    resultID = [];
  }

  function createSearchEntries() {
    inputText = searchLineEdit.node().value;
    let i;
    const lc_text = inputText.toLowerCase();
    let token;

    for (i = 0; i < dictionary.length; i++) {
      const tokenElement = dictionary[i];
      if (tokenElement === undefined) {
        continue;
      }
      token = dictionary[i].toLowerCase();
      if (token.indexOf(lc_text) > -1) {
        results.push(dictionary[i]);
        resultID.push(i);
      }
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
    const copyRes = [];
    let i;
    for (i = 0; i < results.length; i++) {
      copyRes.push(results[i]);
    }

    const newResults = [];
    const newResultsIds = [];

    while (copyRes.length > 0) {
      let minLen = Number.MAX_VALUE;
      let minIdx = -1;
      for (i = 0; i < copyRes.length; i++) {
        if (copyRes[i] !== "") {
          if (copyRes[i].length < minLen) {
            minLen = copyRes[i].length;
            minIdx = i;
          }
        }
      }
      if (minIdx === -1) {
        break;
      }
      newResults.push(copyRes[minIdx]);
      newResultsIds.push(resultID[minIdx]);
      copyRes[minIdx] = "";
    }

    let numEntries = newResults.length;
    if (numEntries > maxEntries) {
      numEntries = maxEntries;
    }

    for (i = 0; i < numEntries; i++) {
      const optionId = "search-option-" + i;
      const testEntry = document.createElement("li");
      testEntry.setAttribute("id", optionId);
      testEntry.setAttribute("role", "option");
      testEntry.setAttribute("aria-selected", "false");
      testEntry.setAttribute("elementID", newResultsIds[i]);
      testEntry.onclick = handleClick(newResultsIds[i]);
      testEntry.setAttribute("class", "search-option");

      const entries = mergedIdList[newResultsIds[i]];
      const eLen = entries.length;

      const el0 = entries[0];
      let allSame = true;
      const nodeMap = graph.getNodeMapForSearch();
      let visible = eLen;
      if (eLen > 1) {
        for (let q = 0; q < eLen; q++) {
          if (nodeMap[entries[q]] === undefined) {
            visible--;
          }
        }
      }

      for (let a = 0; a < eLen; a++) {
        if (el0 !== entries[a]) {
          allSame = false;
        }
      }

      const rawTitle = newResults[i];
      const queryStr = searchLineEdit.node().value;
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

      const searchEntryNode = d3.select(testEntry);
      if (eLen === 1 || allSame === true) {
        if (nodeMap[entries[0]] === undefined) {
          searchEntryNode.classed("search-entry-disabled", true);
          testEntry.title = rawTitle + "\nElement is filtered out.";
          testEntry.onclick = function () {};
        }
      } else {
        if (visible < 1) {
          searchEntryNode.classed("search-entry-disabled", true);
          testEntry.onclick = function () {};
          testEntry.title = rawTitle + "\nAll elements are filtered out.";
        } else {
          searchEntryNode.classed("search-entry-disabled", false);
        }
        if (visible < eLen && visible > 1) {
          testEntry.title =
            rawTitle + "\n" + visible + "/" + eLen + " elements are visible.";
        }
      }

      testEntry.innerHTML = "<span>" + matchHtml + "</span>" + badgeHtml;
      listbox.node().appendChild(testEntry);
    }
  }

  function handleAutoCompletion() {
    clearSearchEntries();
    createSearchEntries();
    createDropDownElements();
  }

  function updateClearButtonVisibility() {
    const clearBtn = d3.select("#search-clear-btn");
    if (clearBtn.node()) {
      const hasValue =
        searchLineEdit &&
        searchLineEdit.node() &&
        searchLineEdit.node().value.length > 0;
      clearBtn.classed("hidden", !hasValue);
    }
  }

  function userInput() {
    setLocateButtonState(false);

    if (dictionaryUpdateRequired) {
      updateSearchDictionary();
    }
    graph.resetSearchHighlight();

    if (dictionary.length === 0) {
      console.warn("dictionary is empty");
      return;
    }
    inputText = searchLineEdit.node().value;
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

  function selectSearchResult(elementId, event) {
    if (event && event.stopPropagation) {
      event.stopPropagation();
    }
    const id = parseInt(elementId, 10);
    const correspondingIds = mergedIdList[id];
    const autoComStr = entryNames[id];
    if (searchLineEdit && searchLineEdit.node()) {
      searchLineEdit.node().value = autoComStr;
    }
    updateClearButtonVisibility();

    if (correspondingIds && graph) {
      graph.resetSearchHighlight();
      graph.highLightNodes(correspondingIds);
    } else {
      setLocateButtonState(true);
    }
    if (autoComStr !== inputText) {
      handleAutoCompletion();
    }
    searchMenu.hideSearchEntries();
  }

  searchMenu.clearText = function () {
    if (searchLineEdit && searchLineEdit.node()) {
      searchLineEdit.node().value = "";
    }
    if (graph && graph.resetSearchHighlight) {
      graph.resetSearchHighlight();
    }
    setLocateButtonState(false);
    updateClearButtonVisibility();
    if (listbox.node()) {
      const htmlCollection = listbox.node().children;
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
    d3.select("#search-input-text").property("disabled", !menuEnabled);
    d3.select("#mobile-search-toggle-btn").property("disabled", !menuEnabled);
    d3.select("#search-clear-btn").property("disabled", !menuEnabled);
    setLocateButtonState(locateAvailable);
    if (!menuEnabled) {
      searchMenu.hideSearchEntries();
      collapseMobileSearch();
    }
  };

  return searchMenu;
};

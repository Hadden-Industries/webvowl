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

  let results = [];
  let resultID = [];
  const c_locate = d3.select("#locateSearchResult");
  const listbox = d3.select("#search-results-listbox");

  String.prototype.beginsWith = function (string) {
    return this.indexOf(string) === 0;
  };

  searchMenu.requestDictionaryUpdate = function () {
    dictionaryUpdateRequired = true;
    // clear possible pre searched entries
    const htmlCollection = m_search.node().children;
    const numEntries = htmlCollection.length;

    for (let i = 0; i < numEntries; i++) {
      htmlCollection[0].remove();
    }
    searchLineEdit.node().value = "";
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

  searchMenu.setup = function () {
  function setLocateButtonState( enabled ){
    if ( c_locate && c_locate.node() ) {
      c_locate.classed("highlighted", enabled);
      c_locate.property("disabled", !enabled);
      if ( typeof c_locate.node().disabled !== "undefined" ) {
        c_locate.node().disabled = !enabled;
      }
      const titleText = enabled ? "Locate search term" : "Nothing to locate";
      c_locate.node().title = titleText;
      c_locate.attr("aria-label", titleText);
    }
  }

  function expandMobileSearch(){
    d3.select("#c_search").classed("search-expanded", true);
    d3.select("#scrollLeftButton").classed("hidden-by-search", true);
    d3.select("#scrollRightButton").classed("hidden-by-search", true);
    updateClearButtonVisibility();
  }

  function collapseMobileSearch(){
    d3.select("#c_search").classed("search-expanded", false);
    d3.select("#scrollLeftButton").classed("hidden-by-search", false);
    d3.select("#scrollRightButton").classed("hidden-by-search", false);
  }

    // clear dictionary;
    dictionary = [];

    setLocateButtonState(false);

    searchLineEdit = d3.select("#search-input-text");

    searchLineEdit.on("input", userInput);
    searchLineEdit.on("keydown", userNavigation);
    searchLineEdit.on("keyup", function (){
      const isNav = d3.event.keyCode === 38 || d3.event.keyCode === 40 || d3.event.keyCode === 13 || d3.event.keyCode === 27;
      if ( !isNav ) {
        userInput();
      }
    });
    searchLineEdit.on("click", function (){
      updateSelectionStatusFlags();
      searchMenu.showSearchEntries();
    });
    searchLineEdit.on("focus", hoverSearchEntryView);

    c_locate.on("click", function () {
      graph.locateSearchResult();
    });

    c_locate.on("mouseover", function () {
      searchMenu.hideSearchEntries();
      const cLocateNode = d3.select("#c_locate").node();
        if ( cLocateNode && cLocateNode.contains(event.target) ) {
          return;
        }
      searchMenu.hideSearchEntries();
      collapseMobileSearch();
    };

    d3.select(document)
      .on("click.searchCombobox", dismissSearchOnOutsideTap)
      .on("pointerdown.searchCombobox", dismissSearchOnOutsideTap)
      .on("touchstart.searchCombobox", dismissSearchOnOutsideTap);

    listbox.on("click", function (event){
      let target = (event && event.target) ? event.target : (d3.event ? d3.event.target : null);
      while ( target && target !== this && target.tagName !== "LI" ) {
        target = target.parentElement;
      }
      if ( target && target.classList && target.classList.contains("search-option") && !target.classList.contains("search-entry-disabled") ) {
        const elementId = target.getAttribute("elementID");
        if ( elementId !== null && elementId !== undefined ) {
          const handler = handleClick(parseInt(elementId, 10));
          handler(event);
        }
      }
    });

    if ( window.visualViewport ) {
      window.visualViewport.addEventListener("resize", function (){
        if ( listbox.node() && !listbox.classed("hidden") ) {
          searchMenu.showSearchEntries();
        }
      });
      window.visualViewport.addEventListener("scroll", function (){
        if ( listbox.node() && !listbox.classed("hidden") ) {
          searchMenu.showSearchEntries();
        }
      });
    }
  };

  function hoverSearchEntryView() {
    updateSelectionStatusFlags();
    searchMenu.showSearchEntries();
  }

  function toggleSearchEntryView() {
    if (viewStatusOfSearchEntries) {
      searchMenu.hideSearchEntries();
    } else {
      searchMenu.showSearchEntries();
    }
  }

  searchMenu.hideSearchEntries = function () {
    m_search.classed("is-open", false).classed("hidden", true);
    viewStatusOfSearchEntries = false;
  };

  searchMenu.showSearchEntries = function () {
    if ( listbox.node() && listbox.node().children.length > 0 ) {
      listbox.classed("hidden", false);
      if ( searchLineEdit && searchLineEdit.node() ) {
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

  function userNavigation() {
    if (dictionaryUpdateRequired) {
      updateSearchDictionary();
    }

    if ( event.keyCode === 27 ) { // Escape key
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
      const atr = htmlCollection[i].getAttribute("class");
      if (atr === "dbEntrySelected") {
        selectedEntry = i;
      }
    }
    if (d3.event.keyCode === 13) {
      if (selectedEntry >= 0 && selectedEntry < numEntries) {
        // simulate onClick event
        htmlCollection[selectedEntry].onclick();
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
    if (d3.event.keyCode === 38) {
      move = -1;
      searchMenu.showSearchEntries();
    }
    if (d3.event.keyCode === 40) {
      move = +1;
      searchMenu.showSearchEntries();
    }

    const newSelection = selectedEntry + move;
    if (newSelection !== selectedEntry) {
      if (newSelection < 0 && selectedEntry <= 0) {
        htmlCollection[0].setAttribute("class", "dbEntrySelected");
      }

      if (newSelection >= numEntries) {
        htmlCollection[selectedEntry].setAttribute("class", "dbEntrySelected");
      }
      if (newSelection >= 0 && newSelection < numEntries) {
        htmlCollection[newSelection].setAttribute("class", "dbEntrySelected");
        if (selectedEntry >= 0) {
          htmlCollection[selectedEntry].setAttribute("class", "dbEntry");
        }
      }
    }
  }

  searchMenu.getSearchString = function () {
    return searchLineEdit.node().value;
  };

  function clearSearchEntries() {
    const htmlCollection = m_search.node().children;
    const numEntries = htmlCollection.length;
    for (let i = 0; i < numEntries; i++) {
      htmlCollection[0].remove();
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

  function measureTextWidth(text, textStyle) {
    // Set a default value
    if (!textStyle) {
      textStyle = "text";
    }
    const d = d3
        .select("body")
        .append("div")
        .attr("class", textStyle)
        .attr("id", "width-test") // tag this element to identify it
        .attr(
          "style",
          "position:absolute; float:left; white-space:nowrap; visibility:hidden;",
        )
        .text(text),
      w = document.getElementById("width-test").offsetWidth;
    d.remove();
    return w;
  }

  function cropText(input) {
    const maxWidth = 250;
    const textStyle = "dbEntry";
    let truncatedText = input;
    let textWidth;
    let ratio;
    let newTruncatedTextLength;
    while (true) {
      textWidth = measureTextWidth(truncatedText, textStyle);
      if (textWidth <= maxWidth) {
        break;
      }

      ratio = textWidth / maxWidth;
      newTruncatedTextLength = Math.floor(truncatedText.length / ratio);

      // detect if nothing changes
      if (truncatedText.length === newTruncatedTextLength) {
        break;
      }

      truncatedText = truncatedText.substring(0, newTruncatedTextLength);
    }

    if (input.length > truncatedText.length) {
      return input.substring(0, truncatedText.length - 6);
    }
    return input;
  }

  function createDropDownElements() {
    const copyRes = [];
    let i;
    for ( i = 0; i < results.length; i++ ) {
      copyRes.push(results[i]);
    }
    const newResults = [];
    const newResultsIds = [];

    const lc_text = searchLineEdit.node().value.toLowerCase();
    // set the number of shown results to be maxEntries or less;
    numEntries = results.length;
    if (numEntries > maxEntries) {
      numEntries = maxEntries;
    }

    for (i = 0; i < numEntries; i++) {
    let numEntries = newResults.length;
    if ( numEntries > maxEntries ) {
      numEntries = maxEntries;
    }
      // search for the best entry
      let indexElement = 1000000;
      let lengthElement = 1000000;
      let bestElement = -1;
      for (let j = 0; j < copyRes.length; j++) {
        token = copyRes[j].toLowerCase();
        const tIe = token.indexOf(lc_text);
        const tLe = token.length;
        if (tIe > -1 && tIe <= indexElement && tLe <= lengthElement) {
          bestElement = j;
          indexElement = tIe;
          lengthElement = tLe;
        }
      }
      newResults.push(copyRes[bestElement]);
      newResultsIds.push(resultID[bestElement]);
      copyRes[bestElement] = "";
    }

    // add the results to the entry menu
    //******************************************
    numEntries = results.length;
    if (numEntries > maxEntries) {
      numEntries = maxEntries;
    }

    for (i = 0; i < numEntries; i++) {
      //add results to the dropdown menu
      const testEntry = document.createElement("li");
      testEntry.setAttribute("elementID", newResultsIds[i]);
      testEntry.onclick = handleClick(newResultsIds[i]);
      testEntry.setAttribute("class", "dbEntry");

      const entries = mergedIdList[newResultsIds[i]];
      const eLen = entries.length;

      let croppedText = cropText(newResults[i]);

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
      if (croppedText !== newResults[i]) {
        // append ...(#numElements) if needed
        if (eLen > 1 && allSame === false) {
          if (eLen !== visible) {
            croppedText += "... (" + visible + "/" + eLen + ")";
          }
        } else {
          croppedText += "...";
        }
        testEntry.title = newResults[i];
      } else {
        if (eLen > 1 && allSame === false) {
          if (eLen !== visible) {
            croppedText += " (" + visible + "/" + eLen + ")";
          } else {
            croppedText += " (" + eLen + ")";
          }
        }
      }

      const searchEntryNode = d3.select(testEntry);
      if (eLen === 1 || allSame === true) {
        if (nodeMap[entries[0]] === undefined) {
          searchEntryNode.classed("search-entry-disabled", true);
          testEntry.title = newResults[i] + "\nElement is filtered out.";
          testEntry.onclick = function () {};
        }
      } else {
        if (visible < 1) {
          searchEntryNode.classed("search-entry-disabled", true);
          testEntry.onclick = function () {};
          testEntry.title = newResults[i] + "\nAll elements are filtered out.";
        } else {
          searchEntryNode.classed("search-entry-disabled", false);
        }
        if (visible < eLen && visible > 1) {
          testEntry.title =
            newResults[i] +
            "\n" +
            visible +
            "/" +
            eLen +
            " elements are visible.";
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

  function userInput() {
  function updateClearButtonVisibility(){
    const clearBtn = d3.select("#search-clear-btn");
    if ( clearBtn.node() ) {
      const hasValue = searchLineEdit && searchLineEdit.node() && searchLineEdit.node().value.length > 0;
      clearBtn.classed("hidden", !hasValue);
    }
  }

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
    return function () {
      const id = elementId;
      const correspondingIds = mergedIdList[id];

      const autoComStr = entryNames[id];
      if ( searchLineEdit && searchLineEdit.node() ) {
        searchLineEdit.node().value = autoComStr;
      }
      updateClearButtonVisibility();

      if ( correspondingIds && graph ) {
        graph.resetSearchHighlight();
        graph.highLightNodes(correspondingIds);
      }
      setLocateButtonState(true);
      if (autoComStr !== inputText) {
        handleAutoCompletion();
      }
      searchMenu.hideSearchEntries();
    };
  }

  searchMenu.clearText = function () {
    if ( searchLineEdit && searchLineEdit.node() ) {
      searchLineEdit.node().value = "";
    }
    if ( graph && graph.resetSearchHighlight ) {
      graph.resetSearchHighlight();
    }
    setLocateButtonState(false);
    updateClearButtonVisibility();
    const htmlCollection = m_search.node().children;
    const numEntries = htmlCollection.length;
    for (let i = 0; i < numEntries; i++) {
      htmlCollection[0].remove();
    }
  };

  return searchMenu;
};

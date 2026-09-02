export function createDebugMenu(
  graph,
  {
    documentObject = globalThis.document,
    windowObject = globalThis.window,
  } = {},
) {
  const debugMenu = {},
    checkboxes = [];

  debugMenu.setup = function () {
    addCheckBox(
      "useAccuracyHelper",
      "Use accuracy helper",
      "#useAccuracyHelper",
      graph.options().useAccuracyHelper,
      function (enabled, silent) {
        if (!enabled) {
          documentObject
            .querySelector("#showDraggerObject")
            .classList.add("disabled");
          documentObject.querySelector(
            "#showDraggerObjectConfigCheckbox",
          ).checked = false;
        } else {
          documentObject
            .querySelector("#showDraggerObject")
            .classList.remove("disabled");
        }

        if (silent === true) {
          return;
        }
        graph.lazyRefresh();
        graph.updateDraggerElements();
      },
    );
    addCheckBox(
      "showDraggerObject",
      "Show accuracy helper",
      "#showDraggerObject",
      graph.options().showDraggerObject,
      function (enabled, silent) {
        if (silent === true) {
          return;
        }
        graph.lazyRefresh();
        graph.updateDraggerElements();
      },
    );
    addCheckBox(
      "showFPS_Statistics",
      "Show rendering statistics",
      "#showFPS_Statistics",
      graph.options().showRenderingStatistic,
      function (enabled, silent) {
        if (graph.ontologyEditingState().getHideDebugFeatures() === false) {
          documentObject
            .querySelector("#FPS_Statistics")
            .classList.toggle("hidden", !enabled);
        } else {
          documentObject
            .querySelector("#FPS_Statistics")
            .classList.add("hidden");
        }
      },
    );
    addCheckBox(
      "showModeOfOperation",
      "Show input modality",
      "#showModeOfOperation",
      graph.options().showInputModality,
      function (enabled) {
        if (graph.ontologyEditingState().getHideDebugFeatures() === false) {
          documentObject
            .querySelector("#modeOfOperationString")
            .classList.toggle("hidden", !enabled);
        } else {
          documentObject
            .querySelector("#modeOfOperationString")
            .classList.add("hidden");
        }
      },
    );
  };

  function addCheckBox(
    identifier,
    modeName,
    selector,
    onChangeFunc,
    _callbackFunction,
  ) {
    const configOptionContainer = documentObject.querySelector(selector);
    const configCheckbox = configOptionContainer.querySelector(
      "#" + identifier + "ConfigCheckbox",
    );
    configCheckbox.checked = onChangeFunc();

    const clickHandler = function (arg1, arg2) {
      const isEnabled = configCheckbox.checked;
      onChangeFunc(isEnabled);
      const silent =
        typeof arg1 === "boolean"
          ? arg1
          : typeof arg2 === "boolean"
            ? arg2
            : false;
      _callbackFunction(isEnabled, silent);
    };

    configCheckbox.addEventListener("click", clickHandler);
    checkboxes.push({
      id: configCheckbox.id,
      element: configCheckbox,
      update: clickHandler,
    });

    return configCheckbox;
  }

  debugMenu.setCheckBoxValue = function (identifier, value) {
    for (let i = 0; i < checkboxes.length; i++) {
      const item = checkboxes[i];
      if (item.id === identifier) {
        item.element.checked = value;
        break;
      }
    }
  };

  debugMenu.getCheckBoxValue = function (id) {
    for (let i = 0; i < checkboxes.length; i++) {
      const item = checkboxes[i];
      if (item.id === id) {
        return item.element.checked;
      }
    }
  };

  debugMenu.updateSettings = function () {
    const debugOptions = documentObject.querySelectorAll(".debugOption");
    const hideDebug = graph.ontologyEditingState().getHideDebugFeatures();
    debugOptions.forEach(function (option) {
      option.classList.toggle("hidden", hideDebug);
    });

    const silent = true;
    checkboxes.forEach(function (item) {
      item.update(silent);
    });
    if (graph.editorMode() === false) {
      documentObject
        .querySelector("#useAccuracyHelper")
        .classList.add("disabled");
      documentObject
        .querySelector("#showDraggerObject")
        .classList.add("disabled");
    } else {
      documentObject
        .querySelector("#useAccuracyHelper")
        .classList.remove("disabled");
    }
  };

  return debugMenu;
}

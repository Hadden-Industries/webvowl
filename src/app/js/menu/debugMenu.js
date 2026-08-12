module.exports = function (graph) {
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
          document
            .querySelector("#showDraggerObject")
            .classList.add("disabled");
          document.querySelector("#showDraggerObjectConfigCheckbox").checked =
            false;
        } else {
          document
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
        if (graph.options().getHideDebugFeatures() === false) {
          document
            .querySelector("#FPS_Statistics")
            .classList.toggle("hidden", !enabled);
        } else {
          document.querySelector("#FPS_Statistics").classList.add("hidden");
        }
      },
    );
    addCheckBox(
      "showModeOfOperation",
      "Show input modality",
      "#showModeOfOperation",
      graph.options().showInputModality,
      function (enabled) {
        if (graph.options().getHideDebugFeatures() === false) {
          document
            .querySelector("#modeOfOperationString")
            .classList.toggle("hidden", !enabled);
        } else {
          document
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
    const configOptionContainer = document.querySelector(selector);
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
    configCheckbox.__clickHandler = clickHandler;
    checkboxes.push(configCheckbox);

    return configCheckbox;
  }

  debugMenu.setCheckBoxValue = function (identifier, value) {
    for (let i = 0; i < checkboxes.length; i++) {
      const cbdId = checkboxes[i].id;
      if (cbdId === identifier) {
        checkboxes[i].checked = value;
        break;
      }
    }
  };

  debugMenu.getCheckBoxValue = function (id) {
    for (let i = 0; i < checkboxes.length; i++) {
      const cbdId = checkboxes[i].id;
      if (cbdId === id) {
        return checkboxes[i].checked;
      }
    }
  };

  debugMenu.updateSettings = function () {
    const debugOptions = document.querySelectorAll(".debugOption");
    const hideDebug = graph.options().getHideDebugFeatures();
    debugOptions.forEach(function (option) {
      option.classList.toggle("hidden", hideDebug);
    });

    const silent = true;
    checkboxes.forEach(function (checkbox) {
      if (checkbox.__clickHandler) {
        checkbox.__clickHandler(silent);
      }
    });
    if (graph.editorMode() === false) {
      document.querySelector("#useAccuracyHelper").classList.add("disabled");
      document.querySelector("#showDraggerObject").classList.add("disabled");
    } else {
      document.querySelector("#useAccuracyHelper").classList.remove("disabled");
    }
  };

  return debugMenu;
};

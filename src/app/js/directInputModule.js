const owl2vowlModule = require("../../owl2vowl/js/index.js");
const owl2vowl = owl2vowlModule.default || owl2vowlModule;
if (!owl2vowl.loadWithImports && owl2vowlModule.loadWithImports) {
  owl2vowl.loadWithImports = owl2vowlModule.loadWithImports;
}

module.exports = function (graph) {
  /** variable defs **/
  const directInputModule = {};
  const inputContainer = document.querySelector("#DirectInputContent");
  const textArea = document.querySelector("#directInputTextArea");
  let visibleContainer = false;

  // connect upload and close button;
  directInputModule.handleDirectUpload = function () {
    const text = textArea.value;
    const loadingModule = graph.options().loadingModule();
    loadingModule.initializeLoader();
    let jsonOBJ;
    try {
      jsonOBJ = JSON.parse(text);
      loadingModule.directInput(text);
      // close if successful
      if (Array.isArray(jsonOBJ.class) && jsonOBJ.class.length > 0) {
        directInputModule.setDirectInputMode(false);
      }
    } catch (_e) {
      try {
        owl2vowl
          .loadWithImports(text)
          .then(function (vowlJson) {
            loadingModule.directInput(JSON.stringify(vowlJson));
            directInputModule.setDirectInputMode(false);
          })
          .catch(function (error2) {
            console.warn("Error " + error2);
            document.querySelector("#Error_onLoad").classList.remove("hidden");
            document.querySelector("#Error_onLoad").innerHTML =
              "Failed to convert the input! " + error2.message;
            graph.handleOnLoadingError();
          });
      } catch (error2) {
        console.warn("Error " + error2);
        document.querySelector("#Error_onLoad").classList.remove("hidden");
        document.querySelector("#Error_onLoad").innerHTML =
          "Failed to convert the input! " + error2.message;
        graph.handleOnLoadingError();
      }
    }
  };

  directInputModule.handleCloseButton = function () {
    directInputModule.setDirectInputMode(false);
  };

  directInputModule.updateLayout = function () {};

  directInputModule.setDirectInputMode = function (val) {
    if (!val) {
      visibleContainer = !visibleContainer;
    } else {
      visibleContainer = val;
    }
    // update visibility;
    directInputModule.updateLayout();
    document.querySelector("#Error_onLoad").classList.add("hidden");
    inputContainer.classList.toggle("hidden", !visibleContainer);
  };

  document
    .querySelector("#directUploadBtn")
    .addEventListener("click", directInputModule.handleDirectUpload);
  document
    .querySelector("#close_directUploadBtn")
    .addEventListener("click", directInputModule.handleCloseButton);

  return directInputModule;
};

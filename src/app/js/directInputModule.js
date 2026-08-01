const owl2vowlModule = require("../../owl2vowl/js/index.js");
const owl2vowl = owl2vowlModule.default || owl2vowlModule;
if (!owl2vowl.loadWithImports && owl2vowlModule.loadWithImports) {
  owl2vowl.loadWithImports = owl2vowlModule.loadWithImports;
}

module.exports = function ( graph ){
  /** variable defs **/
  const directInputModule = {};
  const inputContainer = d3.select("#DirectInputContent");
  const textArea = d3.select("#directInputTextArea");
  let visibleContainer = false;
  
  // connect upload and close button;
  directInputModule.handleDirectUpload = function (){
    
    const text = textArea.node().value;
    const loadingModule = graph.options().loadingModule();
    loadingModule.initializeLoader();
    let jsonOBJ;
    try {
      jsonOBJ = JSON.parse(text);
      loadingModule.directInput(text);
      // close if successful
      if ( Array.isArray(jsonOBJ.class) && jsonOBJ.class.length > 0 ) {
        directInputModule.setDirectInputMode(false);
      }
    }
    catch ( _e ) {
      try {
        owl2vowl.loadWithImports(text)
          .then(function (vowlJson) {
            loadingModule.directInput(JSON.stringify(vowlJson));
            directInputModule.setDirectInputMode(false);
          })
          .catch(function (error2) {
            console.warn("Error " + error2);
            d3.select("#Error_onLoad").classed("hidden", false);
            d3.select("#Error_onLoad").node().innerHTML = "Failed to convert the input! " + error2.message;
            graph.handleOnLoadingError();
          });
      } catch ( error2 ) {
        console.warn("Error " + error2);
        d3.select("#Error_onLoad").classed("hidden", false);
        d3.select("#Error_onLoad").node().innerHTML = "Failed to convert the input! " + error2.message;
        graph.handleOnLoadingError();
      }
    }
  };
  
  directInputModule.handleCloseButton = function (){
    directInputModule.setDirectInputMode(false);
  };
  
  directInputModule.updateLayout = function (){
  };
  
  directInputModule.setDirectInputMode = function ( val ){
    if ( !val ) {
      visibleContainer = !visibleContainer;
    }
    else {
      visibleContainer = val;
    }
    // update visibility;
    directInputModule.updateLayout();
    d3.select("#Error_onLoad").classed("hidden", true);
    inputContainer.classed("hidden", !visibleContainer);
  };
  
  
  d3.select("#directUploadBtn").on("click", directInputModule.handleDirectUpload);
  d3.select("#close_directUploadBtn").on("click", directInputModule.handleCloseButton);
  
  return directInputModule;
};

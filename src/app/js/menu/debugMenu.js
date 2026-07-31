module.exports = function ( graph ){
  const debugMenu = {},
    checkboxes = [];
  
  
  debugMenu.setup = function (){
    addCheckBox("useAccuracyHelper", "Use accuracy helper", "#useAccuracyHelper", graph.options().useAccuracyHelper,
      function ( enabled, silent ){
        if ( !enabled ) {
          d3.select("#showDraggerObject").classed("disabled", true);
          d3.select("#showDraggerObjectConfigCheckbox").node().checked = false;
        } else {
          d3.select("#showDraggerObject").classed("disabled", false);
        }
        
        if ( silent === true ) {return;}
        graph.lazyRefresh();
        graph.updateDraggerElements();
      }
    );
    addCheckBox("showDraggerObject", "Show accuracy helper", "#showDraggerObject", graph.options().showDraggerObject,
      function ( enabled, silent ){
        if ( silent === true ) {return;}
        graph.lazyRefresh();
        graph.updateDraggerElements();
      });
    addCheckBox("showFPS_Statistics", "Show rendering statistics", "#showFPS_Statistics", graph.options().showRenderingStatistic,
      function ( enabled, silent ){
        
        if ( graph.options().getHideDebugFeatures() === false ) {
          d3.select("#FPS_Statistics").classed("hidden", !enabled);
        } else {
          d3.select("#FPS_Statistics").classed("hidden", true);
        }
        
        
      });
    addCheckBox("showModeOfOperation", "Show input modality", "#showModeOfOperation", graph.options().showInputModality,
      function ( enabled ){
        if ( graph.options().getHideDebugFeatures() === false ) {
          d3.select("#modeOfOperationString").classed("hidden", !enabled);
        } else {
          d3.select("#modeOfOperationString").classed("hidden", true);
        }
      });
    
    
  };
  
  
  function addCheckBox( identifier, modeName, selector, onChangeFunc, _callbackFunction ){
    const configOptionContainer = d3.select(selector)
      .append("div")
      .classed("checkboxContainer", true);
    const configCheckbox = configOptionContainer.append("input")
      .classed("moduleCheckbox", true)
      .attr("id", identifier + "ConfigCheckbox")
      .attr("type", "checkbox")
      .property("checked", onChangeFunc());
    
    
    configCheckbox.on("click", function ( arg1, arg2 ){
      const isEnabled = configCheckbox.property("checked");
      onChangeFunc(isEnabled);
      const silent = (typeof arg1 === "boolean") ? arg1 : (typeof arg2 === "boolean" ? arg2 : false);
      _callbackFunction(isEnabled, silent);
      
    });
    checkboxes.push(configCheckbox);
    configOptionContainer.append("label")
      .attr("for", identifier + "ConfigCheckbox")
      .text(modeName);
    
    return configCheckbox;
  }
  
  debugMenu.setCheckBoxValue = function ( identifier, value ){
    for ( let i = 0; i < checkboxes.length; i++ ) {
      const cbdId = checkboxes[i].attr("id");
      if ( cbdId === identifier ) {
        checkboxes[i].property("checked", value);
        break;
      }
    }
  };
  
  debugMenu.getCheckBoxValue = function ( id ){
    for ( let i = 0; i < checkboxes.length; i++ ) {
      const cbdId = checkboxes[i].attr("id");
      if ( cbdId === id ) {
        return checkboxes[i].property("checked");
      }
    }
  };
  
  debugMenu.updateSettings = function (){
    d3.selectAll(".debugOption").classed("hidden", graph.options().getHideDebugFeatures());
    
    const silent = true;
    checkboxes.forEach(function ( checkbox ){
      checkbox.on("click")(silent);
    });
    if ( graph.editorMode() === false ) {
      d3.select("#useAccuracyHelper").classed("disabled", true);
      d3.select("#showDraggerObject").classed("disabled", true);
    } else {
      d3.select("#useAccuracyHelper").classed("disabled", false);
    }
    
  };
  
  return debugMenu;
};

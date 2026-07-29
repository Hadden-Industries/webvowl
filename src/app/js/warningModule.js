module.exports = function ( graph ){
  /** variable defs **/
  const warningModule = {};
  const _messageContainers = [];
  const _messageContext = [];
  const _visibleStatus = [];
  const superContainer = d3.select("#WarningErrorMessages");
  
  let _filterHintId;
  let _messageId = -1;
  superContainer.style("display", "inline-block");
  const cssStyleIndex = 0;
  const styleSelectorIndex = 2;
  

  // helper for standalone webvowl in chrome
  function createCSSSelector( name, rules ){
    const style = document.createElement('style');
    style.type = 'text/css';
    document.getElementsByTagName('head')[0].appendChild(style);
    if ( !(style.sheet || {}).insertRule )
      {(style.styleSheet || style.sheet).addRule(name, rules);}
    else
      {style.sheet.insertRule(name + "{" + rules + "}", 0);}
  }
  
  
  function findCSS_Index(){
    createCSSSelector("@keyframes msg_CollapseAnimation", " 0% { top: 0; } 100% { top: -400px;}");
    console.warn(document.styleSheets );
  }
  
  findCSS_Index();
  
  warningModule.addMessageBox = function (){
    
    // add a container;
    _messageId++;
    const messageContainer = d3.select("#WarningErrorMessages").append("div");
    messageContainer.node().id = "messageContainerId_" + _messageId;
    
    const messageContext = messageContainer.append("div");
    messageContext.node().id = "messageContextId_" + _messageId;
    messageContext.style("top", "0");
    messageContainer.style("position", "relative");
    messageContainer.style("width", "100%");
    //save in array
    _messageContainers.push(messageContainer);
    _messageContext.push(messageContext);
    
    // add animation to the container
    messageContainer.node().addEventListener("animationend", _msgContainer_animationEnd);
    
    // set visible flag that is used in end of animation
    _visibleStatus[_messageId] = true;
    return _messageId;
  };
  
  function _msgContainer_animationEnd(){
    const containerId = this.id;
    const tokens = containerId.split("_")[1];
    const mContainer = d3.select("#" + containerId);
    // get number of children
    mContainer.classed("hidden", !_visibleStatus[tokens]);
    // clean up DOM
    if ( !_visibleStatus[tokens] ) {
      mContainer.remove();
      _messageContext[tokens] = null;
      _messageContainers[tokens] = null;
    }
    // remove event listener
    // c.node().removeEventListener("animationend",_msgContainer_animationEnd);
  }
  
  warningModule.createMessageContext = function ( id ){
    const warningContainer = _messageContext[id];
    const moduleContainer = _messageContainers[id];
    const generalHint = warningContainer.append('div');
    generalHint.node().innerHTML = "";
    /** Editing mode activated. You can now modify an existing ontology or create a new one via the <em>ontology</em> menu. You can save any ontology using the <em>export</em> menu (and exporting it as TTL file).**/
    generalHint.node().innerHTML += "Editing mode activated.<br>" +
      "You can now modify an existing ontology or create a new one via the <em>ontology</em> menu.<br>" +
      "You can save any ontology using the <em>export</em> menu (and exporting it as TTL file).";
    
    generalHint.style("padding", "5px");
    generalHint.style("line-height", "1.2em");
    generalHint.style("font-size", "1.2em");
    
    
    const ul = warningContainer.append('ul');
    ul.append('li').node().innerHTML = "Create a class with <b>double click / tap</b> on empty canvas area.";
    ul.append('li').node().innerHTML = "Edit names with <b>double click / tap</b> on element.</li>";
    ul.append('li').node().innerHTML = "Selection of default constructors is provided in the left sidebar.";
    ul.append('li').node().innerHTML = "Additional editing functionality is provided in the right sidebar.";
    
    
    const gotItButton = warningContainer.append("label");
    gotItButton.node().id = "killWarningErrorMessages_" + id;
    gotItButton.node().innerHTML = "Got It";
    gotItButton.on("click", warningModule.closeMessage);
    
    moduleContainer.classed("hidden", false);
    moduleContainer.style("-webkit-animation-name", "warn_ExpandAnimation");
    moduleContainer.style("-webkit-animation-duration", "0.5s");
  };
  
  warningModule.showMessage = function ( id ){
    const moduleContainer = _messageContainers[id];
    moduleContainer.classed("hidden", false);
    moduleContainer.style("-webkit-animation-name", "warn_ExpandAnimation");
    moduleContainer.style("-webkit-animation-duration", "0.5s");
  };
  
  warningModule.closeMessage = function ( id ){
    let nId;
    if ( id === undefined ) {
      const givenId = this.id;
      nId = givenId.split("_")[1];
    } else {
      nId = id;
    }
    if ( id && id.indexOf("_") !== -1 ) {
      nId = id.split("_")[1];
    }
    _visibleStatus[nId] = false;
    // get module;
    const moduleContainer = _messageContainers[nId];
    const m_height = moduleContainer.node().getBoundingClientRect().height;
    moduleContainer.style("-webkit-animation-name", "warn_CollapseAnimation");
    moduleContainer.style("-webkit-animation-duration", "0.5s");
    
    // find my id in the children
    const pNode = moduleContainer.node().parentNode;
    
    const followingChildren = [];
    const pChild = pNode.children;
    const pChild_len = pChild.length;
    const containerId = moduleContainer.node().id;
    let found_me = false;
    for ( let i = 0; i < pChild_len; i++ ) {
      if ( found_me === true ) {
        followingChildren.push(pChild[i].id);
      }
      
      if ( containerId === pChild[i].id ) {
        found_me = true;
      }
    }
    
    for ( let fc = 0; fc < followingChildren.length; fc++ ) {
      const child = d3.select("#" + followingChildren[fc]);
      // get the document style and overwrite it;
      const superCss = document.styleSheets[styleSelectorIndex].cssRules[cssStyleIndex];
      // remove the existing 0% and 100% rules
      superCss.deleteRule("0%");
      superCss.deleteRule("100%");
      
      superCss.appendRule("0%   {top: 0;}");
      superCss.appendRule("100% {top: -" + m_height + "px;");
      
      child.style("-webkit-animation-name", "msg_CollapseAnimation");
      child.style("-webkit-animation-duration", "0.5s");
      child.node().addEventListener("animationend", _child_animationEnd);
    }
  };
  
  function _child_animationEnd(){
    const c = d3.select(this);
    c.style("-webkit-animation-name", "");
    c.style("-webkit-animation-duration", "");
    c.node().removeEventListener("animationend", _child_animationEnd);
  }
  
  warningModule.closeFilterHint = function (){
    if ( _messageContainers[_filterHintId] ) {
      _messageContainers[_filterHintId].classed("hidden", true);
      _messageContainers[_filterHintId].remove();
      _messageContainers[_filterHintId] = null;
      _messageContext[_filterHintId] = null;
      _visibleStatus[_filterHintId] = false;
    }
  };
  
  warningModule.showEditorHint = function (){
    const id = warningModule.addMessageBox();
    warningModule.createMessageContext(id);
  };

  warningModule.showExporterWarning=function (){
    warningModule.showWarning("Can not export ontology", "Detected unsupported ontology axioms, (e.g. owl:Union)", "Ontology is not exported", 1, false);
  };

  
  
  warningModule.responseWarning = function ( header, reason, action, callback, parameterArray, forcedWarning ){
    const id = warningModule.addMessageBox();
    const warningContainer = _messageContext[id];
    const moduleContainer = _messageContainers[id];
    _visibleStatus[id] = true;
    const graphWidth = 0.5 * graph.options().width();
    d3.select("#blockGraphInteractions").classed("hidden", false);
    
    if ( header.length > 0 ) {
      const head = warningContainer.append("div");
      head.style("padding", "5px");
      const titleHeader = head.append("div");
      // some classes
      titleHeader.style("display", "inline-flex");
      titleHeader.node().innerHTML = "<b>Warning:</b>";
      titleHeader.style("padding-right", "3px");
      const msgHeader = head.append("div");
      // some classes
      msgHeader.style("display", "inline-flex");
      msgHeader.style("max-width", graphWidth + "px");
      
      msgHeader.node().innerHTML = header;
    }
    if ( reason.length > 0 ) {
      const reasonContainer = warningContainer.append("div");
      reasonContainer.style("padding", "5px");
      const reasonHeader = reasonContainer.append("div");
      // some classes
      reasonHeader.style("display", "inline-flex");
      reasonHeader.style("padding-right", "3px");
      
      reasonHeader.node().innerHTML = "<b>Reason:</b>";
      const msgReason = reasonContainer.append("div");
      // some classes
      msgReason.style("display", "inline-flex");
      msgReason.style("max-width", graphWidth + "px");
      msgReason.node().innerHTML = reason;
    }
    if ( action.length > 0 ) {
      const actionContainer = warningContainer.append("div");
      actionContainer.style("padding", "5px");
      const actionHeader = actionContainer.append("div");
      // some classes
      actionHeader.style("display", "inline-flex");
      actionHeader.style("padding-right", "8px");
      actionHeader.node().innerHTML = "<b>Action:</b>";
      const msgAction = actionContainer.append("div");
      // some classes
      msgAction.style("display", "inline-flex");
      msgAction.style("max-width", graphWidth + "px");
      msgAction.node().innerHTML = action;
    }
    
    const gotItButton = warningContainer.append("label");
    gotItButton.node().id = "killWarningErrorMessages_" + id;
    gotItButton.node().innerHTML = "Continue";
    gotItButton.on("click", function (){
      warningModule.closeMessage(this.id);
      d3.select("#blockGraphInteractions").classed("hidden", true);
      callback(parameterArray[0], parameterArray[1], parameterArray[2], parameterArray[3]);
    });
    warningContainer.append("span").node().innerHTML = "|";
    const cancelButton = warningContainer.append("label");
    cancelButton.node().id = "cancelButton_" + id;
    cancelButton.node().innerHTML = "Cancel";
    cancelButton.on("click", function (){
      warningModule.closeMessage(this.id);
      d3.select("#blockGraphInteractions").classed("hidden", true);
    });
    moduleContainer.classed("hidden", false);
    moduleContainer.style("-webkit-animation-name", "warn_ExpandAnimation");
    moduleContainer.style("-webkit-animation-duration", "0.5s");
  };
  
  warningModule.showFilterHint = function (){
    const id = warningModule.addMessageBox();
    const warningContainer = _messageContext[id];
    const moduleContainer = _messageContainers[id];
    _visibleStatus[id] = true;
    
    _filterHintId = id;
    const generalHint = warningContainer.append('div');
    /** Editing mode activated. You can now modify an existing ontology or create a new one via the <em>ontology</em> menu. You can save any ontology using the <em>export</em> menu (and exporting it as TTL file).**/
    generalHint.node().innerHTML = "Collapsing filter activated.<br>" +
      "The number of visualized elements has been automatically reduced.<br>" +
      "Use the degree of collapsing slider in the <em>filter</em> menu to adjust the visualization.<br><br>" +
      "<em>Note:</em> A performance decrease could be experienced with a growing amount of visual elements in the graph.";
    
    
    generalHint.style("padding", "5px");
    generalHint.style("line-height", "1.2em");
    generalHint.style("font-size", "1.2em");
    
    const gotItButton = warningContainer.append("label");
    gotItButton.node().id = "killFilterMessages_" + id;
    gotItButton.node().innerHTML = "Got It";
    gotItButton.on("click", warningModule.closeMessage);
    
    moduleContainer.classed("hidden", false);
    moduleContainer.style("-webkit-animation-name", "warn_ExpandAnimation");
    moduleContainer.style("-webkit-animation-duration", "0.5s");
  };
  
  warningModule.showMultiFileUploadWarning = function (){
    const id = warningModule.addMessageBox();
    const warningContainer = _messageContext[id];
    const moduleContainer = _messageContainers[id];
    _visibleStatus[id] = true;
    
    _filterHintId = id;
    const generalHint = warningContainer.append('div');
    
    generalHint.node().innerHTML = "Uploading multiple files is not supported.<br>";
    
    generalHint.style("padding", "5px");
    generalHint.style("line-height", "1.2em");
    generalHint.style("font-size", "1.2em");
    
    const gotItButton = warningContainer.append("label");
    gotItButton.node().id = "killFilterMessages_" + id;
    gotItButton.node().innerHTML = "Got It";
    gotItButton.on("click", warningModule.closeMessage);
    
    moduleContainer.classed("hidden", false);
    moduleContainer.style("-webkit-animation-name", "warn_ExpandAnimation");
    moduleContainer.style("-webkit-animation-duration", "0.5s");
  };
  
  warningModule.showWarning = function ( header, reason, action, type, forcedWarning, additionalOpts ){
    const id = warningModule.addMessageBox();
    const warningContainer = _messageContext[id];
    const moduleContainer = _messageContainers[id];
    _visibleStatus[id] = true;
    const graphWidth = 0.5 * graph.options().width();
    
    if ( header.length > 0 ) {
      const head = warningContainer.append("div");
      head.style("padding", "5px");
      const titleHeader = head.append("div");
      // some classes
      titleHeader.style("display", "inline-flex");
      titleHeader.node().innerHTML = "<b>Warning:</b>";
      titleHeader.style("padding-right", "3px");
      const msgHeader = head.append("div");
      // some classes
      msgHeader.style("display", "inline-flex");
      msgHeader.style("max-width", graphWidth + "px");
      
      msgHeader.node().innerHTML = header;
    }
    if ( reason.length > 0 ) {
      const reasonContainer = warningContainer.append("div");
      reasonContainer.style("padding", "5px");
      const reasonHeader = reasonContainer.append("div");
      // some classes
      reasonHeader.style("display", "inline-flex");
      reasonHeader.style("padding-right", "3px");
      
      reasonHeader.node().innerHTML = "<b>Reason:</b>";
      const msgReason = reasonContainer.append("div");
      // some classes
      msgReason.style("display", "inline-flex");
      msgReason.style("max-width", graphWidth + "px");
      msgReason.node().innerHTML = reason;
    }
    if ( action.length > 0 ) {
      const actionContainer = warningContainer.append("div");
      actionContainer.style("padding", "5px");
      const actionHeader = actionContainer.append("div");
      // some classes
      actionHeader.style("display", "inline-flex");
      actionHeader.style("padding-right", "8px");
      actionHeader.node().innerHTML = "<b>Action:</b>";
      const msgAction = actionContainer.append("div");
      // some classes
      msgAction.style("display", "inline-flex");
      msgAction.style("max-width", graphWidth + "px");
      msgAction.node().innerHTML = action;
    }
    
    let gotItButton;
    if ( type === 1 ) {
      gotItButton = warningContainer.append("label");
      gotItButton.node().id = "killWarningErrorMessages_" + id;
      gotItButton.node().innerHTML = "Got It";
      gotItButton.on("click", warningModule.closeMessage);
    }
    
    if ( type === 2 ) {
      gotItButton = warningContainer.append("label");
      gotItButton.node().id = "killWarningErrorMessages_" + id;
      gotItButton.node().innerHTML = "Got It";
      gotItButton.on("click", warningModule.closeMessage);
      warningContainer.append("span").node().innerHTML = "|";
      const zoomToElementButton = warningContainer.append("label");
      zoomToElementButton.node().id = "zoomElementThing_" + id;
      zoomToElementButton.node().innerHTML = "Zoom to element ";
      zoomToElementButton.on("click", function (){
        // assume the additional Element is for halo;
        graph.zoomToElementInGraph(additionalOpts);
      });
      warningContainer.append("span").node().innerHTML = "|";
      const ShowElementButton = warningContainer.append("label");
      ShowElementButton.node().id = "showElementThing_" + id;
      ShowElementButton.node().innerHTML = "Indicate element";
      ShowElementButton.on("click", function (){
        // assume the additional Element is for halo;
        if ( additionalOpts.halo() === false ) {
          additionalOpts.drawHalo();
          graph.updatePulseIds([additionalOpts.id()]);
        } else {
          additionalOpts.removeHalo();
          additionalOpts.drawHalo();
          graph.updatePulseIds([additionalOpts.id()]);
        }
      });
    }
    moduleContainer.classed("hidden", false);
    moduleContainer.style("-webkit-animation-name", "warn_ExpandAnimation");
    moduleContainer.style("-webkit-animation-duration", "0.5s");
    moduleContainer.classed("hidden", false);
  };
  
  return warningModule;
};

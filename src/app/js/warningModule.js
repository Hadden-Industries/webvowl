module.exports = function ( graph ){
  /** variable defs **/
  const warningModule = {};
  const _messageContainers = [];
  const _messageContext = [];
  const _visibleStatus = [];
  
  let _filterHintId;
  let _messageId = -1;

  
  warningModule.addMessageBox = function (){
    
    // add a container;
    _messageId++;
    const messageContainer = d3.select("#WarningErrorMessages").append("div");
    messageContainer.node().id = "messageContainerId_" + _messageId;
    
    const messageContext = messageContainer.append("div");
    messageContext.node().id = "messageContextId_" + _messageId;
    messageContext.classed("warning-msg-context", true);
    messageContainer.classed("warning-msg-container", true);
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
    
    generalHint.classed("warning-hint", true);
    
    const ul = warningContainer.append('ul');
    ul.append('li').node().innerHTML = "Create a class with <b>double click / tap</b> on empty canvas area.";
    ul.append('li').node().innerHTML = "Edit names with <b>double click / tap</b> on element.</li>";
    ul.append('li').node().innerHTML = "Selection of default constructors is provided in the left sidebar.";
    ul.append('li').node().innerHTML = "Additional editing functionality is provided in the right sidebar.";
    
    const gotItButton = warningContainer.append("button").attr("type", "button");
    gotItButton.node().id = "killWarningErrorMessages_" + id;
    gotItButton.node().innerHTML = "Got It";
    gotItButton.on("click", warningModule.closeMessage);
    
    moduleContainer.classed("hidden", false);
    moduleContainer.classed("warn-expanded", true);
  };
  
  warningModule.showMessage = function ( id ){
    const moduleContainer = _messageContainers[id];
    moduleContainer.classed("hidden", false);
    moduleContainer.classed("warn-expanded", true);
  };
  
  warningModule.closeMessage = function ( id ){
    let nId;
    let targetId = (typeof id === "string") ? id : (this && this.id ? this.id : "");
    if ( typeof id === "number" ) {
      targetId = String(id);
    }
    if ( targetId && targetId.indexOf("_") !== -1 ) {
      nId = targetId.split("_")[1];
    } else {
      nId = targetId;
    }
    if ( !nId || !_messageContainers[nId] ) {
      return;
    }
    _visibleStatus[nId] = false;
    // get module;
    const moduleContainer = _messageContainers[nId];
    moduleContainer.classed("warn-collapsed", true);
    
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
      child.classed("msg-collapsed", true);
      child.node().addEventListener("animationend", _child_animationEnd);
    }
  };
  
  function _child_animationEnd(){
    const c = d3.select(this);
    c.classed("msg-collapsed", false);
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
    d3.select("#blockGraphInteractions").classed("hidden", false);
    
    if ( header.length > 0 ) {
      const head = warningContainer.append("div");
      head.classed("warning-row", true);
      const titleHeader = head.append("div");
      titleHeader.classed("warning-inline-flex warning-pr-3", true);
      titleHeader.node().innerHTML = "<b>Warning:</b>";
      const msgHeader = head.append("div");
      msgHeader.classed("warning-msg-content", true);
      msgHeader.node().innerHTML = header;
    }
    if ( reason.length > 0 ) {
      const reasonContainer = warningContainer.append("div");
      reasonContainer.classed("warning-row", true);
      const reasonHeader = reasonContainer.append("div");
      reasonHeader.classed("warning-inline-flex warning-pr-3", true);
      reasonHeader.node().innerHTML = "<b>Reason:</b>";
      const msgReason = reasonContainer.append("div");
      msgReason.classed("warning-msg-content", true);
      msgReason.node().innerHTML = reason;
    }
    if ( action.length > 0 ) {
      const actionContainer = warningContainer.append("div");
      actionContainer.classed("warning-row", true);
      const actionHeader = actionContainer.append("div");
      actionHeader.classed("warning-inline-flex warning-pr-8", true);
      actionHeader.node().innerHTML = "<b>Action:</b>";
      const msgAction = actionContainer.append("div");
      msgAction.classed("warning-msg-content", true);
      msgAction.node().innerHTML = action;
    }
    
    const gotItButton = warningContainer.append("button").attr("type", "button");
    gotItButton.node().id = "killWarningErrorMessages_" + id;
    gotItButton.node().innerHTML = "Continue";
    gotItButton.on("click", function (){
      warningModule.closeMessage(this.id);
      d3.select("#blockGraphInteractions").classed("hidden", true);
      callback(parameterArray[0], parameterArray[1], parameterArray[2], parameterArray[3]);
    });
    warningContainer.append("span").node().innerHTML = "|";
    const cancelButton = warningContainer.append("button").attr("type", "button");
    cancelButton.node().id = "cancelButton_" + id;
    cancelButton.node().innerHTML = "Cancel";
    cancelButton.on("click", function (){
      warningModule.closeMessage(this.id);
      d3.select("#blockGraphInteractions").classed("hidden", true);
    });
    moduleContainer.classed("hidden", false);
    moduleContainer.classed("warn-expanded", true);
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
    
    
    generalHint.classed("warning-hint", true);
    
    const gotItButton = warningContainer.append("button").attr("type", "button");
    gotItButton.node().id = "killFilterMessages_" + id;
    gotItButton.node().innerHTML = "Got It";
    gotItButton.on("click", warningModule.closeMessage);
    
    moduleContainer.classed("hidden", false);
    moduleContainer.classed("warn-expanded", true);
  };
  
  warningModule.showMultiFileUploadWarning = function (){
    const id = warningModule.addMessageBox();
    const warningContainer = _messageContext[id];
    const moduleContainer = _messageContainers[id];
    _visibleStatus[id] = true;
    
    const generalHint = warningContainer.append('div');
    
    generalHint.node().innerHTML = "Uploading multiple files is not supported.<br>";
    
    generalHint.classed("warning-hint", true);
    
    const gotItButton = warningContainer.append("button").attr("type", "button");
    gotItButton.node().id = "killFilterMessages_" + id;
    gotItButton.node().innerHTML = "Got It";
    gotItButton.on("click", warningModule.closeMessage);
    
    moduleContainer.classed("hidden", false);
    moduleContainer.classed("warn-expanded", true);
  };
  
  warningModule.showWarning = function ( header, reason, action, type, forcedWarning, additionalOpts ){
    const id = warningModule.addMessageBox();
    const warningContainer = _messageContext[id];
    const moduleContainer = _messageContainers[id];
    _visibleStatus[id] = true;
    
    if ( header.length > 0 ) {
      const head = warningContainer.append("div");
      head.classed("warning-row", true);
      const titleHeader = head.append("div");
      titleHeader.classed("warning-inline-flex warning-pr-3", true);
      titleHeader.node().innerHTML = "<b>Warning:</b>";
      const msgHeader = head.append("div");
      msgHeader.classed("warning-msg-content", true);
      msgHeader.node().innerHTML = header;
    }
    if ( reason.length > 0 ) {
      const reasonContainer = warningContainer.append("div");
      reasonContainer.classed("warning-row", true);
      const reasonHeader = reasonContainer.append("div");
      reasonHeader.classed("warning-inline-flex warning-pr-3", true);
      reasonHeader.node().innerHTML = "<b>Reason:</b>";
      const msgReason = reasonContainer.append("div");
      msgReason.classed("warning-msg-content", true);
      msgReason.node().innerHTML = reason;
    }
    if ( action.length > 0 ) {
      const actionContainer = warningContainer.append("div");
      actionContainer.classed("warning-row", true);
      const actionHeader = actionContainer.append("div");
      actionHeader.classed("warning-inline-flex warning-pr-8", true);
      actionHeader.node().innerHTML = "<b>Action:</b>";
      const msgAction = actionContainer.append("div");
      msgAction.classed("warning-msg-content", true);
      msgAction.node().innerHTML = action;
    }
    
    let gotItButton;
    if ( type === 1 ) {
      gotItButton = warningContainer.append("button").attr("type", "button");
      gotItButton.node().id = "killWarningErrorMessages_" + id;
      gotItButton.node().innerHTML = "Got It";
      gotItButton.on("click", warningModule.closeMessage);
    }
    
    if ( type === 2 ) {
      gotItButton = warningContainer.append("button").attr("type", "button");
      gotItButton.node().id = "killWarningErrorMessages_" + id;
      gotItButton.node().innerHTML = "Got It";
      gotItButton.on("click", warningModule.closeMessage);
      warningContainer.append("span").node().innerHTML = "|";
      const zoomToElementButton = warningContainer.append("button").attr("type", "button");
      zoomToElementButton.node().id = "zoomElementThing_" + id;
      zoomToElementButton.node().innerHTML = "Zoom to element ";
      zoomToElementButton.on("click", function (){
        graph.zoomToElementInGraph(additionalOpts);
      });
      warningContainer.append("span").node().innerHTML = "|";
      const ShowElementButton = warningContainer.append("button").attr("type", "button");
      ShowElementButton.node().id = "showElementThing_" + id;
      ShowElementButton.node().innerHTML = "Indicate element";
      ShowElementButton.on("click", function (){
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
    moduleContainer.classed("warn-expanded", true);
    moduleContainer.classed("hidden", false);
  };
  
  return warningModule;
};



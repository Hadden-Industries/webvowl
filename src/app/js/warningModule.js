module.exports = function (graph) {
  /** variable defs **/
  const warningModule = {};
  const _messageContainers = [];
  const _messageContext = [];
  const _visibleStatus = [];

  let _messageId = -1;

  warningModule.addMessageBox = function () {
    // add a container;
    _messageId++;
    const messageContainer = document.createElement("div");
    document
      .querySelector("#WarningErrorMessages")
      .appendChild(messageContainer);
    messageContainer.id = "messageContainerId_" + _messageId;

    const messageContext = document.createElement("div");
    messageContainer.appendChild(messageContext);
    messageContext.id = "messageContextId_" + _messageId;
    messageContext.classList.add("warning-msg-context");
    messageContainer.classList.add("warning-msg-container");
    //save in array
    _messageContainers.push(messageContainer);
    _messageContext.push(messageContext);

    // add animation to the container
    messageContainer.addEventListener(
      "animationend",
      _msgContainer_animationEnd,
    );

    // set visible flag that is used in end of animation
    _visibleStatus[_messageId] = true;
    return _messageId;
  };

  function _msgContainer_animationEnd() {
    const containerId = this.id;
    const tokens = containerId.split("_")[1];
    const mContainer = document.querySelector("#" + containerId);
    // get number of children
    mContainer.classList.toggle("hidden", !_visibleStatus[tokens]);
    // clean up DOM
    if (!_visibleStatus[tokens]) {
      mContainer.remove();
      _messageContext[tokens] = null;
      _messageContainers[tokens] = null;
    }
  }

  warningModule.createMessageContext = function (id) {
    const warningContainer = _messageContext[id];
    const moduleContainer = _messageContainers[id];
    const generalHint = document.createElement("div");
    warningContainer.appendChild(generalHint);
    generalHint.innerHTML = "";
    /** Editing mode activated. You can now modify an existing ontology or create a new one via the <em>ontology</em> menu. You can save any ontology using the <em>export</em> menu (and exporting it as TTL file).**/
    generalHint.innerHTML +=
      "Editing mode activated.<br>" +
      "You can now modify an existing ontology or create a new one via the <em>ontology</em> menu.<br>" +
      "You can save any ontology using the <em>export</em> menu (and exporting it as TTL file).";

    generalHint.classList.add("warning-hint");

    const ul = document.createElement("ul");
    warningContainer.appendChild(ul);
    const li1 = document.createElement("li");
    ul.appendChild(li1);
    li1.innerHTML =
      "Create a class with <b>double click / tap</b> on empty canvas area.";
    const li2 = document.createElement("li");
    ul.appendChild(li2);
    li2.innerHTML =
      "Edit names with <b>double click / tap</b> on element.</li>";
    const li3 = document.createElement("li");
    ul.appendChild(li3);
    li3.innerHTML =
      "Selection of default constructors is provided in the left sidebar.";
    const li4 = document.createElement("li");
    ul.appendChild(li4);
    li4.innerHTML =
      "Additional editing functionality is provided in the right sidebar.";

    const gotItButton = document.createElement("button");
    warningContainer.appendChild(gotItButton);
    gotItButton.setAttribute("type", "button");
    gotItButton.id = "killWarningErrorMessages_" + id;
    gotItButton.innerHTML = "Got It";
    gotItButton.addEventListener("click", warningModule.closeMessage);

    moduleContainer.classList.remove("hidden");
    moduleContainer.classList.add("warn-expanded");
  };

  warningModule.showMessage = function (id) {
    const moduleContainer = _messageContainers[id];
    moduleContainer.classList.remove("hidden");
    moduleContainer.classList.add("warn-expanded");
  };

  warningModule.closeMessage = function (id) {
    let nId;
    let targetId = typeof id === "string" ? id : this && this.id ? this.id : "";
    if (typeof id === "number") {
      targetId = String(id);
    }
    if (targetId && targetId.indexOf("_") !== -1) {
      nId = targetId.split("_")[1];
    } else {
      nId = targetId;
    }
    if (!nId || !_messageContainers[nId]) {
      return;
    }
    _visibleStatus[nId] = false;
    // get module;
    const moduleContainer = _messageContainers[nId];
    moduleContainer.classList.add("warn-collapsed");

    // find my id in the children
    const pNode = moduleContainer.parentNode;

    const followingChildren = [];
    const pChild = pNode.children;
    const pChild_len = pChild.length;
    const containerId = moduleContainer.id;
    let found_me = false;
    for (let i = 0; i < pChild_len; i++) {
      if (found_me === true) {
        followingChildren.push(pChild[i].id);
      }

      if (containerId === pChild[i].id) {
        found_me = true;
      }
    }

    for (let fc = 0; fc < followingChildren.length; fc++) {
      const child = document.querySelector("#" + followingChildren[fc]);
      child.classList.add("msg-collapsed");
      child.addEventListener("animationend", _child_animationEnd);
    }
  };

  function _child_animationEnd() {
    const c = this;
    c.classList.remove("msg-collapsed");
    c.removeEventListener("animationend", _child_animationEnd);
  }

  warningModule.showEditorHint = function () {
    const id = warningModule.addMessageBox();
    warningModule.createMessageContext(id);
  };

  warningModule.showExporterWarning = function () {
    warningModule.showWarning(
      "Can not export ontology",
      "Detected unsupported ontology axioms, (e.g. owl:Union)",
      "Ontology is not exported",
      1,
      false,
    );
  };

  warningModule.responseWarning = function (
    header,
    reason,
    action,
    callback,
    parameterArray,
    forcedWarning,
  ) {
    const id = warningModule.addMessageBox();
    const warningContainer = _messageContext[id];
    const moduleContainer = _messageContainers[id];
    _visibleStatus[id] = true;
    document
      .querySelector("#blockGraphInteractions")
      .classList.remove("hidden");

    if (header.length > 0) {
      const head = document.createElement("div");
      warningContainer.appendChild(head);
      head.classList.add("warning-row");
      const titleHeader = document.createElement("div");
      head.appendChild(titleHeader);
      titleHeader.classList.add("warning-inline-flex", "warning-pr-3");
      titleHeader.innerHTML = "<b>Warning:</b>";
      const msgHeader = document.createElement("div");
      head.appendChild(msgHeader);
      msgHeader.classList.add("warning-msg-content");
      msgHeader.innerHTML = header;
    }
    if (reason.length > 0) {
      const reasonContainer = document.createElement("div");
      warningContainer.appendChild(reasonContainer);
      reasonContainer.classList.add("warning-row");
      const reasonHeader = document.createElement("div");
      reasonContainer.appendChild(reasonHeader);
      reasonHeader.classList.add("warning-inline-flex", "warning-pr-3");
      reasonHeader.innerHTML = "<b>Reason:</b>";
      const msgReason = document.createElement("div");
      reasonContainer.appendChild(msgReason);
      msgReason.classList.add("warning-msg-content");
      msgReason.innerHTML = reason;
    }
    if (action.length > 0) {
      const actionContainer = document.createElement("div");
      warningContainer.appendChild(actionContainer);
      actionContainer.classList.add("warning-row");
      const actionHeader = document.createElement("div");
      actionContainer.appendChild(actionHeader);
      actionHeader.classList.add("warning-inline-flex", "warning-pr-8");
      actionHeader.innerHTML = "<b>Action:</b>";
      const msgAction = document.createElement("div");
      actionContainer.appendChild(msgAction);
      msgAction.classList.add("warning-msg-content");
      msgAction.innerHTML = action;
    }

    const gotItButton = document.createElement("button");
    warningContainer.appendChild(gotItButton);
    gotItButton.setAttribute("type", "button");
    gotItButton.id = "killWarningErrorMessages_" + id;
    gotItButton.innerHTML = "Continue";
    gotItButton.addEventListener("click", function () {
      warningModule.closeMessage(this.id);
      document.querySelector("#blockGraphInteractions").classList.add("hidden");
      callback(
        parameterArray[0],
        parameterArray[1],
        parameterArray[2],
        parameterArray[3],
      );
    });

    const spanNode = document.createElement("span");
    warningContainer.appendChild(spanNode);
    spanNode.innerHTML = "|";

    const cancelButton = document.createElement("button");
    warningContainer.appendChild(cancelButton);
    cancelButton.setAttribute("type", "button");
    cancelButton.id = "cancelButton_" + id;
    cancelButton.innerHTML = "Cancel";
    cancelButton.addEventListener("click", function () {
      warningModule.closeMessage(this.id);
      document.querySelector("#blockGraphInteractions").classList.add("hidden");
    });

    moduleContainer.classList.remove("hidden");
    moduleContainer.classList.add("warn-expanded");
  };

  warningModule.showMultiFileUploadWarning = function () {
    const id = warningModule.addMessageBox();
    const warningContainer = _messageContext[id];
    const moduleContainer = _messageContainers[id];
    _visibleStatus[id] = true;

    const generalHint = document.createElement("div");
    warningContainer.appendChild(generalHint);

    generalHint.innerHTML = "Uploading multiple files is not supported.<br>";

    generalHint.classList.add("warning-hint");

    const gotItButton = document.createElement("button");
    warningContainer.appendChild(gotItButton);
    gotItButton.setAttribute("type", "button");
    gotItButton.id = "killFilterMessages_" + id;
    gotItButton.innerHTML = "Got It";
    gotItButton.addEventListener("click", warningModule.closeMessage);

    moduleContainer.classList.remove("hidden");
    moduleContainer.classList.add("warn-expanded");
  };

  warningModule.showWarning = function (
    header,
    reason,
    action,
    type,
    forcedWarning,
    additionalOpts,
  ) {
    const id = warningModule.addMessageBox();
    const warningContainer = _messageContext[id];
    const moduleContainer = _messageContainers[id];
    _visibleStatus[id] = true;

    if (header.length > 0) {
      const head = document.createElement("div");
      warningContainer.appendChild(head);
      head.classList.add("warning-row");
      const titleHeader = document.createElement("div");
      head.appendChild(titleHeader);
      titleHeader.classList.add("warning-inline-flex", "warning-pr-3");
      titleHeader.innerHTML = "<b>Warning:</b>";
      const msgHeader = document.createElement("div");
      head.appendChild(msgHeader);
      msgHeader.classList.add("warning-msg-content");
      msgHeader.innerHTML = header;
    }
    if (reason.length > 0) {
      const reasonContainer = document.createElement("div");
      warningContainer.appendChild(reasonContainer);
      reasonContainer.classList.add("warning-row");
      const reasonHeader = document.createElement("div");
      reasonContainer.appendChild(reasonHeader);
      reasonHeader.classList.add("warning-inline-flex", "warning-pr-3");
      reasonHeader.innerHTML = "<b>Reason:</b>";
      const msgReason = document.createElement("div");
      reasonContainer.appendChild(msgReason);
      msgReason.classList.add("warning-msg-content");
      msgReason.innerHTML = reason;
    }
    if (action.length > 0) {
      const actionContainer = document.createElement("div");
      warningContainer.appendChild(actionContainer);
      actionContainer.classList.add("warning-row");
      const actionHeader = document.createElement("div");
      actionContainer.appendChild(actionHeader);
      actionHeader.classList.add("warning-inline-flex", "warning-pr-8");
      actionHeader.innerHTML = "<b>Action:</b>";
      const msgAction = document.createElement("div");
      actionContainer.appendChild(msgAction);
      msgAction.classList.add("warning-msg-content");
      msgAction.innerHTML = action;
    }

    let gotItButton;
    if (type === 1) {
      gotItButton = document.createElement("button");
      warningContainer.appendChild(gotItButton);
      gotItButton.setAttribute("type", "button");
      gotItButton.id = "killWarningErrorMessages_" + id;
      gotItButton.innerHTML = "Got It";
      gotItButton.addEventListener("click", warningModule.closeMessage);
    }

    if (type === 2) {
      gotItButton = document.createElement("button");
      warningContainer.appendChild(gotItButton);
      gotItButton.setAttribute("type", "button");
      gotItButton.id = "killWarningErrorMessages_" + id;
      gotItButton.innerHTML = "Got It";
      gotItButton.addEventListener("click", warningModule.closeMessage);

      const spanNode1 = document.createElement("span");
      warningContainer.appendChild(spanNode1);
      spanNode1.innerHTML = "|";

      const zoomToElementButton = document.createElement("button");
      warningContainer.appendChild(zoomToElementButton);
      zoomToElementButton.setAttribute("type", "button");
      zoomToElementButton.id = "zoomElementThing_" + id;
      zoomToElementButton.innerHTML = "Zoom to element ";
      zoomToElementButton.addEventListener("click", function () {
        graph.zoomToElementInGraph(additionalOpts);
      });

      const spanNode2 = document.createElement("span");
      warningContainer.appendChild(spanNode2);
      spanNode2.innerHTML = "|";

      const ShowElementButton = document.createElement("button");
      warningContainer.appendChild(ShowElementButton);
      ShowElementButton.setAttribute("type", "button");
      ShowElementButton.id = "showElementThing_" + id;
      ShowElementButton.innerHTML = "Indicate element";
      ShowElementButton.addEventListener("click", function () {
        if (additionalOpts.halo() === false) {
          additionalOpts.drawHalo();
          graph.updatePulseIds([additionalOpts.id()]);
        } else {
          additionalOpts.removeHalo();
          additionalOpts.drawHalo();
          graph.updatePulseIds([additionalOpts.id()]);
        }
      });
    }
    moduleContainer.classList.remove("hidden");
    moduleContainer.classList.add("warn-expanded");
  };

  return warningModule;
};

const BaseElement = require("../BaseElement");
const forceLayoutNodeFunctions = require("../forceLayoutNodeFunctions")();

module.exports = (function () {
  const Base = function (graph) {
    BaseElement.apply(this, arguments);

    const that = this;
    // Basic attributes
    let complement;
    let disjointUnion;
    let disjointWith;
    let individuals = [];
    let intersection;
    let union;
    let links;
    let rendertype = "round";
    // Additional attributes
    let maxIndividualCount;
    let fobj; // foreigner object for editing
    let ignoreLocalHoverEvents = false;
    let backupFullIri;
    // Element containers
    let nodeElement;

    // array to store my properties; // we will need this also later for semantic zooming stuff
    let assignedProperties = [];
    that.editingTextElement = false;

    this.isPropertyAssignedToThisElement = function (property) {
      // this goes via IRIS
      console.warn("Element IRI :" + property.iri());
      if (property.type() === "rdfs:subClassOf") {
        for (let i = 0; i < assignedProperties.length; i++) {
          const iriEl = assignedProperties[i].iri();
          if (property.iri() === iriEl) {
            return true;
          }
          if (
            property.type() === "rdfs:subClassOf" &&
            assignedProperties[i].type() === "rdfs:subClassOf"
          ) {
            return true;
          }
          if (
            property.type() === "owl:disjointWith" &&
            assignedProperties[i].type() === "owl:disjointWith"
          ) {
            return true;
          }
        }
      }
      return false;
    };

    this.existingPropertyIRI = function (url) {
      // this goes via IRIS
      for (let i = 0; i < assignedProperties.length; i++) {
        const iriEl = assignedProperties[i].iri();
        if (iriEl === url) {
          return true;
        }
      }
      return false;
    };

    this.addProperty = function (property) {
      if (assignedProperties.indexOf(property) === -1) {
        assignedProperties.push(property);
      }
    };

    this.removePropertyElement = function (property) {
      // console.log("Calling removing old property!"+ property.iri());
      if (assignedProperties.indexOf(property) !== -1) {
        // console.log("Found it!");
        assignedProperties.splice(assignedProperties.indexOf(property), 1);
      }
    };
    this.getMyProperties = function () {
      return assignedProperties;
    };
    this.copyOtherProperties = function (otherProperties) {
      assignedProperties = otherProperties;
    };

    this.copyInformation = function (other) {
      console.warn(other.labelForCurrentLanguage());
      if (other.type() !== "owl:Thing") {
        that.label(other.label());
      }
      that.complement(other.complement());
      that.iri(other.iri());
      that.copyOtherProperties(other.getMyProperties());
      that.baseIri(other.baseIri());
      if (other.type() === "owl:Class") {
        that.backupLabel(other.label());
        // console.log("copied backup label"+that.backupLabel());
      }
      if (other.backupLabel() !== undefined) {
        that.backupLabel(other.backupLabel());
      }
    };

    this.enableEditing = function (autoEditing) {
      if (autoEditing === false) {
        return;
      }
      that.raiseDoubleClickEdit(true);
    };

    this.raiseDoubleClickEdit = function (forceIRISync) {
      d3.selectAll(".foreignelements").remove();
      if (
        nodeElement === undefined ||
        this.type() === "owl:Thing" ||
        this.type() === "rdfs:Literal"
      ) {
        console.warn("No Container found");
        return;
      }
      if (fobj !== undefined) {
        nodeElement.selectAll(".foreignelements").remove();
      }

      backupFullIri = undefined;
      graph.dispatchEvent(
        new CustomEvent("elementfocused", { detail: { element: undefined } }),
      );
      graph.dispatchEvent(
        new CustomEvent("elementfocused", { detail: { element: that } }),
      );
      // add again the editing elements to that one
      if (graph.isTouchDevice() === true) {
        graph.activateHoverElements(true, that, true);
      }
      that.editingTextElement = true;
      ignoreLocalHoverEvents = true;
      that.nodeElement().selectAll("circle").classed("hoveredForEditing", true);
      graph.killDelayedTimer();
      graph.ignoreOtherHoverEvents(false);
      fobj = nodeElement
        .append("foreignObject")
        .attr("x", -0.5 * (that.textWidth() - 2))
        .attr("y", -12)
        .attr("height", 30)
        .attr("class", "foreignelements")
        .on("dragstart", function () {
          return false;
        }) // remove drag operations of text element)
        .attr("width", that.textWidth() - 2);

      const editText = fobj
        .append("xhtml:input")
        .attr("class", "nodeEditSpan nodeEditSpan--node")
        .attr("id", that.id())
        .attr("align", "center")
        .attr("contentEditable", "true")
        .on("dragstart", function () {
          return false;
        }); // remove drag operations of text element)

      const bgColor = "#f00";
      const txtWidth = that.textWidth() - 2;
      editText.style({
        align: "center",
        color: "black",
        width: txtWidth + "px",
        height: "15px",
        "background-color": bgColor,
        "border-bottom": "2px solid black",
      });
      const txtNode = editText.node();
      txtNode.value = that.labelForCurrentLanguage();
      txtNode.focus();
      txtNode.select();
      that.frozen(true); // << releases the not after selection
      that.locked(true);

      event && event.stopPropagation();
      // ignoreNodeHoverEvent=true;
      // // add some events that relate to this object
      editText.on("click", function () {
        d3.event.stopPropagation();
      });
      // // remove hover Events for now;
      editText.on("mouseout", function () {
        d3.event.stopPropagation();
      });
      editText
        .on("mousedown", function () {
          d3.event.stopPropagation();
        })
        .on("keydown", function () {
          d3.event.stopPropagation();
          if (d3.event.keyCode === 13) {
            this.blur();
            that.frozen(false); // << releases the not after selection
            that.locked(false);
          }
        })
        .on("keyup", function () {
          let syncedIRI = null;
          if (forceIRISync) {
            const labelName = editText.node().value;
            const resourceName = labelName.replaceAll(" ", "_");
            syncedIRI = that.baseIri() + resourceName;
            backupFullIri = syncedIRI;
          }
          let prefixedIri = null;
          if (forceIRISync) {
            prefixedIri = graph
              .options()
              .prefixModule()
              .getPrefixRepresentationForFullURI(syncedIRI);
          }
          graph.dispatchEvent(
            new CustomEvent("editor-element-keyup", {
              detail: {
                element: that,
                label: editText.node().value,
                syncedIRI: forceIRISync ? syncedIRI : null,
                prefixedIri: prefixedIri,
              },
            }),
          );
        })
        .on("blur", function () {
          that.editingTextElement = false;
          ignoreLocalHoverEvents = false;
          that
            .nodeElement()
            .selectAll("circle")
            .classed("hoveredForEditing", false);
          const newLabel = editText.node().value;
          nodeElement.selectAll(".foreignelements").remove();
          // that.setLabelForCurrentLanguage(classNameConvention(editText.node().value));
          that.label(newLabel);
          that.backupLabel(newLabel);
          that.redrawLabelText();
          if ( graph.options().searchMenu() ) {
            graph.options().searchMenu().requestDictionaryUpdate();
          }
          that.frozen(graph.paused());
          that.locked(graph.paused());
          graph.ignoreOtherHoverEvents(false);
          // console.log("Calling blur on Node!");
          if (backupFullIri) {
            const sanityCheckResult =
              graph.checkIfIriClassAlreadyExist(backupFullIri);
            if (sanityCheckResult === false) {
              that.iri(backupFullIri);
            } else {
              // throw warnign
              graph
                .options()
                .warningModule()
                .showWarning(
                  "Already seen this class",
                  "Input IRI: " +
                    backupFullIri +
                    " for element: " +
                    that.labelForCurrentLanguage() +
                    " already been set",
                  "Restoring previous IRI for Element : " + that.iri(),
                  2,
                  false,
                  sanityCheckResult,
                );
            }
          }
          if (graph.isADraggerActive() === false) {
            graph.dispatchEvent(
              new CustomEvent("elementfocused", {
                detail: { element: undefined },
              }),
            );
            graph.dispatchEvent(
              new CustomEvent("elementfocused", { detail: { element: that } }),
            );
          }
        }); // add a foreiner element to this thing;
    };

    this.renderType = function (t) {
      if (!arguments.length) {
        return rendertype;
      }
      rendertype = t;
      return this;
    };
    // Properties
    this.complement = function (p) {
      if (!arguments.length) {
        return complement;
      }
      complement = p;
      return this;
    };

    this.disjointUnion = function (p) {
      if (!arguments.length) {
        return disjointUnion;
      }
      disjointUnion = p;
      return this;
    };

    this.disjointWith = function (p) {
      if (!arguments.length) {
        return disjointWith;
      }
      disjointWith = p;
      return this;
    };

    this.individuals = function (p) {
      if (!arguments.length) {
        return individuals;
      }
      individuals = p || [];
      return this;
    };

    this.intersection = function (p) {
      if (!arguments.length) {
        return intersection;
      }
      intersection = p;
      return this;
    };

    this.links = function (p) {
      if (!arguments.length) {
        return links;
      }
      links = p;
      return this;
    };

    this.maxIndividualCount = function (p) {
      if (!arguments.length) {
        return maxIndividualCount;
      }
      maxIndividualCount = p;
      return this;
    };

    this.nodeElement = function (p) {
      if (!arguments.length) {
        return nodeElement;
      }
      nodeElement = p;
      return this;
    };

    this.union = function (p) {
      if (!arguments.length) {
        return union;
      }
      union = p;
      return this;
    };

    /**
     * Returns css classes generated from the data of this object.
     * @returns {Array}
     */
    that.collectCssClasses = function () {
      let cssClasses = [];

      if (typeof that.styleClass() === "string") {
        cssClasses.push(that.styleClass());
      }

      cssClasses = cssClasses.concat(that.visualAttributes());

      return cssClasses;
    };

    // Reused functions TODO refactor
    this.addMouseListeners = function () {
      // Empty node
      if (!that.nodeElement()) {
        console.warn(this);
        return;
      }

      that
        .nodeElement()
        .selectAll("*")
        .on("mouseover", onMouseOver)
        .on("mouseout", onMouseOut);
    };

    this.animationProcess = function () {
      let animRuns = false;
      if (that.getHalos()) {
        const haloGr = that.getHalos();
        const haloEls = haloGr.selectAll(".searchResultA");
        animRuns = haloGr.attr("animationRunning");
        if (typeof animRuns !== "boolean") {
          // parse this to a boolean value
          animRuns = animRuns === "true";
        }
        if (animRuns === false) {
          haloEls.classed("searchResultA", false);
          haloEls.classed("searchResultB", true);
        }
      }
      return animRuns;
    };

    this.foreground = function () {
      const selectedNode = that.nodeElement() ? that.nodeElement().node() : null,
        nodeContainer = selectedNode ? selectedNode.parentNode : null;
      // check if the halo is present and an animation is running
      if (that.animationProcess() === false) {
        // Append hovered element as last child to the container list.
        nodeContainer.appendChild(selectedNode);
      }
    };

    function onMouseOver() {
      if (that.mouseEntered() || ignoreLocalHoverEvents === true) {
        return;
      }

      const selectedNode = that.nodeElement() ? that.nodeElement().node() : null,
        nodeContainer = selectedNode ? selectedNode.parentNode : null;

      // Append hovered element as last child to the container list.
      if (that.animationProcess() === false) {
        nodeContainer.appendChild(selectedNode);
      }
      if (graph.isTouchDevice() === false) {
        that.setHoverHighlighting(true);
        that.mouseEntered(true);
        if (
          graph.editorMode() === true &&
          graph.ignoreOtherHoverEvents() === false
        ) {
          graph.activateHoverElements(true, that);
        }
      } else {
        if (
          graph.editorMode() === true &&
          graph.ignoreOtherHoverEvents() === false
        ) {
          graph.activateHoverElements(true, that, true);
        }
      }
    }

    function onMouseOut() {
      that.setHoverHighlighting(false);
      that.mouseEntered(false);
      if (
        graph.editorMode() === true &&
        graph.ignoreOtherHoverEvents() === false
      ) {
        graph.activateHoverElements(false);
      }
    }

    forceLayoutNodeFunctions.addTo(this);
  };

  Base.prototype = Object.create(BaseElement.prototype);
  Base.prototype.constructor = Base;

  return Base;
})();

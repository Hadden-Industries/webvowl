/**
 * Contains the logic for the sidebar.
 * @param graph the graph that belongs to these controls
 * @returns {{}}
 */
module.exports = function ( graph ){
  
  const editSidebar = {},
    languageTools = webvowl.util.languageTools(),
    elementTools = webvowl.util.elementTools();
  
  const prefixModule = webvowl.util.prefixTools(graph);
  let selectedElementForCharacteristics;
  let oldPrefix, oldPrefixURL;
  let prefix_editMode = false;
  
  
  editSidebar.clearMetaObjectValue = function (){
    d3.select("#titleEditor").node().value = "";
    d3.select("#iriEditor").node().value = "";
    d3.select("#versionEditor").node().value = "";
    d3.select("#authorsEditor").node().value = "";
    d3.select("#descriptionEditor").node().value = "";
    // todo add clear description;
  };
  
  
  editSidebar.updatePrefixUi = function (){
    editSidebar.updateElementWidth();
    const prefixListContainer = d3.select("#prefixURL_Container");
    while ( prefixListContainer.node().firstChild ) {
      prefixListContainer.node().removeChild(prefixListContainer.node().firstChild);
    }
    setupPrefixList();
  };
  
  editSidebar.setup = function (){
    setupCollapsing();
    setupPrefixList();
    setupAddPrefixButton();
    setupSupportedDatatypes();
    
    
    d3.select("#titleEditor")
      .on("change", function (){
        graph.options().addOrUpdateGeneralObjectEntry("title", d3.select("#titleEditor").node().value);
      })
      .on("keydown", function (event){
        event.stopPropagation();
        if ( event.keyCode === 13 ) {
          event.preventDefault();
          graph.options().addOrUpdateGeneralObjectEntry("title", d3.select("#titleEditor").node().value);
        }
      });
    d3.select("#iriEditor")
      .on("change", function (){
        if ( graph.options().addOrUpdateGeneralObjectEntry("iri", d3.select("#iriEditor").node().value) === false ) {
          // restore value
          d3.select("#iriEditor").node().value = graph.options().getGeneralMetaObjectProperty('iri');
        }
      })
      .on("keydown", function (event){
        event.stopPropagation();
        if ( event.keyCode === 13 ) {
          event.preventDefault();
          if ( graph.options().addOrUpdateGeneralObjectEntry("iri", d3.select("#iriEditor").node().value) === false ) {
            // restore value
            d3.select("#iriEditor").node().value = graph.options().getGeneralMetaObjectProperty('iri');
          }
        }
      });
    d3.select("#versionEditor")
      .on("change", function (){
        graph.options().addOrUpdateGeneralObjectEntry("version", d3.select("#versionEditor").node().value);
      })
      .on("keydown", function (event){
        event.stopPropagation();
        if ( event.keyCode === 13 ) {
          event.preventDefault();
          graph.options().addOrUpdateGeneralObjectEntry("version", d3.select("#versionEditor").node().value);
        }
      });
    d3.select("#authorsEditor")
      .on("change", function (){
        graph.options().addOrUpdateGeneralObjectEntry("author", d3.select("#authorsEditor").node().value);
      })
      .on("keydown", function (event){
        event.stopPropagation();
        if ( event.keyCode === 13 ) {
          event.preventDefault();
          graph.options().addOrUpdateGeneralObjectEntry("author", d3.select("#authorsEditor").node().value);
        }
      });
    d3.select("#descriptionEditor")
      .on("change", function (){
        graph.options().addOrUpdateGeneralObjectEntry("description", d3.select("#descriptionEditor").node().value);
      });
    
    editSidebar.updateElementWidth();
    
  };
  
  function setupSupportedDatatypes(){
    const datatypeEditorSelection = d3.select("#typeEditor_datatype").node();
    const supportedDatatypes = ["undefined", "xsd:boolean", "xsd:double", "xsd:integer", "xsd:string"];
    for ( let i = 0; i < supportedDatatypes.length; i++ ) {
      const optB = document.createElement('option');
      optB.innerHTML = supportedDatatypes[i];
      datatypeEditorSelection.appendChild(optB);
    }
  }
  
  function highlightDeleteButton( enable, name ){
    const deletePath = d3.select("#del_pathFor_" + name);
    const deleteRect = d3.select("#del_rectFor_" + name);
    
    if ( enable === false ) {
      deletePath.classed("delete-path-style", true);
      deleteRect.classed("non-clickable", true).classed("clickable", false);
    } else {
      deletePath.classed("delete-path-style", true);
      deleteRect.classed("clickable", true).classed("non-clickable", false);
    }
  }
  
  
  function highlightEditButton( enable, name, fill ){
    const editPath = d3.select("#pathFor_" + name);
    const editRect = d3.select("#rectFor_" + name);
    
    if ( enable === false ) {
      editPath.classed("edit-path-style", true);
      editRect.classed("non-clickable", true).classed("clickable", false);
    } else {
      editPath.classed("edit-path-style", true);
      editRect.classed("clickable", true).classed("non-clickable", false);
    }
    
  }
  
  function setupAddPrefixButton(){
    const btn = d3.select("#addPrefixButton");
    btn.on("click", function (){
      
      // check if we are still in editMode?
      if ( prefix_editMode === false ) {
        // create new line entry;
        const name = "emptyPrefixEntry";
        const prefixListContainer = d3.select("#prefixURL_Container");
        const prefixEditContainer = prefixListContainer.append("div");
        prefixEditContainer.classed("prefixIRIElements", true);
        prefixEditContainer.node().id = "prefixContainerFor_" + name;
        
        const IconContainer = prefixEditContainer.append("div");
        IconContainer.classed("icon-container-abs", true);
        IconContainer.node().id = "containerFor_" + name;
        const editButton = IconContainer.append("svg");
        editButton.classed("edit-btn-svg noselect", true);
        editButton.node().id = "editButtonFor_" + name;
        
        editButton.node().elementStyle = "save";
        editButton.node().selectorName = name;
        const editIcon = editButton.append("g");
        const editRect = editIcon.append("rect");
        const editPath = editIcon.append("path");
        editIcon.node().id = "iconFor_" + name;
        editPath.node().id = "pathFor_" + name;
        editRect.node().id = "rectFor_" + name;
        
        editIcon.node().selectorName = name;
        editPath.node().selectorName = name;
        editRect.node().selectorName = name;
        IconContainer.node().title = "Save new prefix and IRI";
        
        editPath.classed("editPrefixIcon edit-path-style", true);
        editRect.attr("width", "14px");
        editRect.attr("height", "14px");
        editRect.classed("edit-rect-style", true);
        editRect.attr("transform", "matrix(1,0,0,1,-3,4)");
        
        editButton.selectAll("g").on("mouseover", function (){
          highlightEditButton(true, this.selectorName, true);
        });
        editButton.selectAll("g").on("mouseout", function (){
          highlightEditButton(false, this.selectorName, true);
        });
        // Check mark
        // M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z
        // pencil
        // M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z
        editPath.attr("d", "M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z");
        editPath.attr("transform", "matrix(0.45,0,0,0.45,0,5)");
        
        const prefInput = prefixEditContainer.append("input");
        prefInput.classed("prefixInput pref-input-style", true);
        prefInput.node().type = "text";
        prefInput.node().id = "prefixInputFor_" + name;
        prefInput.node().autocomplete = "off";
        prefInput.node().value = "";
        
        const prefURL = prefixEditContainer.append("input");
        prefURL.classed("prefixURL", true);
        prefURL.node().type = "text";
        prefURL.node().id = "prefixURLFor_" + name;
        prefURL.node().autocomplete = "off";
        prefURL.node().value = "";
        
        prefInput.node().disabled = false;
        prefURL.node().disabled = false;
        prefix_editMode = true;
        const deleteContainer = prefixEditContainer.append("div");
        deleteContainer.classed("delete-container-style", true);
        const deleteButton = deleteContainer.append("svg");
        deleteButton.node().id = "deleteButtonFor_" + name;
        deleteContainer.node().title = "Delete prefix and IRI";
        deleteButton.classed("delete-btn-svg", true);
        const deleteIcon = deleteButton.append("g");
        const deleteRect = deleteIcon.append("rect");
        const deletePath = deleteIcon.append("path");
        deleteIcon.node().id = "del_iconFor_" + name;
        deletePath.node().id = "del_pathFor_" + name;
        deleteRect.node().id = "del_rectFor_" + name;
        
        deleteIcon.node().selectorName = name;
        deletePath.node().selectorName = name;
        deleteRect.node().selectorName = name;
        
        deletePath.classed("delete-path-style", true);
        deleteRect.attr("width", "10px");
        deleteRect.attr("height", "14px");
        deleteRect.classed("delete-rect-style", true);
        deleteRect.attr("transform", "matrix(1,0,0,1,-3,4)");
        
        
        deletePath.attr("d", "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z");
        deletePath.attr("transform", "matrix(0.45,0,0,0.45,0,5)");
        
        deleteButton.selectAll("g").on("mouseover", function (){
          highlightDeleteButton(true, this.selectorName);
        });
        deleteButton.selectAll("g").on("mouseout", function (){
          highlightDeleteButton(false, this.selectorName);
        });
        
        
        // connect the buttons;
        editButton.on("click", enablePrefixEdit);
        deleteButton.on("click", deletePrefixLine);
        
        editSidebar.updateElementWidth();
        // swap focus to prefixInput
        prefInput.node().focus();
        oldPrefix = name;
        oldPrefixURL = "";
        d3.select("#addPrefixButton").node().innerHTML = "Save Prefix";
      } else {
        d3.select("#editButtonFor_emptyPrefixEntry").on("click")(d3.select("#editButtonFor_emptyPrefixEntry").node());
      }
      
    });
    
  }
  
  function setupPrefixList(){
    if ( graph.isEditorMode() === false ) {return;}
    const prefixListContainer = d3.select("#prefixURL_Container");
    const prefixElements = graph.options().prefixList();
    for ( const name in prefixElements ) {
      if ( Object.prototype.hasOwnProperty.call(prefixElements, name) ) {
        const prefixEditContainer = prefixListContainer.append("div");
        prefixEditContainer.classed("prefixIRIElements", true);
        prefixEditContainer.node().id = "prefixContainerFor_" + name;
        
        // create edit button which enables the input fields
        const IconContainer = prefixEditContainer.append("div");
        IconContainer.classed("icon-container-abs", true);
        IconContainer.node().id = "containerFor_" + name;
        const editButton = IconContainer.append("svg");
        editButton.classed("edit-btn-svg noselect", true);
        editButton.node().id = "editButtonFor_" + name;
        IconContainer.node().title = "Edit prefix and IRI";
        editButton.node().elementStyle = "save";
        editButton.node().selectorName = name;
        
        editButton.node().id = "editButtonFor_" + name;
        editButton.node().elementStyle = "edit";
        const editIcon = editButton.append("g");
        const editRect = editIcon.append("rect");
        const editPath = editIcon.append("path");
        editIcon.node().id = "iconFor_" + name;
        editPath.node().id = "pathFor_" + name;
        editRect.node().id = "rectFor_" + name;
        
        editIcon.node().selectorName = name;
        editPath.node().selectorName = name;
        editRect.node().selectorName = name;
        
        editPath.classed("editPrefixIcon edit-path-style", true);
        editRect.attr("width", "14px");
        editRect.attr("height", "14px");
        editRect.classed("edit-rect-style", true);
        editRect.attr("transform", "matrix(1,0,0,1,-3,4)");
        
        editButton.selectAll("g").on("mouseover", function (){
          const sender = this;
          const enable = true;
          const f_editPath = d3.select("#pathFor_" + sender.selectorName);
          const f_editRect = d3.select("#rectFor_" + sender.selectorName);
          
          if ( enable === false ) {
            f_editPath.classed("edit-path-style", true);
            f_editRect.classed("non-clickable", true).classed("clickable", false);
          } else {
            f_editPath.classed("edit-path-style", true);
            f_editRect.classed("clickable", true).classed("non-clickable", false);
          }
        });
        editButton.selectAll("g").on("mouseout", function (){
          const sender = this;
          const enable = false;
          const f_editPath = d3.select("#pathFor_" + sender.selectorName);
          const f_editRect = d3.select("#rectFor_" + sender.selectorName);
          
          if ( enable === false ) {
            f_editPath.classed("edit-path-style", true);
            f_editRect.classed("non-clickable", true).classed("clickable", false);
          } else {
            f_editPath.classed("edit-path-style", true);
            f_editRect.classed("clickable", true).classed("non-clickable", false);
          }
        });
        
        editPath.attr("d", "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z");
        editPath.attr("transform", "matrix(-0.45,0,0,0.45,10,5)");
        
        // create input field for prefix
        const prefInput = prefixEditContainer.append("input");
        prefInput.classed("prefixInput pref-input-style", true);
        prefInput.node().type = "text";
        prefInput.node().id = "prefixInputFor_" + name;
        prefInput.node().autocomplete = "off";
        prefInput.node().value = name;
        
        // create input field for prefix url
        const prefURL = prefixEditContainer.append("input");
        prefURL.classed("prefixURL", true);
        prefURL.node().type = "text";
        prefURL.node().id = "prefixURLFor_" + name;
        prefURL.node().autocomplete = "off";
        prefURL.node().value = prefixElements[name];
        prefURL.node().title = prefixElements[name];
        prefInput.node().disabled = true;
        prefURL.node().disabled = true;
        
        // create the delete button
        const deleteContainer = prefixEditContainer.append("div");
        deleteContainer.classed("delete-container-style", true);
        const deleteButton = deleteContainer.append("svg");
        deleteButton.node().id = "deleteButtonFor_" + name;
        deleteContainer.node().title = "Delete prefix and IRI";
        deleteButton.classed("delete-btn-svg", true);
        const deleteIcon = deleteButton.append("g");
        const deleteRect = deleteIcon.append("rect");
        const deletePath = deleteIcon.append("path");
        deleteIcon.node().id = "del_iconFor_" + name;
        deletePath.node().id = "del_pathFor_" + name;
        deleteRect.node().id = "del_rectFor_" + name;
        
        deleteIcon.node().selectorName = name;
        deletePath.node().selectorName = name;
        deleteRect.node().selectorName = name;
        
        deletePath.classed("delete-path-style", true);
        deleteRect.attr("width", "10px");
        deleteRect.attr("height", "14px");
        deleteRect.classed("delete-rect-style", true);
        deleteRect.attr("transform", "matrix(1,0,0,1,-3,4)");
        
        deletePath.attr("d", "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z");
        deletePath.attr("transform", "matrix(0.45,0,0,0.45,0,5)");
        
        deleteButton.selectAll("g").on("mouseover", function (){
          const selector = this;
          const enable = true;
          const f_deletePath = d3.select("#del_pathFor_" + selector.selectorName);
          const f_deleteRect = d3.select("#del_rectFor_" + selector.selectorName);
          
          if ( enable === false ) {
            f_deletePath.classed("delete-path-style", true);
            f_deleteRect.classed("non-clickable", true).classed("clickable", false);
          } else {
            f_deletePath.classed("delete-path-style", true);
            f_deleteRect.classed("clickable", true).classed("non-clickable", false);
          }
        });
        deleteButton.selectAll("g").on("mouseout", function (){
          const selector = this;
          const enable = false;
          const f_deletePath = d3.select("#del_pathFor_" + selector.selectorName);
          const f_deleteRect = d3.select("#del_rectFor_" + selector.selectorName);
          
          if ( enable === false ) {
            f_deletePath.classed("delete-path-style", true);
            f_deleteRect.classed("non-clickable", true).classed("clickable", false);
          } else {
            f_deletePath.classed("delete-path-style", true);
            f_deleteRect.classed("clickable", true).classed("non-clickable", false);
          }
        });
        
        
        editButton.on("click", enablePrefixEdit);
        deleteButton.on("click", deletePrefixLine);
        
        // EXPERIMENTAL
        
        if ( name === "rdf" ||
          name === "rdfs" ||
          name === "xsd" || name === "dc" ||
          name === "owl"
        ) {
          // make them invis so the spacing does not change
          IconContainer.classed("hidden", true);
          deleteContainer.classed("hidden", true);
        }
      }
    }
    prefixModule.updatePrefixModel();
  }
  
  function deletePrefixLine(){
    if ( this.disabled === true ) {return;}
    d3.select("#addPrefixButton").node().innerHTML = "Add Prefix";
    const selector = this.id.split("_")[1];
    d3.select("#prefixContainerFor_" + selector).remove();
    graph.options().removePrefix(selector);
    prefix_editMode = false; // <<TODO make some sanity checks
    prefixModule.updatePrefixModel();
  }
  
  function enablePrefixEdit( item ){
    let agent = this;
    if ( item && !(item instanceof Event) && item.id ) {
      agent = item;
    }
    if ( !agent || agent.disabled === true || !agent.id ) {return;}
    const selector = agent.id.split("_")[1];
    const stl = agent.elementStyle;
    if ( stl === "edit" ) {
      d3.select("#prefixInputFor_" + selector).node().disabled = false;
      d3.select("#prefixURLFor_" + selector).node().disabled = false;
      // change the button content
      //  this.innerHTML = "\u2714";
      agent.elementStyle = "save";
      oldPrefix = d3.select("#prefixInputFor_" + selector).node().value;
      oldPrefixURL = d3.select("#prefixURLFor_" + selector).node().value;
      prefix_editMode = true;
      if ( d3.select("#containerFor_" + selector).node() )
        {d3.select("#containerFor_" + selector).node().title = "Save new prefix and IRI";}
      
      const editButton = d3.select(agent);
      editButton.selectAll("g").on("mouseover", function (){
        
        highlightEditButton(true, agent.selectorName, true);
      });
      editButton.selectAll("g").on("mouseout", function (){
        highlightEditButton(false, agent.selectorName, true);
      });
      
      const editPath = d3.select("#pathFor_" + agent.selectorName);
      editPath.attr("d", "M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z");
      editPath.attr("transform", "matrix(0.45,0,0,0.45,0,5)");
      
      highlightEditButton(true, agent.selectorName, true);
      
      
    }
    if ( stl === "save" ) {
      const newPrefixURL = d3.select("#prefixURLFor_" + selector).node().value;
      const newPrefix = d3.select("#prefixInputFor_" + selector).node().value;
      
      
      if ( graph.options().updatePrefix(oldPrefix, newPrefix, oldPrefixURL, newPrefixURL) === true ) {
        d3.select("#prefixInputFor_" + newPrefix).node().disabled = true;
        d3.select("#prefixURLFor_" + newPrefix).node().disabled = true;
        d3.select("#addPrefixButton").node().innerHTML = "Add Prefix";
        if ( d3.select("#containerFor_" + selector).node() )
          {d3.select("#containerFor_" + selector).node().title = "Edit prefix and IRI";}
        
        // change the button content
        
        agent.elementStyle = "edit";
        prefix_editMode = false;
        prefixModule.updatePrefixModel();
        const saveButton = d3.select(agent);
        saveButton.selectAll("g").on("mouseover", function (){
          highlightEditButton(true, agent.selectorName, false);
        });
        saveButton.selectAll("g").on("mouseout", function (){
          highlightEditButton(false, agent.selectorName, false);
        });
        
        const savePath = d3.select("#pathFor_" + agent.selectorName);
        savePath.attr("d", "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z");
        savePath.attr("transform", "matrix(-0.45,0,0,0.45,10,5)");
        highlightEditButton(true, agent.selectorName, false);
      }
    }
  }
  
  function changeDatatypeType( element ){
    const datatypeEditorSelection = d3.select("#typeEditor_datatype").node();
    const givenName = datatypeEditorSelection.value;
    let identifier = givenName.split(":")[1];
    
    if ( datatypeEditorSelection.value !== "undefined" ) {
      d3.select("#element_iriEditor").node().disabled = true;
      d3.select("#element_labelEditor").node().disabled = true;
    } else {
      identifier = "undefined";
      d3.select("#element_iriEditor").node().disabled = false;
      d3.select("#element_labelEditor").node().disabled = false;
    }
    element.label(identifier);
    element.dType(givenName);
    element.iri("http://www.w3.org/2001/XMLSchema#" + identifier);
    element.baseIri("http://www.w3.org/2001/XMLSchema#");
    element.redrawLabelText();
    
    d3.select("#element_iriEditor").node().value = prefixModule.getPrefixRepresentationForFullURI(element.iri());
    d3.select("#element_iriEditor").node().title = element.iri();
    d3.select("#element_labelEditor").node().value = element.labelForCurrentLanguage();
  }
  
  
  function identifyExternalCharacteristicForElement( ontoIRI, elementIRI ){
    return (elementIRI.indexOf(ontoIRI) === -1);
    
  }
  
  function defaultIriValue( element ){
    // get the iri of that element;
    if ( graph.options().getGeneralMetaObject().iri ) {
      const str2Compare = graph.options().getGeneralMetaObject().iri + element.id();
      return element.iri() === str2Compare;
    }
    return false;
  }
  
  function getURLFROMPrefixedVersion( element ){
    let url = d3.select("#element_iriEditor").node().value;
    const base = graph.options().getGeneralMetaObjectProperty("iri");
    if ( validURL(url) === false ) {
      
      // make better usability
      // try to split element;
      const tokens = url.split(":");
      
      //console.warn("try to split the input into prefix:name")
      console.warn("Tokens");
      console.warn(tokens);
      console.warn("---------------");
      // TODO MORE VALIDATION TESTS
      if ( tokens.length === 2 ) {
        const pr = tokens[0];
        const name = tokens[1];
        if ( pr.length > 0 ) {
          const basePref = graph.options().prefixList()[pr];
          if ( basePref === undefined ) {
            console.warn("ERROR __________________");
            graph.options().warningModule().showWarning("Invalid Element IRI",
              "Could not resolve prefix '" + basePref + "'",
              "Restoring previous IRI for Element" + element.iri(), 1, false);
            d3.select("#element_iriEditor").node().value = element.iri();
            return;
            
          }
          // check if url is not empty
          
          if ( name.length === 0 ) {
            graph.options().warningModule().showWarning("Invalid Element IRI",
              "Input IRI is EMPTY",
              "Restoring previous IRI for Element" + element.iri(), 1, false);
            console.warn("NO INPUT PROVIDED");
            d3.select("#element_iriEditor").node().value = element.iri();
            return;
            
          }
          url = basePref + name;
        }
        else {
          url = base + name;
        }
      } else {
        if ( url.length === 0 ) {
          //
          console.warn("NO INPUT PROVIDED");
          d3.select("#element_iriEditor").node().value = element.iri();
          return;
        }
        // failed to identify anything useful
        console.warn("Tryig to use the input!");
        url = base + url;
      }
    }
    return url;
  }
  
  function changeIriForElement( element ){
    const url = getURLFROMPrefixedVersion(element);
    const base = graph.options().getGeneralMetaObjectProperty("iri");
    let sanityCheckResult;
    if ( elementTools.isNode(element) ) {
      
      sanityCheckResult = graph.checkIfIriClassAlreadyExist(url);
      if ( sanityCheckResult === false ) {
        element.iri(url);
      } else {
        // throw warnign
        graph.options().warningModule().showWarning("Already seen this class",
          "Input IRI: " + url + " for element: " + element.labelForCurrentLanguage() + " already been set",
          "Restoring previous IRI for Element : " + element.iri(), 2, false, sanityCheckResult);
        
        editSidebar.updateSelectionInformation(element);
        return;
        
      }
    }
    if ( elementTools.isProperty(element) === true ) {
      sanityCheckResult = editSidebar.checkProperIriChange(element, url);
      if ( sanityCheckResult !== false ) {
        graph.options().warningModule().showWarning("Already seen this property",
          "Input IRI: " + url + " for element: " + element.labelForCurrentLanguage() + " already been set",
          "Restoring previous IRI for Element : " + element.iri(), 1, false, sanityCheckResult);
        
        editSidebar.updateSelectionInformation(element);
        return;
      }
    }
    
    // if (element.existingPropertyIRI(url)===true){
    //     console.warn("I Have seen this Particular URL already "+url);
    //     graph.options().warningModule().showWarning("Already Seen This one ",
    //         "Input IRI For Element"+ element.labelForCurrentLanguage()+" already been set  ",
    //         "Restoring previous IRI for Element"+element.iri(),1,false);
    //     d3.select("#element_iriEditor").node().value=graph.options().prefixModule().getPrefixRepresentationForFullURI(element.iri());
    //     editSidebar.updateSelectionInformation(element);
    //     return;
    // }
    
    element.iri(url);
    if ( identifyExternalCharacteristicForElement(base, url) === true ) {
      addAttribute(element, "external");
      // background color for external element;
      element.backgroundColor("#36C");
      element.redrawElement();
      element.redrawLabelText();
      // handle visual selection
      
    } else {
      removeAttribute(element, "external");
      // background color for external element;
      element.backgroundColor(undefined);
      element.redrawElement();
      element.redrawLabelText();
      
    }
    
    if ( element.focused() ) {
      graph.options().focuserModule().handle(element, true); // unfocus
      graph.options().focuserModule().handle(element, true); // focus
    }
    // graph.options().focuserModule().handle(undefined);
    
    
    d3.select("#element_iriEditor").node().value = prefixModule.getPrefixRepresentationForFullURI(url);
    editSidebar.updateSelectionInformation(element);
  }
  
  function validURL( str ){
    const urlregex = /^(https?|ftp):\/\/([a-zA-Z0-9.-]+(:[a-zA-Z0-9.&%$-]+)*@)*((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}|([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.(com|edu|gov|int|mil|net|org|biz|arpa|info|name|pro|aero|coop|museum|[a-zA-Z]{2}))(:[0-9]+)*(\/($|[a-zA-Z0-9.,?'\\+&%$#=~_-]+))*$/;
    return urlregex.test(str);
  }
  
  
  function changeLabelForElement( element ){
    element.label(d3.select("#element_labelEditor").node().value);
    element.redrawLabelText();
  }
  
  editSidebar.updateEditDeleteButtonIds = function ( oldPrefix, newPrefix ){
    d3.select("#prefixInputFor_" + oldPrefix).node().id = "prefixInputFor_" + newPrefix;
    d3.select("#prefixURLFor_" + oldPrefix).node().id = "prefixURLFor_" + newPrefix;
    d3.select("#deleteButtonFor_" + oldPrefix).node().id = "deleteButtonFor_" + newPrefix;
    d3.select("#editButtonFor_" + oldPrefix).node().id = "editButtonFor_" + newPrefix;
    
    d3.select("#prefixContainerFor_" + oldPrefix).node().id = "prefixContainerFor_" + newPrefix;
  };
  
  editSidebar.checkForExistingURL = function ( url ){
    let i;
    const allProps = graph.getUnfilteredData().properties;
    for ( i = 0; i < allProps.length; i++ ) {
      if ( allProps[i].iri() === url ) {return true;}
    }
    return false;
    
  };
  editSidebar.checkProperIriChange = function ( element, url ){
    console.warn("Element changed Label");
    console.warn("Testing URL " + url);
    if ( element.type() === "rdfs:subClassOf" || element.type() === "owl:disjointWith" ) {
      console.warn("ignore this for now, already handled in the type and domain range changer");
    } else {
      let i;
      const allProps = graph.getUnfilteredData().properties;
      for ( i = 0; i < allProps.length; i++ ) {
        if ( allProps[i] === element ) {continue;}
        if ( allProps[i].iri() === url ) {return allProps[i];}
      }
    }
    return false;
  };
  
  editSidebar.updateSelectionInformation = function ( element ){
    
    if ( element === undefined ) {
      // show hint;
      d3.select("#selectedElementProperties").classed("hidden", true);
      d3.select("#selectedElementPropertiesEmptyHint").classed("hidden", false);
      selectedElementForCharacteristics = null;
      editSidebar.updateElementWidth();
    }
    else {
      d3.select("#selectedElementProperties").classed("hidden", false);
      d3.select("#selectedElementPropertiesEmptyHint").classed("hidden", true);
      d3.select("#typeEditForm_datatype").classed("hidden", true);
      
      // set the element IRI, and labels
      d3.select("#element_iriEditor").node().value = element.iri();
      d3.select("#element_labelEditor").node().value = element.labelForCurrentLanguage();
      d3.select("#element_iriEditor").node().title = element.iri();
      
      d3.select("#element_iriEditor")
        .on("change", function (){
          const elementIRI = element.iri();
          const prefixed = graph.options().prefixModule().getPrefixRepresentationForFullURI(elementIRI);
          if ( prefixed === d3.select("#element_iriEditor").node().value ) {
            console.warn("Iri is identical, nothing has changed!");
            return;
          }
          
          changeIriForElement(element);
        })
        .on("keydown", function (event){
          event.stopPropagation();
          if ( event.keyCode === 13 ) {
            event.preventDefault();
            console.warn("IRI CHANGED Via ENTER pressed");
            changeIriForElement(element);
            d3.select("#element_iriEditor").node().title = element.iri();
          }
        });
      
      const forceIRISync = defaultIriValue(element);
      d3.select("#element_labelEditor")
        .on("change", function (){
          let sanityCheckResult;
          console.warn("Element changed Label");
          const url = getURLFROMPrefixedVersion(element);
          if ( element.iri() !== url ) {
            if ( elementTools.isProperty(element) === true ) {
              sanityCheckResult = editSidebar.checkProperIriChange(element, url);
              if ( sanityCheckResult !== false ) {
                graph.options().warningModule().showWarning("Already seen this property",
                  "Input IRI: " + url + " for element: " + element.labelForCurrentLanguage() + " already been set",
                  "Continuing with duplicate property!", 1, false, sanityCheckResult);
                editSidebar.updateSelectionInformation(element);
                return;
              }
            }
            
            if ( elementTools.isNode(element) === true ) {
              sanityCheckResult = graph.checkIfIriClassAlreadyExist(url);
              if ( sanityCheckResult !== false ) {
                graph.options().warningModule().showWarning("Already seen this Class",
                  "Input IRI: " + url + " for element: " + element.labelForCurrentLanguage() + " already been set",
                  "Restoring previous IRI for Element : " + element.iri(), 2, false, sanityCheckResult);
                
                editSidebar.updateSelectionInformation(element);
                return;
              }
            }
            element.iri(url);
          }
          changeLabelForElement(element);
          editSidebar.updateSelectionInformation(element); // prevents that it will be changed if node is still active
        })
        .on("keydown", function (event){
          event.stopPropagation();
          if ( event.keyCode === 13 ) {
            event.preventDefault();
            let sanityCheckResult;
            console.warn("Element changed Label");
            const url = getURLFROMPrefixedVersion(element);
            if ( element.iri() !== url ) {
              if ( elementTools.isProperty(element) === true ) {
                sanityCheckResult = editSidebar.checkProperIriChange(element, url);
                if ( sanityCheckResult !== false ) {
                  graph.options().warningModule().showWarning("Already seen this property",
                    "Input IRI: " + url + " for element: " + element.labelForCurrentLanguage() + " already been set",
                    "Continuing with duplicate property!", 1, false, sanityCheckResult);
                  
                  editSidebar.updateSelectionInformation(element);
                  return;
                }
              }
              
              if ( elementTools.isNode(element) === true ) {
                sanityCheckResult = graph.checkIfIriClassAlreadyExist(url);
                if ( sanityCheckResult !== false ) {
                  graph.options().warningModule().showWarning("Already seen this Class",
                    "Input IRI: " + url + " for element: " + element.labelForCurrentLanguage() + " already been set",
                    "Restoring previous IRI for Element : " + element.iri(), 2, false, sanityCheckResult);
                  
                  editSidebar.updateSelectionInformation(element);
                  return;
                }
              }
              element.iri(url);
            }
            changeLabelForElement(element);
          }
        })
        .on("keyup", function (){
          if ( forceIRISync ) {
            const labelName = d3.select("#element_labelEditor").node().value;
            const resourceName = labelName.replaceAll(" ", "_");
            const syncedIRI = element.baseIri() + resourceName;
            
            //element.iri(syncedIRI);
            d3.select("#element_iriEditor").node().title = element.iri();
            d3.select("#element_iriEditor").node().value = prefixModule.getPrefixRepresentationForFullURI(syncedIRI);
          }
        });
      // check if we are allowed to change IRI OR LABEL
      d3.select("#element_iriEditor").node().disabled = false;
      d3.select("#element_labelEditor").node().disabled = false;
      
      if ( element.type() === "rdfs:subClassOf" ) {
        d3.select("#element_iriEditor").node().value = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
        d3.select("#element_iriEditor").node().title = "http://www.w3.org/2000/01/rdf-schema#subClassOf";
        d3.select("#element_labelEditor").node().value = "Subclass of";
        d3.select("#element_iriEditor").node().disabled = true;
        d3.select("#element_labelEditor").node().disabled = true;
      }
      if ( element.type() === "owl:Thing" ) {
        d3.select("#element_iriEditor").node().value = "http://www.w3.org/2002/07/owl#Thing";
        d3.select("#element_iriEditor").node().title = "http://www.w3.org/2002/07/owl#Thing";
        d3.select("#element_labelEditor").node().value = "Thing";
        d3.select("#element_iriEditor").node().disabled = true;
        d3.select("#element_labelEditor").node().disabled = true;
      }
      
      if ( element.type() === "owl:disjointWith" ) {
        d3.select("#element_iriEditor").node().value = "http://www.w3.org/2002/07/owl#disjointWith";
        d3.select("#element_iriEditor").node().title = "http://www.w3.org/2002/07/owl#disjointWith";
        d3.select("#element_iriEditor").node().disabled = true;
        d3.select("#element_labelEditor").node().disabled = true;
      }
      
      if ( element.type() === "rdfs:Literal" ) {
        d3.select("#element_iriEditor").node().value = "http://www.w3.org/2000/01/rdf-schema#Literal";
        d3.select("#element_iriEditor").node().title = "http://www.w3.org/2000/01/rdf-schema#Literal";
        d3.select("#element_iriEditor").node().disabled = true;
        d3.select("#element_labelEditor").node().disabled = true;
        element.iri("http://www.w3.org/2000/01/rdf-schema#Literal");
      }
      if ( element.type() === "rdfs:Datatype" ) {
        const datatypeEditorSelection = d3.select("#typeEditor_datatype");
        d3.select("#typeEditForm_datatype").classed("hidden", false);
        element.iri("http://www.w3.org/2000/01/rdf-schema#Datatype");
        d3.select("#element_iriEditor").node().value = "http://www.w3.org/2000/01/rdf-schema#Datatype";
        d3.select("#element_iriEditor").node().title = "http://www.w3.org/2000/01/rdf-schema#Datatype";
        d3.select("#element_iriEditor").node().disabled = true;
        d3.select("#element_labelEditor").node().disabled = true;
        
        datatypeEditorSelection.node().value = element.dType();
        if ( datatypeEditorSelection.node().value === "undefined" ) {
          d3.select("#element_iriEditor").node().disabled = true; // always prevent IRI modifications
          d3.select("#element_labelEditor").node().disabled = false;
        }
        // reconnect the element
        datatypeEditorSelection.on("change", function (){
          changeDatatypeType(element);
        });
      }
      
      // add type selector
      const typeEditorSelection = d3.select("#typeEditor").node();
      const htmlCollection = typeEditorSelection.children;
      const numEntries = htmlCollection.length;
      let i;
      const elementPrototypes = getElementPrototypes(element);
      for ( i = 0; i < numEntries; i++ )
        {typeEditorSelection.removeChild(htmlCollection[0]);}
      
      for ( i = 0; i < elementPrototypes.length; i++ ) {
        const optA = document.createElement('option');
        optA.innerHTML = elementPrototypes[i];
        typeEditorSelection.appendChild(optA);
      }
      // set the proper value in the selection
      typeEditorSelection.value = element.type();
      d3.select("#typeEditor").on("change", function (){
        elementTypeSelectionChanged(element);
      });
      
      
      // add characteristics selection
      const needChar = elementNeedsCharacteristics(element);
      d3.select("#property_characteristics_Container").classed("hidden", !needChar);
      if ( needChar === true ) {
        addElementsCharacteristics(element);
      }
      const fullURI = d3.select("#element_iriEditor").node().value;
      d3.select("#element_iriEditor").node().value = prefixModule.getPrefixRepresentationForFullURI(fullURI);
      d3.select("#element_iriEditor").node().title = fullURI;
      editSidebar.updateElementWidth();
    }
    
  };
  
  editSidebar.updateGeneralOntologyInfo = function (){
    const preferredLanguage = graph && graph.language ? graph.language() : null;
    
    // get it from graph.options
    const generalMetaObj = graph.options().getGeneralMetaObject();
    if ( Object.prototype.hasOwnProperty.call(generalMetaObj, "title") ) {
      // title has language to it -.-
      if ( typeof generalMetaObj.title === "object" ) {
        d3.select("#titleEditor").node().value = languageTools.textInLanguage(generalMetaObj.title, preferredLanguage);
      } else
        {d3.select("#titleEditor").node().value = generalMetaObj.title;}
    }
    if ( Object.prototype.hasOwnProperty.call(generalMetaObj, "iri") ) {d3.select("#iriEditor").node().value = generalMetaObj.iri;}
    if ( Object.prototype.hasOwnProperty.call(generalMetaObj, "version") ) {d3.select("#versionEditor").node().value = generalMetaObj.version;}
    if ( Object.prototype.hasOwnProperty.call(generalMetaObj, "author") ) {d3.select("#authorsEditor").node().value = generalMetaObj.author;}
    
    
    if ( Object.prototype.hasOwnProperty.call(generalMetaObj, "description") ) {
      
      if ( typeof generalMetaObj.description === "object" )
        {d3.select("#descriptionEditor").node().value =
          languageTools.textInLanguage(generalMetaObj.description, preferredLanguage);}
      else
        {d3.select("#descriptionEditor").node().value = generalMetaObj.description;}
    }
    else
      {d3.select("#descriptionEditor").node().value = "No Description";}
  };
  
  editSidebar.updateElementWidth = function (){
  };
  
  function addElementsCharacteristics( element ){
    // save selected element for checkbox handler
    selectedElementForCharacteristics = element;
    let i;
    // KILL old elements
    const charSelectionNode = d3.select("#property_characteristics_Selection");
    const htmlCollection = charSelectionNode.node().children;
    if ( htmlCollection ) {
      const numEntries = htmlCollection.length;
      for ( let q = 0; q < numEntries; q++ ) {
        charSelectionNode.node().removeChild(htmlCollection[0]);
      }
    }
    // datatypes kind of ignored by the elementsNeedCharacteristics function
    // so we need to check if we are a node or not
    if ( element.attributes().indexOf("external") > -1 ) {
      // add external span to the div;
      const externalCharSpan = charSelectionNode.append("span");
      externalCharSpan.classed("spanForCharSelection", true);
      externalCharSpan.node().innerHTML = "external";
    }
    let filterContainer,
      filterCheckbox;
    if ( elementTools.isNode(element) === true ) {
      // add the deprecated characteristic;
      const arrayOfNodeChars = ["deprecated"];
      for ( i = 0; i < arrayOfNodeChars.length; i++ ) {
        filterContainer = charSelectionNode
          .append("div")
          .classed("checkboxContainer warning-row", true);
        
        filterCheckbox = filterContainer.append("input")
          .classed("filterCheckbox", true)
          .attr("id", "CharacteristicsCheckbox" + i)
          .attr("type", "checkbox")
          .attr("characteristics", arrayOfNodeChars[i])
          .property("checked", getPresentAttribute(element, arrayOfNodeChars[i]));
        
        filterContainer.append("label")
          .attr("for", "CharacteristicsCheckbox" + i)
          .text(arrayOfNodeChars[i]);
        
        filterCheckbox.on("click", handleCheckBoxClick);
        
      }
    }
    
    else {
      // add the deprecated characteristic;
      let arrayOfPropertyChars = ["deprecated", "inverse functional", "functional", "transitive"];
      if ( elementTools.isDatatypeProperty(element) === true ) {
        arrayOfPropertyChars = ["deprecated", "functional"];
      }
      for ( i = 0; i < arrayOfPropertyChars.length; i++ ) {
        filterContainer = charSelectionNode
          .append("div")
          .classed("checkboxContainer warning-row", true);
        
        filterCheckbox = filterContainer.append("input")
          .classed("filterCheckbox", true)
          .attr("id", "CharacteristicsCheckbox" + i)
          .attr("type", "checkbox")
          .attr("characteristics", arrayOfPropertyChars[i])
          .property("checked", getPresentAttribute(element, arrayOfPropertyChars[i]));
        //
        filterContainer.append("label")
          .attr("for", "CharacteristicsCheckbox" + i)
          .text(arrayOfPropertyChars[i]);
        
        filterCheckbox.on("click", handleCheckBoxClick);
        
      }
    }
    
    
  }
  
  function getPresentAttribute( selectedElement, element ){
    return (selectedElement.attributes().indexOf(element) >= 0);
  }
  
  function handleCheckBoxClick(){
    const checked = this.checked;
    const char = this.getAttribute("characteristics");
    if ( checked === true ) {
      addAttribute(selectedElementForCharacteristics, char);
    } else {
      removeAttribute(selectedElementForCharacteristics, char);
    }
    // graph.executeColorExternalsModule();
    selectedElementForCharacteristics.redrawElement();
    // workaround to have the node still be focused as rendering element
    selectedElementForCharacteristics.focused(false);
    selectedElementForCharacteristics.toggleFocus();
    
  }
  
  
  function addAttribute( selectedElement, char ){
    if ( selectedElement.attributes().indexOf(char) === -1 ) {
      // not found add it
      const attr = selectedElement.attributes();
      attr.push(char);
      selectedElement.attributes(attr);
    }// indications string update;
    if ( selectedElement.indications().indexOf(char) === -1 ) {
      const indications = selectedElement.indications();
      indications.push(char);
      selectedElement.indications(indications);
    }
    // add visual attributes
    let visAttr;
    if ( selectedElement.visualAttributes().indexOf(char) === -1 ) {
      visAttr = selectedElement.visualAttributes();
      visAttr.push(char);
      selectedElement.visualAttributes(visAttr);
    }
    if ( getPresentAttribute(selectedElement, "external") && getPresentAttribute(selectedElement, "deprecated") ) {
      visAttr = selectedElement.visualAttributes();
      const visInd = visAttr.indexOf("external");
      if ( visInd > -1 ) {
        visAttr.splice(visInd, 1);
      }
      selectedElement.visualAttributes(visAttr);
    }
    
  }
  
  function removeAttribute( selectedElement, element ){
    const attr = selectedElement.attributes();
    const indications = selectedElement.indications();
    const visAttr = selectedElement.visualAttributes();
    const attrInd = attr.indexOf(element);
    if ( attrInd >= 0 ) {
      attr.splice(attrInd, 1);
    }
    const indInd = indications.indexOf(element);
    if ( indInd > -1 ) {
      indications.splice(indInd, 1);
    }
    const visInd = visAttr.indexOf(element);
    if ( visInd > -1 ) {
      visAttr.splice(visInd, 1);
    }
    selectedElement.attributes(attr);
    selectedElement.indications(indications);
    selectedElement.visualAttributes(visAttr);
    if ( element === "deprecated" ) {
      // set its to its original Style
      //typeBaseThign
      // todo : fix all different types
      if ( selectedElement.type() === "owl:Class" ) {selectedElement.styleClass("class");}
      if ( selectedElement.type() === "owl:DatatypeProperty" ) {selectedElement.styleClass("datatypeproperty");}
      if ( selectedElement.type() === "owl:ObjectProperty" ) {selectedElement.styleClass("objectproperty");}
      if ( selectedElement.type() === "owl:disjointWith" ) {selectedElement.styleClass("disjointwith");}
    }
  }
  
  
  function elementNeedsCharacteristics( element ){
    //TODO: Add more types
    if ( element.type() === "owl:Thing" ||
      element.type() === "rdfs:subClassOf" ||
      element.type() === "rdfs:Literal" ||
      element.type() === "rdfs:Datatype" ||
      element.type() === "rdfs:disjointWith" )
      {return false;}
    
    // if (element.attributes().indexOf("external")||
    //     element.attributes().indexOf("deprecated"))
    //     return true;
    return true;
    
  }
  
  function elementTypeSelectionChanged( element ){
    if ( elementTools.isNode(element) ) {
      if ( graph.changeNodeType(element) === false ) {
        //restore old value
        editSidebar.updateSelectionInformation(element);
      }
    }
    
    if ( elementTools.isProperty(element) ) {
      if ( graph.changePropertyType(element) === false ) {
        //restore old value
        editSidebar.updateSelectionInformation(element);
        
      }
    }
    
  }
  
  function getElementPrototypes( selectedElement ){
    const availiblePrototypes = [];
    // TODO the text should be also complied with the prefixes loaded into the ontology
    if ( elementTools.isProperty(selectedElement) ) {
      if ( selectedElement.type() === "owl:DatatypeProperty" )
        {availiblePrototypes.push("owl:DatatypeProperty");}
      else {
        availiblePrototypes.push("owl:ObjectProperty");
        // handling loops !
        if ( selectedElement.domain() !== selectedElement.range() ) {
          availiblePrototypes.push("rdfs:subClassOf");
        }
        availiblePrototypes.push("owl:disjointWith");
        availiblePrototypes.push("owl:allValuesFrom");
        availiblePrototypes.push("owl:someValuesFrom");
      }
      return availiblePrototypes;
    }
    if ( selectedElement.renderType() === "rect" ) {
      availiblePrototypes.push("rdfs:Literal");
      availiblePrototypes.push("rdfs:Datatype");
    } else {
      availiblePrototypes.push("owl:Class");
      availiblePrototypes.push("owl:Thing");
      //  TODO: ADD MORE TYPES
      // availiblePrototypes.push("owl:complementOf");
      // availiblePrototypes.push("owl:disjointUnionOf");
    }
    return availiblePrototypes;
  }
  
  
  function setupCollapsing(){
    // TODO : Decision , for now I want to have the control over the collapse expand operation of the
    // TODO : elements, otherwise the old approach will also randomly collapse other containers
    
    // adapted version of this example: http://www.normansblog.de/simple-jquery-accordion/
    function collapseContainers( containers ){
      containers.classed("hidden", true);
    }
    
    function expandContainers( containers ){
      containers.classed("hidden", false);
    }
    
    const triggers = d3.selectAll(".accordion-trigger");
    
    triggers.attr("tabindex", "0").attr("role", "button");
    triggers.on("keydown", function (event){
      const evt = event || window.event;
      if ( evt && (evt.key === "Enter" || evt.key === " ") ) {
        evt.preventDefault();
        d3.select(this).node().click();
      }
    });
    
    triggers.on("click", function (){
      const selectedTrigger = d3.select(this);
      if ( selectedTrigger.classed("accordion-trigger-active") ) {
        // Collapse the active (which is also the selected) trigger
        collapseContainers(d3.select(selectedTrigger.node().nextElementSibling));
        selectedTrigger.classed("accordion-trigger-active", false);
      } else {
        // Collapse the other trigger ...
        // collapseContainers(d3.selectAll(".accordion-trigger-active + div"));
        
        // ... and expand the selected one
        expandContainers(d3.select(selectedTrigger.node().nextElementSibling));
        selectedTrigger.classed("accordion-trigger-active", true);
      }
      editSidebar.updateElementWidth();
    });
  }
  
  return editSidebar;
};

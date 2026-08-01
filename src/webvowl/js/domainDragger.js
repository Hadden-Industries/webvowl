module.exports = function ( graph ){
  /** variable defs **/
  const Domain_dragger = {};
  Domain_dragger.nodeId = 10002;
  Domain_dragger.parent = undefined;
  Domain_dragger.x = 0;
  Domain_dragger.y = 0;
  Domain_dragger.rootElement = undefined;
  Domain_dragger.rootNodeLayer = undefined;
  Domain_dragger.pathLayer = undefined;
  Domain_dragger.mouseEnteredVar = false;
  Domain_dragger.mouseButtonPressed = false;
  Domain_dragger.nodeElement = undefined;
  Domain_dragger.draggerObject = undefined;
  
  Domain_dragger.pathElement = undefined;
  Domain_dragger.typus = "Domain_dragger";
  
  Domain_dragger.type = function (){
    return Domain_dragger.typus;
  };
  
  
  // TODO: We need the endPoint of the Link here!
  Domain_dragger.parentNode = function (){
    return Domain_dragger.parent;
  };
  
  Domain_dragger.hide_dragger = function ( val ){
    Domain_dragger.pathElement.classed("hidden", val);
    Domain_dragger.nodeElement.classed("hidden", val);
    Domain_dragger.draggerObject.classed("hidden", val);
  };
  
  Domain_dragger.reDrawEverthing = function (){
    Domain_dragger.setParentProperty(Domain_dragger.parent);
  };
  Domain_dragger.updateDomain = function ( newDomain ){
    
    if ( graph.genericPropertySanityCheck(Domain_dragger.parent.range(), newDomain, Domain_dragger.parent.type(),
        "Could not update domain", "Restoring previous domain") === false ) {
      Domain_dragger.updateElement();
      return;
    }
    
    if ( graph.propertyCheckExistenceChecker(Domain_dragger.parent, newDomain, Domain_dragger.parent.range()) === false )
      {return;}
    
    
    if ( Domain_dragger.parent.labelElement() === undefined ) {
      Domain_dragger.updateElement();
      return;
    }
    if ( Domain_dragger.parent.labelElement().attr("transform") === "translate(0,15)" ||
      Domain_dragger.parent.labelElement().attr("transform") === "translate(0,-15)" ) {
      const prop = Domain_dragger.parent;
      Domain_dragger.parent.inverse().inverse(null);
      Domain_dragger.parent.inverse(null);
      console.warn("SPLITTING ITEMS!");
      prop.domain(newDomain);
    }
    else {
      Domain_dragger.parent.domain(newDomain);
    }
    
    // update the position of the new range
    const rX = Domain_dragger.parent.range().x;
    const rY = Domain_dragger.parent.range().y;
    const dX = newDomain.x;
    const dY = newDomain.y;
    
    // center
    const cX = 0.49 * (dX + rX);
    const cY = 0.49 * (dY + rY);
    // put position there;
    Domain_dragger.parent.labelObject().x = cX;
    Domain_dragger.parent.labelObject().px = cX;
    Domain_dragger.parent.labelObject().y = cY;
    Domain_dragger.parent.labelObject().py = cY;
    Domain_dragger.updateElement();
    
  };
  
  Domain_dragger.setParentProperty = function ( parentProperty, inverted ){
    Domain_dragger.invertedProperty = inverted;
    let iP;
    Domain_dragger.isLoopProperty = false;
    if ( parentProperty.domain() === parentProperty.range() )
      {Domain_dragger.isLoopProperty = true;}
    
    Domain_dragger.parent = parentProperty;
    const renElem = parentProperty.labelObject();
    if ( inverted === true ) {
      
      // this is the lower element
      if ( parentProperty.labelElement() && parentProperty.labelElement().attr("transform") === "translate(0,15)" ) {
        // console.log("This is the lower element!");
        iP = renElem.linkRangeIntersection;
        if ( renElem.linkRangeIntersection ) {
          Domain_dragger.x = iP.x;
          Domain_dragger.y = iP.y;
        }
      }
      else {
        // console.log("This is the upper  element");
        iP = renElem.linkDomainIntersection;
        if ( renElem.linkDomainIntersection ) {
          Domain_dragger.x = iP.x;
          Domain_dragger.y = iP.y;
        }
      }
    }
    else {
      // console.log("This is single element");
      iP = renElem.linkDomainIntersection;
      if ( renElem.linkDomainIntersection ) {
        Domain_dragger.x = iP.x;
        Domain_dragger.y = iP.y;
      }
    }
    Domain_dragger.updateElement();
    
  };
  
  Domain_dragger.hideDragger = function ( val ){
    if ( Domain_dragger.pathElement ) {Domain_dragger.pathElement.classed("hidden", val);}
    if ( Domain_dragger.nodeElement ) {Domain_dragger.nodeElement.classed("hidden", val);}
    if ( Domain_dragger.draggerObject ) {Domain_dragger.draggerObject.classed("hidden", val);}
    
    
  };
  /** BASE HANDLING FUNCTIONS ------------------------------------------------- **/
  Domain_dragger.id = function ( index ){
    if ( !arguments.length ) {
      return Domain_dragger.nodeId;
    }
    Domain_dragger.nodeId = index;
  };
  
  Domain_dragger.svgPathLayer = function ( layer ){
    Domain_dragger.pathLayer = layer.append('g');
  };
  
  Domain_dragger.svgRoot = function ( root ){
    if ( !arguments.length )
      {return Domain_dragger.rootElement;}
    Domain_dragger.rootElement = root;
    Domain_dragger.rootNodeLayer = Domain_dragger.rootElement.append('g');
    Domain_dragger.addMouseEvents();
  };
  
  /** DRAWING FUNCTIONS ------------------------------------------------- **/
  Domain_dragger.drawNode = function (){
    Domain_dragger.pathElement = Domain_dragger.pathLayer.append('line')
      .classed("classNodeDragPath", true);
    Domain_dragger.pathElement.attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 0)
      .attr("y2", 0);
    
    const pathData = "M 10,40 C -10,15 -10,-15 10,-40 -8.8233455,-13.641384 -36.711107,-5.1228436 -50,0 -36.696429,4.9079017 -8.6403157,13.745728 10,40 Z";
    Domain_dragger.nodeElement = Domain_dragger.rootNodeLayer.append('path').attr("d", pathData);
    Domain_dragger.nodeElement.classed("classDraggerNode", true);
    if ( graph.options().useAccuracyHelper() ) {
      Domain_dragger.draggerObject = Domain_dragger.rootNodeLayer.append("circle");
      Domain_dragger.draggerObject.attr("r", 40)
        .attr("cx", 0)
        .attr("cy", 0)
        .classed("superHiddenElement", true);
      Domain_dragger.draggerObject.classed("superOpacityElement", !graph.options().showDraggerObject());
    }
    
    
  };
  Domain_dragger.updateElementViaRangeDragger = function ( x, y ){
    const range_x = x;
    const range_y = y;
    
    const dex = Domain_dragger.parent.domain().x;
    const dey = Domain_dragger.parent.domain().y;
    
    const dir_X = x - dex;
    const dir_Y = y - dey;
    
    const len = Math.sqrt(dir_X * dir_X + dir_Y * dir_Y);
    
    const nX = dir_X / len;
    const nY = dir_Y / len;
    
    
    const ep_range_x = dex + nX * Domain_dragger.parent.domain().actualRadius();
    const ep_range_y = dey + nY * Domain_dragger.parent.domain().actualRadius();
    
    const angle = Math.atan2(ep_range_y - range_y, ep_range_x - range_x) * 180 / Math.PI;
    
    Domain_dragger.nodeElement.attr("transform", "translate(" + ep_range_x + "," + ep_range_y + ")" + "rotate(" + angle + ")");
    const dox = ep_range_x + nX * 20;
    const doy = ep_range_y + nY * 20;
    Domain_dragger.draggerObject.attr("transform", "translate(" + dox + "," + doy + ")");
  };
  
  
  Domain_dragger.updateElement = function (){
    if ( Domain_dragger.mouseButtonPressed === true || Domain_dragger.parent === undefined ) {return;}
    
    const domain = Domain_dragger.parent.domain();
    let iP = Domain_dragger.parent.labelObject().linkDomainIntersection;
    if ( Domain_dragger.parent.labelElement() === undefined ) {return;}
    if ( Domain_dragger.parent.labelElement().attr("transform") === "translate(0,15)" ) {
      Domain_dragger.parent.inverse().domain();
      iP = Domain_dragger.parent.labelObject().linkRangeIntersection;
      
    }
    const range_x = domain.x;
    const range_y = domain.y;
    
    
    if ( iP === undefined ) {return;}
    const ep_range_x = iP.x;
    const ep_range_y = iP.y;
    
    const dx = range_x - ep_range_x;
    const dy = range_y - ep_range_y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    const nX = dx / len;
    const nY = dy / len;
    
    const dox = ep_range_x - nX * 20;
    const doy = ep_range_y - nY * 20;
    const angle = Math.atan2(ep_range_y - range_y, ep_range_x - range_x) * 180 / Math.PI + 180;
    
    Domain_dragger.nodeElement.attr("transform", "translate(" + ep_range_x + "," + ep_range_y + ")" + "rotate(" + angle + ")");
    Domain_dragger.draggerObject.attr("transform", "translate(" + dox + "," + doy + ")");
  };
  
  /** MOUSE HANDLING FUNCTIONS ------------------------------------------------- **/
  
  Domain_dragger.addMouseEvents = function (){
    const rootLayer = Domain_dragger.rootNodeLayer.selectAll("*");
    rootLayer.on("mouseover", Domain_dragger.onMouseOver)
      .on("mouseout", Domain_dragger.onMouseOut)
      .on("click", function (){
      })
      .on("dblclick", function (){
      })
      .on("mousedown", Domain_dragger.mouseDown)
      .on("mouseup", Domain_dragger.mouseUp);
  };
  
  Domain_dragger.mouseDown = function (){
    Domain_dragger.nodeElement.classed("is-dragging", true);
    Domain_dragger.nodeElement.classed("classDraggerNodeHovered", true);
    Domain_dragger.mouseButtonPressed = true;
  };
  
  Domain_dragger.mouseUp = function (){
    Domain_dragger.nodeElement.classed("is-dragging", false);
    Domain_dragger.nodeElement.classed("classDraggerNodeHovered", false);
    Domain_dragger.mouseButtonPressed = false;
  };
  
  
  Domain_dragger.mouseEntered = function ( p ){
    if ( !arguments.length ) {return Domain_dragger.mouseEnteredVar;}
    Domain_dragger.mouseEnteredVar = p;
    return Domain_dragger;
  };
  
  Domain_dragger.selectedViaTouch = function ( val ){
    Domain_dragger.nodeElement.classed("classDraggerNode", !val);
    Domain_dragger.nodeElement.classed("classDraggerNodeHovered", val);
    
  };
  
  Domain_dragger.onMouseOver = function (){
    if ( Domain_dragger.mouseEntered() ) {
      return;
    }
    Domain_dragger.nodeElement.classed("classDraggerNode", false);
    Domain_dragger.nodeElement.classed("classDraggerNodeHovered", true);
    const selectedNode = Domain_dragger.rootElement.node(),
      nodeContainer = selectedNode.parentNode;
    nodeContainer.appendChild(selectedNode);
    
    Domain_dragger.mouseEntered(true);
    
  };
  Domain_dragger.onMouseOut = function (){
    if ( Domain_dragger.mouseButtonPressed === true )
      {return;}
    Domain_dragger.nodeElement.classed("classDraggerNodeHovered", false);
    Domain_dragger.nodeElement.classed("classDraggerNode", true);
    Domain_dragger.mouseEntered(false);
  };
  
  Domain_dragger.setPosition = function ( x, y ){
    const range_x = Domain_dragger.parent.range().x;
    const range_y = Domain_dragger.parent.range().y;
    
    // var position of the rangeEndPoint
    const ep_range_x = x;
    const ep_range_y = y;
    
    // offset for dragger object
    const dx = range_x - ep_range_x;
    const dy = range_y - ep_range_y;
    
    const len = Math.sqrt(dx * dx + dy * dy);
    
    const nX = dx / len;
    const nY = dy / len;
    const dox = ep_range_x + nX * 20;
    const doy = ep_range_y + nY * 20;
    
    const angle = Math.atan2(range_y - ep_range_y, range_x - ep_range_x) * 180 / Math.PI + 180;
    
    Domain_dragger.nodeElement.attr("transform", "translate(" + ep_range_x + "," + ep_range_y + ")" + "rotate(" + angle + ")");
    Domain_dragger.draggerObject.attr("transform", "translate(" + dox + "," + doy + ")");
    
    Domain_dragger.x = x;
    Domain_dragger.y = y;
    
  };
  
  Domain_dragger.setAdditionalClassForClass_dragger = function ( name, val ){
    // console.log("Class_dragger should sett the class here")
    // Class_dragger.nodeElement.classed(name,val);
    
  };
  return Domain_dragger;
};


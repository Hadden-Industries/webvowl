const elementTools = require("../util/elementTools")();

module.exports = function (){
  const collapsing = {};
  let enabled = false;
  let filteredNodes;
  let filteredProperties;
  
  collapsing.filter = function ( nodes, properties ){
    // Nothing is filtered, we just need to draw everywehere
    filteredNodes = nodes;
    filteredProperties = properties;
    
    
    let i, l, node;
    
    for ( i = 0, l = nodes.length; i < l; i++ ) {
      node = nodes[i];
      if ( !elementTools.isDatatype(node) ) {
        node.collapsible(enabled);
      }
    }
  };
  
  collapsing.enabled = function ( p ){
    if ( !arguments.length ) {return enabled;}
    enabled = p;
    return collapsing;
  };
  
  collapsing.reset = function (){
    // todo
  };
  
  collapsing.filteredNodes = function (){
    return filteredNodes;
  };
  
  collapsing.filteredProperties = function (){
    return filteredProperties;
  };
  
  return collapsing;
};

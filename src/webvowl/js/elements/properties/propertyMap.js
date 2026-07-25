const properties = [];
properties.push(require("./implementations/OwlAllValuesFromProperty"));
properties.push(require("./implementations/OwlDatatypeProperty"));
properties.push(require("./implementations/OwlDeprecatedProperty"));
properties.push(require("./implementations/OwlDisjointWith"));
properties.push(require("./implementations/OwlEquivalentProperty"));
properties.push(require("./implementations/OwlFunctionalProperty"));
properties.push(require("./implementations/OwlInverseFunctionalProperty"));
properties.push(require("./implementations/OwlObjectProperty"));
properties.push(require("./implementations/OwlSomeValuesFromProperty"));
properties.push(require("./implementations/OwlSymmetricProperty"));
properties.push(require("./implementations/OwlTransitiveProperty"));
properties.push(require("./implementations/RdfProperty"));
properties.push(require("./implementations/RdfsSubClassOf"));
properties.push(require("./implementations/SetOperatorProperty"));

const map = new Map(properties.map(function ( Prototype ){
  return [new Prototype().type(), Prototype];
}));

module.exports = function (){
  return map;
};

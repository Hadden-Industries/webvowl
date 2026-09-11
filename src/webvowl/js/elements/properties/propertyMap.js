import { OwlAllValuesFromProperty } from "./implementations/OwlAllValuesFromProperty.js";
import { OwlDatatypeProperty } from "./implementations/OwlDatatypeProperty.js";
import { OwlDeprecatedProperty } from "./implementations/OwlDeprecatedProperty.js";
import { OwlDisjointWith } from "./implementations/OwlDisjointWith.js";
import { OwlEquivalentProperty } from "./implementations/OwlEquivalentProperty.js";
import { OwlFunctionalProperty } from "./implementations/OwlFunctionalProperty.js";
import { OwlInverseFunctionalProperty } from "./implementations/OwlInverseFunctionalProperty.js";
import { OwlObjectProperty } from "./implementations/OwlObjectProperty.js";
import { OwlSomeValuesFromProperty } from "./implementations/OwlSomeValuesFromProperty.js";
import { OwlSymmetricProperty } from "./implementations/OwlSymmetricProperty.js";
import { OwlTransitiveProperty } from "./implementations/OwlTransitiveProperty.js";
import { RdfProperty } from "./implementations/RdfProperty.js";
import { RdfsSubClassOf } from "./implementations/RdfsSubClassOf.js";
import { SetOperatorProperty } from "./implementations/SetOperatorProperty.js";
const properties = [];
properties.push(OwlAllValuesFromProperty);
properties.push(OwlDatatypeProperty);
properties.push(OwlDeprecatedProperty);
properties.push(OwlDisjointWith);
properties.push(OwlEquivalentProperty);
properties.push(OwlFunctionalProperty);
properties.push(OwlInverseFunctionalProperty);
properties.push(OwlObjectProperty);
properties.push(OwlSomeValuesFromProperty);
properties.push(OwlSymmetricProperty);
properties.push(OwlTransitiveProperty);
properties.push(RdfProperty);
properties.push(RdfsSubClassOf);
properties.push(SetOperatorProperty);

const map = new Map(
  properties.map(function (Prototype) {
    return [new Prototype().type(), Prototype];
  }),
);

export function createPropertyMap() {
  return map;
}

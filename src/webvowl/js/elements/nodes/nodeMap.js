import { ExternalClass } from "./implementations/ExternalClass.js";
import { OwlClass } from "./implementations/OwlClass.js";
import { OwlComplementOf } from "./implementations/OwlComplementOf.js";
import { OwlDeprecatedClass } from "./implementations/OwlDeprecatedClass.js";
import { OwlDisjointUnionOf } from "./implementations/OwlDisjointUnionOf.js";
import { OwlEquivalentClass } from "./implementations/OwlEquivalentClass.js";
import { OwlIntersectionOf } from "./implementations/OwlIntersectionOf.js";
import { OwlNothing } from "./implementations/OwlNothing.js";
import { OwlThing } from "./implementations/OwlThing.js";
import { OwlUnionOf } from "./implementations/OwlUnionOf.js";
import { RdfsClass } from "./implementations/RdfsClass.js";
import { RdfsDatatype } from "./implementations/RdfsDatatype.js";
import { RdfsLiteral } from "./implementations/RdfsLiteral.js";
import { RdfsResource } from "./implementations/RdfsResource.js";
const nodes = [];
nodes.push(ExternalClass);
nodes.push(OwlClass);
nodes.push(OwlComplementOf);
nodes.push(OwlDeprecatedClass);
nodes.push(OwlDisjointUnionOf);
nodes.push(OwlEquivalentClass);
nodes.push(OwlIntersectionOf);
nodes.push(OwlNothing);
nodes.push(OwlThing);
nodes.push(OwlUnionOf);
nodes.push(RdfsClass);
nodes.push(RdfsDatatype);
nodes.push(RdfsLiteral);
nodes.push(RdfsResource);

const map = new Map(
  nodes.map(function (Prototype) {
    return [new Prototype().type(), Prototype];
  }),
);

export function createNodeMap() {
  return map;
}

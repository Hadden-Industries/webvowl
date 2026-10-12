import { namespaces } from "vowl";
import { OwlThing } from "./OwlThing.js";

const OwlNothing = (function () {
  const o = function (graph) {
    OwlThing.apply(this, arguments);

    this.label("Nothing")
      .type("owl:Nothing")
      .iri(namespaces.owl + "Nothing");
  };
  o.prototype = Object.create(OwlThing.prototype);
  o.prototype.constructor = o;

  return o;
})();

export { OwlNothing };

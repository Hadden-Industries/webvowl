const OwlClass = require("../../../webvowl/js/elements/nodes/implementations/OwlClass");
const OwlThing = require("../../../webvowl/js/elements/nodes/implementations/OwlThing");
const ObjectProperty = require("../../../webvowl/js/elements/properties/implementations/OwlObjectProperty");
const DatatypeProperty = require("../../../webvowl/js/elements/properties/implementations/OwlDatatypeProperty");
const Link = require("../../../webvowl/js/elements/links/PlainLink");
const objectPropertyFilterFactory = require("./objectPropertyFilter");

describe("Filtering of object properties", () => {
  let filter;

  beforeEach(() => {
    filter = objectPropertyFilterFactory();
    filter.enabled(true);
  });

  test("should remove object properties", () => {
    const domain = new OwlClass();
    const range = new OwlClass();
    const objectProperty = new ObjectProperty();

    objectProperty.domain(domain).range(range);

    filter.filter([domain, range], [objectProperty]);

    expect(filter.filteredNodes()).toEqual([domain, range]);
    expect(filter.filteredProperties().length).toBe(0);
  });

  test("should remove things without any other properties", () => {
    const domain = new OwlThing();
    const range = new OwlThing();
    const objectProperty = new ObjectProperty();

    objectProperty.domain(domain).range(range);
    const objectPropertyLink = new Link(domain, range, objectProperty);
    domain.links([objectPropertyLink]);
    range.links([objectPropertyLink]);

    filter.filter([domain, range], [objectProperty]);

    expect(filter.filteredNodes().length).toBe(0);
    expect(filter.filteredProperties().length).toBe(0);
  });

  test("should keep things with any other properties", () => {
    const domain = new OwlClass();
    const range = new OwlThing();
    const objectProperty = new ObjectProperty();
    const datatypeProperty = new DatatypeProperty();

    objectProperty.domain(domain).range(range);
    datatypeProperty.domain(domain).range(range);
    const objectPropertyLink = new Link(domain, range, objectProperty);
    const datatypePropertyLink = new Link(domain, range, datatypeProperty);
    domain.links([objectPropertyLink, datatypePropertyLink]);
    range.links([objectPropertyLink, datatypePropertyLink]);

    filter.filter([domain, range], [objectProperty, datatypeProperty]);

    expect(filter.filteredNodes()).toEqual([domain, range]);
    expect(filter.filteredProperties()).toEqual([datatypeProperty]);
  });
});

import { beforeAll } from "@jest/globals";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

let OwlClass;
let OwlThing;
let ObjectProperty;
let DatatypeProperty;
let Link;
let objectPropertyFilterFactory;

beforeAll(async () => {
  ({ OwlClass } = await loadEsmModuleForTest(
    new URL(
      "../../../webvowl/js/elements/nodes/implementations/OwlClass.js",
      import.meta.url,
    ),
    import.meta.url,
  ));
  ({ OwlThing } = await loadEsmModuleForTest(
    new URL(
      "../../../webvowl/js/elements/nodes/implementations/OwlThing.js",
      import.meta.url,
    ),
    import.meta.url,
  ));
  ({ OwlObjectProperty: ObjectProperty } = await loadEsmModuleForTest(
    new URL(
      "../../../webvowl/js/elements/properties/implementations/OwlObjectProperty.js",
      import.meta.url,
    ),
    import.meta.url,
  ));
  ({ OwlDatatypeProperty: DatatypeProperty } = await loadEsmModuleForTest(
    new URL(
      "../../../webvowl/js/elements/properties/implementations/OwlDatatypeProperty.js",
      import.meta.url,
    ),
    import.meta.url,
  ));
  ({ PlainLink: Link } = await loadEsmModuleForTest(
    new URL("../../../webvowl/js/elements/links/PlainLink.js", import.meta.url),
    import.meta.url,
  ));
  ({ createObjectPropertyFilter: objectPropertyFilterFactory } =
    await loadEsmModuleForTest(
      new URL("./objectPropertyFilter.js", import.meta.url),
      import.meta.url,
    ));
});

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

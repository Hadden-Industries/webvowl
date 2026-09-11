import { beforeAll } from "@jest/globals";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

let OwlClass;
let OwlUnionOf;
let RdfsDatatype;
let DatatypeProperty;
let setOperatorFilterFactory;

beforeAll(async () => {
  ({ OwlClass } = await loadEsmModuleForTest(
    new URL(
      "../../../webvowl/js/elements/nodes/implementations/OwlClass.js",
      import.meta.url,
    ),
    import.meta.url,
  ));
  ({ OwlUnionOf } = await loadEsmModuleForTest(
    new URL(
      "../../../webvowl/js/elements/nodes/implementations/OwlUnionOf.js",
      import.meta.url,
    ),
    import.meta.url,
  ));
  ({ RdfsDatatype } = await loadEsmModuleForTest(
    new URL(
      "../../../webvowl/js/elements/nodes/implementations/RdfsDatatype.js",
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
  ({ createSetOperatorFilter: setOperatorFilterFactory } =
    await loadEsmModuleForTest(
      new URL("./setOperatorFilter.js", import.meta.url),
      import.meta.url,
    ));
});

describe("Filtering of set operators", () => {
  let filter;

  beforeEach(() => {
    filter = setOperatorFilterFactory();
    filter.enabled(true);
  });

  test("keeps a class range shared with a surviving datatype property", () => {
    const setOperator = new OwlUnionOf().id("setOperator");
    const visibleDomain = new OwlClass().id("visibleDomain");
    const sharedRange = new OwlClass().id("sharedRange");
    const removedProperty = new DatatypeProperty();
    const survivingProperty = new DatatypeProperty();

    removedProperty.domain(setOperator).range(sharedRange);
    survivingProperty.domain(visibleDomain).range(sharedRange);

    filter.filter(
      [setOperator, visibleDomain, sharedRange],
      [removedProperty, survivingProperty],
    );

    expect(filter.filteredNodes()).toEqual([visibleDomain, sharedRange]);
    expect(filter.filteredProperties()).toEqual([survivingProperty]);
  });

  test("keeps a class range used only by a filtered datatype property", () => {
    const setOperator = new OwlUnionOf().id("setOperator");
    const classRange = new OwlClass().id("classRange");
    const removedProperty = new DatatypeProperty();

    removedProperty.domain(setOperator).range(classRange);

    filter.filter([setOperator, classRange], [removedProperty]);

    expect(filter.filteredNodes()).toEqual([classRange]);
    expect(filter.filteredProperties()).toEqual([]);
  });

  test("keeps a datatype range shared with a surviving property", () => {
    const setOperator = new OwlUnionOf().id("setOperator");
    const visibleDomain = new OwlClass().id("visibleDomain");
    const sharedRange = new RdfsDatatype().id("sharedRange");
    const removedProperty = new DatatypeProperty();
    const survivingProperty = new DatatypeProperty();

    removedProperty.domain(setOperator).range(sharedRange);
    survivingProperty.domain(visibleDomain).range(sharedRange);

    filter.filter(
      [setOperator, visibleDomain, sharedRange],
      [removedProperty, survivingProperty],
    );

    expect(filter.filteredNodes()).toEqual([visibleDomain, sharedRange]);
    expect(filter.filteredProperties()).toEqual([survivingProperty]);
  });

  test("removes an unreferenced datatype range with its filtered property", () => {
    const setOperator = new OwlUnionOf().id("setOperator");
    const datatypeRange = new RdfsDatatype().id("datatypeRange");
    const removedProperty = new DatatypeProperty();

    removedProperty.domain(setOperator).range(datatypeRange);

    filter.filter([setOperator, datatypeRange], [removedProperty]);

    expect(filter.filteredNodes()).toEqual([]);
    expect(filter.filteredProperties()).toEqual([]);
  });
});

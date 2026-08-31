const OwlClass = require("../../../webvowl/js/elements/nodes/implementations/OwlClass");
const OwlUnionOf = require("../../../webvowl/js/elements/nodes/implementations/OwlUnionOf");
const RdfsDatatype = require("../../../webvowl/js/elements/nodes/implementations/RdfsDatatype");
const DatatypeProperty = require("../../../webvowl/js/elements/properties/implementations/OwlDatatypeProperty");
const setOperatorFilterFactory = require("./setOperatorFilter");

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

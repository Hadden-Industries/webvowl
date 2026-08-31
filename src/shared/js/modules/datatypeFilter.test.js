const OwlClass = require("../../../webvowl/js/elements/nodes/implementations/OwlClass");
const RdfsDatatype = require("../../../webvowl/js/elements/nodes/implementations/RdfsDatatype");
const DatatypeProperty = require("../../../webvowl/js/elements/properties/implementations/OwlDatatypeProperty");
const datatypeFilterFactory = require("./datatypeFilter");

describe("Collapsing of datatypes filter", () => {
  let filter;

  beforeEach(() => {
    filter = datatypeFilterFactory();
    filter.enabled(true);
  });

  test("should remove datatypes with their connected properties when enabled", () => {
    const domain = new OwlClass();
    const datatypeClass = new RdfsDatatype();
    const datatypeProperty = new DatatypeProperty();

    datatypeProperty.domain(domain).range(datatypeClass);

    filter.filter([domain, datatypeClass], [datatypeProperty]);

    expect(filter.filteredNodes().length).toBe(1);
    expect(filter.filteredNodes()[0]).toBeInstanceOf(OwlClass);
    expect(filter.filteredProperties().length).toBe(0);
  });
});

import { beforeAll } from "@jest/globals";

let OwlClass;
let RdfsDatatype;
let DatatypeProperty;
let datatypeFilterFactory;

beforeAll(async () => {
  ({ OwlClass } =
    await import("../../../webvowl/js/elements/nodes/implementations/OwlClass.js"));
  ({ RdfsDatatype } =
    await import("../../../webvowl/js/elements/nodes/implementations/RdfsDatatype.js"));
  ({ OwlDatatypeProperty: DatatypeProperty } =
    await import("../../../webvowl/js/elements/properties/implementations/OwlDatatypeProperty.js"));
  ({ createDatatypeFilter: datatypeFilterFactory } =
    await import("./datatypeFilter.js"));
});

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

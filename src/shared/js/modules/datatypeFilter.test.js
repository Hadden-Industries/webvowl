import { beforeAll } from "@jest/globals";
import loadEsmModuleForTest from "../../../app/test/loadEsmModuleForTest.js";

let OwlClass;
let RdfsDatatype;
let DatatypeProperty;
let datatypeFilterFactory;

beforeAll(async () => {
  ({ OwlClass } = await loadEsmModuleForTest(
    new URL(
      "../../../webvowl/js/elements/nodes/implementations/OwlClass.js",
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
  ({ createDatatypeFilter: datatypeFilterFactory } = await loadEsmModuleForTest(
    new URL("./datatypeFilter.js", import.meta.url),
    import.meta.url,
  ));
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

const OwlClass = require("../elements/nodes/implementations/OwlClass");
const RdfsSubClassOf = require("../elements/properties/implementations/RdfsSubClassOf");
const ObjectProperty = require("../elements/properties/implementations/OwlObjectProperty");
const subclassFilterFactory = require("./subclassFilter");

describe("Collapsing of subclassOf properties", () => {
  let collapser;

  beforeEach(() => {
    collapser = subclassFilterFactory();
    collapser.enabled(true);
  });

  test("should remove subclasses and their properties", () => {
    const superClass = new OwlClass();
    const subProperty = new RdfsSubClassOf();
    const subclass = new OwlClass();

    subProperty.domain(subclass).range(superClass);

    collapser.filter([superClass, subclass], [subProperty]);

    expect(collapser.filteredNodes().length).toBe(1);
    expect(collapser.filteredNodes()[0]).toBeInstanceOf(OwlClass);
    expect(collapser.filteredProperties().length).toBe(0);
  });

  test("should remove nested subclasses and their properties", () => {
    const superClass = new OwlClass();
    const subProperty = new RdfsSubClassOf();
    const subclass = new OwlClass();
    const subSubProperty = new RdfsSubClassOf();
    const subSubclass = new OwlClass();

    subProperty.domain(subclass).range(superClass);
    subSubProperty.domain(subSubclass).range(subclass);

    collapser.filter(
      [superClass, subclass, subSubclass],
      [subProperty, subSubProperty],
    );

    expect(collapser.filteredNodes().length).toBe(1);
    expect(collapser.filteredNodes()[0]).toBeInstanceOf(OwlClass);
    expect(collapser.filteredProperties().length).toBe(0);
  });

  test("should not remove if a subclass is domain of another property", () => {
    const superClass = new OwlClass();
    const subProperty = new RdfsSubClassOf();
    const subclass = new OwlClass();
    const otherProperty = new ObjectProperty();
    const nodes = [superClass, subclass];
    const properties = [subProperty, otherProperty];

    subProperty.domain(subclass).range(superClass);
    otherProperty.domain(subclass).range(superClass);

    collapser.filter(nodes, properties);

    expect(collapser.filteredNodes()).toEqual(nodes);
    expect(collapser.filteredProperties()).toEqual(properties);
  });

  test("should not remove if a subclass is range of another property", () => {
    const superClass = new OwlClass();
    const subProperty = new RdfsSubClassOf();
    const subclass = new OwlClass();
    const otherProperty = new ObjectProperty();
    const nodes = [superClass, subclass];
    const properties = [subProperty, otherProperty];

    subProperty.domain(subclass).range(superClass);
    otherProperty.domain(superClass).range(subclass);

    collapser.filter(nodes, properties);

    expect(collapser.filteredNodes()).toEqual(nodes);
    expect(collapser.filteredProperties()).toEqual(properties);
  });

  test("should not collapse if a subclass has a subclass with non-subclass properties", () => {
    const superClass = new OwlClass();
    const subProperty = new RdfsSubClassOf();
    const subclass = new OwlClass();
    const subSubclassProperty = new RdfsSubClassOf();
    const subSubclass = new OwlClass();
    const otherProperty = new ObjectProperty();
    const otherNode = new OwlClass();
    const nodes = [superClass, subclass, subSubclass, otherNode];
    const properties = [subProperty, subSubclassProperty, otherProperty];

    subProperty.domain(subclass).range(superClass);
    subSubclassProperty.domain(subSubclass).range(subclass);
    otherProperty.domain(otherNode).range(subSubclass);

    collapser.filter(nodes, properties);

    expect(collapser.filteredNodes()).toEqual(nodes);
    expect(collapser.filteredProperties()).toEqual(properties);
  });

  test("should not collapse if a subclass has multiple superclasses", () => {
    const superClass1 = new OwlClass();
    const subProperty1 = new RdfsSubClassOf();
    const superClass2 = new OwlClass();
    const subProperty2 = new RdfsSubClassOf();
    const subclass = new OwlClass();
    const nodes = [superClass1, superClass2, subclass];
    const properties = [subProperty1, subProperty2];

    subProperty1.domain(subclass).range(superClass1);
    subProperty2.domain(subclass).range(superClass2);

    collapser.filter(nodes, properties);

    expect(collapser.filteredNodes()).toEqual(nodes);
    expect(collapser.filteredProperties()).toEqual(properties);
  });

  test("should be able to handle circles", () => {
    const loopSubClass = new OwlClass();
    const subProperty = new RdfsSubClassOf();
    const nodes = [loopSubClass];
    const properties = [subProperty];

    subProperty.domain(loopSubClass).range(loopSubClass);

    collapser.filter(nodes, properties);

    expect(collapser.filteredNodes()).toEqual(nodes);
    expect(collapser.filteredProperties()).toEqual(properties);
  });
});

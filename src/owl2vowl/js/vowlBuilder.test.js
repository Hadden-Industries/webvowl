import { describe, expect, it } from "@jest/globals";

import {
  IRI,
  OWLDataFactory,
  OWLOntology,
} from "../../owlapi-js/model/index.js";

import { VOWLBuilder } from "./vowlBuilder.js";

describe("VOWLBuilder", () => {
  it("builds a complete empty VOWL document for an anonymous ontology", () => {
    const result = new VOWLBuilder().build(new OWLOntology());

    expect(result).toEqual({
      _comment: "Created with owlapi-js VOWLBuilder",
      header: {
        author: [],
        baseIris: [],
        comments: {},
        description: {},
        imports: [],
        iri: "",
        labels: {},
        languages: [],
        other: {},
        prefixList: {},
        title: {},
        version: "",
      },
      metrics: {
        classCount: 0,
        datatypeCount: 0,
        datatypePropertyCount: 0,
        individualCount: 0,
        nodeCount: 0,
        objectPropertyCount: 0,
        propertyCount: 0,
      },
      namespace: [],
      class: [],
      classAttribute: [],
      property: [],
      propertyAttribute: [],
    });
  });

  it("maps visual entity kinds and their default endpoints", () => {
    const factory = new OWLDataFactory();
    const iri = (localName) =>
      IRI.create(`https://example.com/phase7#${localName}`);
    const person = factory.getOWLClass(iri("Person"));
    const code = factory.getOWLDatatype(iri("Code"));
    const knows = factory.getOWLObjectProperty(iri("knows"));
    const age = factory.getOWLDataProperty(iri("age"));
    const source = factory.getOWLAnnotationProperty(iri("source"));
    const alice = factory.getOWLNamedIndividual(iri("alice"));
    const ontology = new OWLOntology({
      axioms: [person, code, knows, age, source, alice].map((entity) =>
        factory.getOWLDeclarationAxiom(entity),
      ),
      ontologyID: factory.getOWLOntologyID(
        IRI.create("https://example.com/phase7"),
      ),
    });

    const result = new VOWLBuilder().build(ontology);
    const classByIri = new Map(
      result.classAttribute.map((attribute) => [attribute.iri, attribute]),
    );
    const classTypeById = new Map(
      result.class.map(({ id, type }) => [id, type]),
    );
    const propertyByIri = new Map(
      result.propertyAttribute.map((attribute) => [attribute.iri, attribute]),
    );
    const propertyTypeById = new Map(
      result.property.map(({ id, type }) => [id, type]),
    );

    expect(classTypeById.get(classByIri.get(person.iri.value).id)).toBe(
      "owl:Class",
    );
    expect(classByIri.get(person.iri.value)).toMatchObject({
      baseIri: "https://example.com/phase7",
      instances: 0,
      label: { "IRI-based": "Person" },
    });
    expect(classTypeById.get(classByIri.get(code.iri.value).id)).toBe(
      "rdfs:Datatype",
    );
    expect(propertyTypeById.get(propertyByIri.get(knows.iri.value).id)).toBe(
      "owl:objectProperty",
    );
    expect(propertyTypeById.get(propertyByIri.get(age.iri.value).id)).toBe(
      "owl:datatypeProperty",
    );
    expect(classByIri.get("http://www.w3.org/2002/07/owl#Thing")).toBeDefined();
    expect(
      classByIri.get("http://www.w3.org/2000/01/rdf-schema#Literal"),
    ).toBeDefined();
    expect(propertyByIri.get(knows.iri.value)).toMatchObject({
      attributes: ["object"],
      domain: classByIri.get("http://www.w3.org/2002/07/owl#Thing").id,
      range: classByIri.get("http://www.w3.org/2002/07/owl#Thing").id,
    });
    expect(propertyByIri.get(age.iri.value)).toMatchObject({
      attributes: ["datatype"],
      domain: classByIri.get("http://www.w3.org/2002/07/owl#Thing").id,
      range: classByIri.get("http://www.w3.org/2000/01/rdf-schema#Literal").id,
    });
    expect(classByIri.has(source.iri.value)).toBe(false);
    expect(classByIri.has(alice.iri.value)).toBe(false);
    expect(result.metrics).toMatchObject({
      classCount: 1,
      datatypeCount: 1,
      datatypePropertyCount: 1,
      individualCount: 0,
      nodeCount: 4,
      objectPropertyCount: 1,
      propertyCount: 2,
    });
  });

  it("preserves ontology and entity annotations in VOWL metadata", () => {
    const factory = new OWLDataFactory();
    const ontologyIri = IRI.create("https://example.com/phase7");
    const person = factory.getOWLClass(
      IRI.create("https://example.com/phase7#Person"),
    );
    const knows = factory.getOWLObjectProperty(
      IRI.create("https://example.com/phase7#knows"),
    );
    const annotationProperty = (value) =>
      factory.getOWLAnnotationProperty(IRI.create(value));
    const literalAnnotation = (propertyIri, value, language) =>
      factory.getOWLAnnotation(
        annotationProperty(propertyIri),
        factory.getOWLLiteral(value, language),
      );
    const labelIri = "http://www.w3.org/2000/01/rdf-schema#label";
    const commentIri = "http://www.w3.org/2000/01/rdf-schema#comment";
    const titleIri = "http://purl.org/dc/terms/title";
    const creatorIri = "http://purl.org/dc/terms/creator";
    const versionIri = "http://www.w3.org/2002/07/owl#versionInfo";
    const sourceIri = "https://example.com/phase7#source";
    const ontology = new OWLOntology({
      annotations: [
        literalAnnotation(labelIri, "Phase 7", "en"),
        literalAnnotation(commentIri, "Builder fixture", "en"),
        literalAnnotation(titleIri, "Structural visualization", "en"),
        literalAnnotation(creatorIri, "Ada Builder", ""),
        literalAnnotation(versionIri, "1.0", ""),
      ],
      axioms: [
        factory.getOWLDeclarationAxiom(person),
        factory.getOWLDeclarationAxiom(knows),
        factory.getOWLAnnotationAssertionAxiom(
          annotationProperty(labelIri),
          person.iri,
          factory.getOWLLiteral("Person", "en"),
        ),
        factory.getOWLAnnotationAssertionAxiom(
          annotationProperty(commentIri),
          person.iri,
          factory.getOWLLiteral("A person", "en"),
        ),
        factory.getOWLAnnotationAssertionAxiom(
          annotationProperty(sourceIri),
          person.iri,
          factory.getOWLLiteral("specification", "en"),
        ),
        factory.getOWLAnnotationAssertionAxiom(
          annotationProperty(labelIri),
          knows.iri,
          factory.getOWLLiteral("knows", ""),
        ),
      ],
      ontologyID: factory.getOWLOntologyID(ontologyIri),
    });

    const result = new VOWLBuilder().build(ontology);
    const personAttribute = result.classAttribute.find(
      ({ iri }) => iri === person.iri.value,
    );
    const knowsAttribute = result.propertyAttribute.find(
      ({ iri }) => iri === knows.iri.value,
    );

    expect(result.header).toMatchObject({
      author: ["Ada Builder"],
      comments: { en: "Builder fixture" },
      iri: ontologyIri.value,
      labels: { en: "Phase 7" },
      languages: ["en", "undefined"],
      title: { en: "Structural visualization" },
      version: "1.0",
    });
    expect(result.header.other).toMatchObject({
      creator: [
        {
          identifier: creatorIri,
          language: "undefined",
          type: "label",
          value: "Ada Builder",
        },
      ],
      title: [
        {
          identifier: titleIri,
          language: "en",
          type: "label",
          value: "Structural visualization",
        },
      ],
      versionInfo: [
        {
          identifier: versionIri,
          language: "undefined",
          type: "label",
          value: "1.0",
        },
      ],
    });
    expect(personAttribute).toMatchObject({
      annotations: {
        source: [
          {
            identifier: sourceIri,
            language: "en",
            type: "label",
            value: "specification",
          },
        ],
      },
      comment: { en: "A person" },
      label: { en: "Person" },
    });
    expect(knowsAttribute.label).toEqual({ undefined: "knows" });
  });

  it("maps subclass, domain, range, subproperty, and inverse relations", () => {
    const factory = new OWLDataFactory();
    const entityIri = (localName) =>
      IRI.create(`https://example.com/phase7#${localName}`);
    const person = factory.getOWLClass(entityIri("Person"));
    const parent = factory.getOWLClass(entityIri("Parent"));
    const child = factory.getOWLClass(entityIri("Child"));
    const hasChild = factory.getOWLObjectProperty(entityIri("hasChild"));
    const hasDaughter = factory.getOWLObjectProperty(entityIri("hasDaughter"));
    const childOf = factory.getOWLObjectProperty(entityIri("childOf"));
    const age = factory.getOWLDataProperty(entityIri("age"));
    const years = factory.getOWLDataProperty(entityIri("years"));
    const integer = factory.getOWLDatatype(
      IRI.create("http://www.w3.org/2001/XMLSchema#integer"),
    );
    const ontology = new OWLOntology({
      axioms: [
        factory.getOWLSubClassOfAxiom(parent, person),
        factory.getOWLObjectPropertyDomainAxiom(hasChild, parent),
        factory.getOWLObjectPropertyRangeAxiom(hasChild, child),
        factory.getOWLSubObjectPropertyOfAxiom(hasDaughter, hasChild),
        factory.getOWLInverseObjectPropertiesAxiom(hasChild, childOf),
        factory.getOWLDataPropertyDomainAxiom(age, person),
        factory.getOWLDataPropertyRangeAxiom(age, integer),
        factory.getOWLSubDataPropertyOfAxiom(years, age),
      ],
      ontologyID: factory.getOWLOntologyID(
        IRI.create("https://example.com/phase7"),
      ),
    });

    const result = new VOWLBuilder().build(ontology);
    const classByIri = new Map(
      result.classAttribute.map((attribute) => [attribute.iri, attribute]),
    );
    const propertyByIri = new Map(
      result.propertyAttribute
        .filter(({ iri }) => iri)
        .map((attribute) => [attribute.iri, attribute]),
    );
    const propertyTypeById = new Map(
      result.property.map(({ id, type }) => [id, type]),
    );
    const subclass = result.propertyAttribute.find(
      ({ id }) => propertyTypeById.get(id) === "rdfs:SubClassOf",
    );

    expect(subclass).toMatchObject({
      attributes: ["transitive"],
      domain: classByIri.get(parent.iri.value).id,
      iri: "http://www.w3.org/2000/01/rdf-schema#subClassOf",
      range: classByIri.get(person.iri.value).id,
    });
    expect(propertyByIri.get(hasChild.iri.value)).toMatchObject({
      domain: classByIri.get(parent.iri.value).id,
      inverse: propertyByIri.get(childOf.iri.value).id,
      range: classByIri.get(child.iri.value).id,
      subproperty: [propertyByIri.get(hasDaughter.iri.value).id],
    });
    expect(propertyByIri.get(childOf.iri.value).inverse).toBe(
      propertyByIri.get(hasChild.iri.value).id,
    );
    expect(propertyByIri.get(hasDaughter.iri.value).superproperty).toEqual([
      propertyByIri.get(hasChild.iri.value).id,
    ]);
    expect(propertyByIri.get(age.iri.value)).toMatchObject({
      domain: classByIri.get(person.iri.value).id,
      range: classByIri.get(integer.iri.value).id,
      subproperty: [propertyByIri.get(years.iri.value).id],
    });
    expect(propertyByIri.get(years.iri.value).superproperty).toEqual([
      propertyByIri.get(age.iri.value).id,
    ]);
  });

  it("renders object and data quantified restrictions as VOWL edges", () => {
    const factory = new OWLDataFactory();
    const entityIri = (localName) =>
      IRI.create(`https://example.com/phase7#${localName}`);
    const parent = factory.getOWLClass(entityIri("Parent"));
    const guardian = factory.getOWLClass(entityIri("Guardian"));
    const adult = factory.getOWLClass(entityIri("Adult"));
    const child = factory.getOWLClass(entityIri("Child"));
    const hasChild = factory.getOWLObjectProperty(entityIri("hasChild"));
    const age = factory.getOWLDataProperty(entityIri("age"));
    const integer = factory.getOWLDatatype(
      IRI.create("http://www.w3.org/2001/XMLSchema#integer"),
    );
    const ontology = new OWLOntology({
      axioms: [
        factory.getOWLSubClassOfAxiom(
          parent,
          factory.getOWLObjectSomeValuesFrom(hasChild, child),
        ),
        factory.getOWLSubClassOfAxiom(
          guardian,
          factory.getOWLObjectAllValuesFrom(hasChild, child),
        ),
        factory.getOWLSubClassOfAxiom(
          adult,
          factory.getOWLDataSomeValuesFrom([age], integer),
        ),
      ],
      ontologyID: factory.getOWLOntologyID(
        IRI.create("https://example.com/phase7"),
      ),
    });

    const result = new VOWLBuilder().build(ontology);
    const classByIri = new Map(
      result.classAttribute.map((attribute) => [attribute.iri, attribute]),
    );
    const propertyTypeById = new Map(
      result.property.map(({ id, type }) => [id, type]),
    );
    const restrictionEdges = result.propertyAttribute.filter(({ id }) =>
      ["owl:someValuesFrom", "owl:allValuesFrom"].includes(
        propertyTypeById.get(id),
      ),
    );

    expect(restrictionEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributes: ["object", "someValuesFrom", "inferred"],
          domain: classByIri.get(parent.iri.value).id,
          iri: hasChild.iri.value,
          range: classByIri.get(child.iri.value).id,
        }),
        expect.objectContaining({
          attributes: ["object", "allValuesFrom", "inferred"],
          domain: classByIri.get(guardian.iri.value).id,
          iri: hasChild.iri.value,
          range: classByIri.get(child.iri.value).id,
        }),
        expect.objectContaining({
          attributes: ["datatype", "someValuesFrom", "inferred"],
          domain: classByIri.get(adult.iri.value).id,
          iri: age.iri.value,
          range: classByIri.get(integer.iri.value).id,
        }),
      ]),
    );
  });

  it("preserves object and data cardinalities on their visual links", () => {
    const factory = new OWLDataFactory();
    const entityIri = (localName) =>
      IRI.create(`https://example.com/phase7#${localName}`);
    const parent = factory.getOWLClass(entityIri("Parent"));
    const person = factory.getOWLClass(entityIri("Person"));
    const child = factory.getOWLClass(entityIri("Child"));
    const hasChild = factory.getOWLObjectProperty(entityIri("hasChild"));
    const age = factory.getOWLDataProperty(entityIri("age"));
    const integer = factory.getOWLDatatype(
      IRI.create("http://www.w3.org/2001/XMLSchema#integer"),
    );
    const ontology = new OWLOntology({
      axioms: [
        factory.getOWLSubClassOfAxiom(
          parent,
          factory.getOWLObjectMinCardinality(1, hasChild, child),
        ),
        factory.getOWLSubClassOfAxiom(
          parent,
          factory.getOWLObjectMaxCardinality(5, hasChild, child),
        ),
        factory.getOWLSubClassOfAxiom(
          person,
          factory.getOWLDataExactCardinality(1, age, integer),
        ),
      ],
      ontologyID: factory.getOWLOntologyID(
        IRI.create("https://example.com/phase7"),
      ),
    });

    const result = new VOWLBuilder().build(ontology);
    const classByIri = new Map(
      result.classAttribute.map((attribute) => [attribute.iri, attribute]),
    );
    const propertyTypeById = new Map(
      result.property.map(({ id, type }) => [id, type]),
    );
    const visualLinks = result.propertyAttribute.filter(({ id }) =>
      ["owl:objectProperty", "owl:datatypeProperty"].includes(
        propertyTypeById.get(id),
      ),
    );

    expect(visualLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributes: ["object", "inferred"],
          domain: classByIri.get(parent.iri.value).id,
          iri: hasChild.iri.value,
          maxCardinality: "5",
          minCardinality: "1",
          range: classByIri.get(child.iri.value).id,
        }),
        expect.objectContaining({
          attributes: ["datatype", "inferred"],
          cardinality: "1",
          domain: classByIri.get(person.iri.value).id,
          iri: age.iri.value,
          range: classByIri.get(integer.iri.value).id,
        }),
      ]),
    );
  });

  it("maps equivalent, set-operator, complement, and disjoint class axioms", () => {
    const factory = new OWLDataFactory();
    const owlClass = (localName) =>
      factory.getOWLClass(
        IRI.create(`https://example.com/phase7#${localName}`),
      );
    const animal = owlClass("Animal");
    const cat = owlClass("Cat");
    const dog = owlClass("Dog");
    const pet = owlClass("Pet");
    const companion = owlClass("Companion");
    const catAndDog = owlClass("CatAndDog");
    const notCat = owlClass("NotCat");
    const ontology = new OWLOntology({
      axioms: [
        factory.getOWLEquivalentClassesAxiom([
          pet,
          factory.getOWLObjectUnionOf([cat, dog]),
        ]),
        factory.getOWLEquivalentClassesAxiom([
          catAndDog,
          factory.getOWLObjectIntersectionOf([cat, dog]),
        ]),
        factory.getOWLEquivalentClassesAxiom([
          notCat,
          factory.getOWLObjectComplementOf(cat),
        ]),
        factory.getOWLEquivalentClassesAxiom([animal, companion]),
        factory.getOWLDisjointUnionAxiom(animal, [cat, dog]),
        factory.getOWLDisjointClassesAxiom([animal, cat, dog]),
      ],
      ontologyID: factory.getOWLOntologyID(
        IRI.create("https://example.com/phase7"),
      ),
    });

    const result = new VOWLBuilder().build(ontology);
    const classByIri = new Map(
      result.classAttribute.map((attribute) => [attribute.iri, attribute]),
    );
    const classTypeById = new Map(
      result.class.map(({ id, type }) => [id, type]),
    );
    const propertyTypeById = new Map(
      result.property.map(({ id, type }) => [id, type]),
    );
    const disjointEdges = result.propertyAttribute.filter(
      ({ id }) => propertyTypeById.get(id) === "owl:disjointWith",
    );

    expect(classTypeById.get(classByIri.get(pet.iri.value).id)).toBe(
      "owl:unionOf",
    );
    expect(classByIri.get(pet.iri.value)).toMatchObject({
      attributes: expect.arrayContaining(["union"]),
      union: [
        classByIri.get(cat.iri.value).id,
        classByIri.get(dog.iri.value).id,
      ],
    });
    expect(classTypeById.get(classByIri.get(catAndDog.iri.value).id)).toBe(
      "owl:intersectionOf",
    );
    expect(classByIri.get(catAndDog.iri.value)).toMatchObject({
      attributes: expect.arrayContaining(["intersection"]),
      intersection: [
        classByIri.get(cat.iri.value).id,
        classByIri.get(dog.iri.value).id,
      ],
    });
    expect(classTypeById.get(classByIri.get(notCat.iri.value).id)).toBe(
      "owl:complementOf",
    );
    expect(classByIri.get(notCat.iri.value).complement).toEqual([
      classByIri.get(cat.iri.value).id,
    ]);
    expect(classTypeById.get(classByIri.get(animal.iri.value).id)).toBe(
      "owl:disjointUnionOf",
    );
    expect(classByIri.get(animal.iri.value)).toMatchObject({
      disjointUnion: [
        classByIri.get(cat.iri.value).id,
        classByIri.get(dog.iri.value).id,
      ],
      equivalent: [classByIri.get(companion.iri.value).id],
    });
    expect(classByIri.get(companion.iri.value).equivalent).toEqual([
      classByIri.get(animal.iri.value).id,
    ]);
    expect(disjointEdges).toHaveLength(3);
  });

  it("maps property characteristics, equivalence, and class keys", () => {
    const factory = new OWLDataFactory();
    const iri = (localName) =>
      IRI.create(`https://example.com/phase7#${localName}`);
    const person = factory.getOWLClass(iri("Person"));
    const hasChild = factory.getOWLObjectProperty(iri("hasChild"));
    const hasDependent = factory.getOWLObjectProperty(iri("hasDependent"));
    const age = factory.getOWLDataProperty(iri("age"));
    const years = factory.getOWLDataProperty(iri("years"));
    const ontology = new OWLOntology({
      axioms: [
        factory.getOWLFunctionalObjectPropertyAxiom(hasChild),
        factory.getOWLInverseFunctionalObjectPropertyAxiom(hasChild),
        factory.getOWLSymmetricObjectPropertyAxiom(hasChild),
        factory.getOWLAsymmetricObjectPropertyAxiom(hasChild),
        factory.getOWLTransitiveObjectPropertyAxiom(hasChild),
        factory.getOWLReflexiveObjectPropertyAxiom(hasChild),
        factory.getOWLIrreflexiveObjectPropertyAxiom(hasChild),
        factory.getOWLFunctionalDataPropertyAxiom(age),
        factory.getOWLEquivalentObjectPropertiesAxiom([hasChild, hasDependent]),
        factory.getOWLEquivalentDataPropertiesAxiom([age, years]),
        factory.getOWLHasKeyAxiom(person, [hasChild], [age]),
      ],
      ontologyID: factory.getOWLOntologyID(
        IRI.create("https://example.com/phase7"),
      ),
    });

    const result = new VOWLBuilder().build(ontology);
    const propertyByIri = new Map(
      result.propertyAttribute.map((attribute) => [attribute.iri, attribute]),
    );
    const hasChildAttribute = propertyByIri.get(hasChild.iri.value);
    const hasDependentAttribute = propertyByIri.get(hasDependent.iri.value);
    const ageAttribute = propertyByIri.get(age.iri.value);
    const yearsAttribute = propertyByIri.get(years.iri.value);

    expect(hasChildAttribute.attributes).toEqual(
      expect.arrayContaining([
        "asymmetric",
        "equivalent",
        "functional",
        "inverse functional",
        "irreflexive",
        "key",
        "object",
        "reflexive",
        "symmetric",
        "transitive",
      ]),
    );
    expect(hasChildAttribute.equivalent).toEqual([hasDependentAttribute.id]);
    expect(hasDependentAttribute.equivalent).toEqual([hasChildAttribute.id]);
    expect(ageAttribute.attributes).toEqual(
      expect.arrayContaining(["datatype", "equivalent", "functional", "key"]),
    );
    expect(ageAttribute.equivalent).toEqual([yearsAttribute.id]);
    expect(yearsAttribute.equivalent).toEqual([ageAttribute.id]);
  });

  it("attaches named individuals and their annotations to asserted classes", () => {
    const factory = new OWLDataFactory();
    const iri = (localName) =>
      IRI.create(`https://example.com/phase7#${localName}`);
    const person = factory.getOWLClass(iri("Person"));
    const alice = factory.getOWLNamedIndividual(iri("alice"));
    const label = factory.getOWLAnnotationProperty(
      IRI.create("http://www.w3.org/2000/01/rdf-schema#label"),
    );
    const comment = factory.getOWLAnnotationProperty(
      IRI.create("http://www.w3.org/2000/01/rdf-schema#comment"),
    );
    const description = factory.getOWLAnnotationProperty(
      IRI.create("http://purl.org/dc/terms/description"),
    );
    const source = factory.getOWLAnnotationProperty(iri("source"));
    const ontology = new OWLOntology({
      axioms: [
        factory.getOWLClassAssertionAxiom(person, alice),
        factory.getOWLAnnotationAssertionAxiom(
          label,
          alice.iri,
          factory.getOWLLiteral("Alice", "en"),
        ),
        factory.getOWLAnnotationAssertionAxiom(
          comment,
          alice.iri,
          factory.getOWLLiteral("A test person", "en"),
        ),
        factory.getOWLAnnotationAssertionAxiom(
          description,
          alice.iri,
          factory.getOWLLiteral("Phase 7 fixture", ""),
        ),
        factory.getOWLAnnotationAssertionAxiom(
          source,
          alice.iri,
          factory.getOWLLiteral("project-owned", "en"),
        ),
      ],
      ontologyID: factory.getOWLOntologyID(
        IRI.create("https://example.com/phase7"),
      ),
    });

    const result = new VOWLBuilder().build(ontology);
    const personAttribute = result.classAttribute.find(
      ({ iri: value }) => value === person.iri.value,
    );

    expect(personAttribute.instances).toBe(1);
    expect(personAttribute.individuals).toEqual([
      {
        annotations: {
          source: [
            {
              identifier: source.iri.value,
              language: "en",
              type: "label",
              value: "project-owned",
            },
          ],
        },
        baseIri: "https://example.com/phase7",
        comment: { en: "A test person" },
        description: { undefined: "Phase 7 fixture" },
        iri: alice.iri.value,
        labels: { en: "Alice" },
      },
    ]);
    expect(result.metrics.individualCount).toBe(1);
  });

  it("builds one visualization from the root ontology and its import closure", () => {
    const factory = new OWLDataFactory();
    const rootIri = IRI.create("https://example.com/phase7");
    const importedIri = IRI.create("https://example.com/imported");
    const rootClass = factory.getOWLClass(
      IRI.create("https://example.com/phase7#Root"),
    );
    const importedClass = factory.getOWLClass(
      IRI.create("https://example.com/imported#Imported"),
    );
    const importedProperty = factory.getOWLObjectProperty(
      IRI.create("https://example.com/imported#relatedTo"),
    );
    const importedOntology = new OWLOntology({
      axioms: [
        factory.getOWLDeclarationAxiom(importedClass),
        factory.getOWLObjectPropertyDomainAxiom(
          importedProperty,
          importedClass,
        ),
        factory.getOWLObjectPropertyRangeAxiom(importedProperty, rootClass),
      ],
      ontologyID: factory.getOWLOntologyID(importedIri),
    });
    const rootOntology = new OWLOntology({
      axioms: [factory.getOWLDeclarationAxiom(rootClass)],
      imports: [factory.getOWLImportsDeclaration(importedIri)],
      ontologyID: factory.getOWLOntologyID(rootIri),
    });

    const result = new VOWLBuilder().build(rootOntology, {
      importsClosure: [rootOntology, importedOntology],
    });
    const classByIri = new Map(
      result.classAttribute.map((attribute) => [attribute.iri, attribute]),
    );
    const propertyByIri = new Map(
      result.propertyAttribute.map((attribute) => [attribute.iri, attribute]),
    );

    expect(result.header.imports).toEqual([importedIri.value]);
    expect(classByIri.get(rootClass.iri.value).attributes).toBeUndefined();
    expect(classByIri.get(importedClass.iri.value).attributes).toContain(
      "external",
    );
    expect(propertyByIri.get(importedProperty.iri.value)).toMatchObject({
      attributes: expect.arrayContaining(["external", "object"]),
      domain: classByIri.get(importedClass.iri.value).id,
      range: classByIri.get(rootClass.iri.value).id,
    });
  });
});

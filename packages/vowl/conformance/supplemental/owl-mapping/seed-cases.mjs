// SPDX-License-Identifier: AGPL-3.0-only
// OWL bytes and retained models are authored independently, not parsed by product code.
import {
  model,
  projectFixture,
  IRIS,
} from "../mapping-counterexamples/model.mjs";
import { profiles } from "./support.mjs";

export const NS = "https://example.org/owl-seed#";
export const XSD = "http://www.w3.org/2001/XMLSchema#";
export const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
export const OWL = "http://www.w3.org/2002/07/owl#";
export const functional = (body, header = "") =>
  `Prefix(:=<${NS}>)\nPrefix(xsd:=<${XSD}>)\nOntology(${header}\n${body}\n)\n`;
export const typed = (lexical, datatype = XSD + "string") => ({
  kind: "typed",
  lexical,
  datatype,
});
export const annotation = (predicate, value, annotations = []) => ({
  predicate,
  value,
  annotations,
});
export function manual() {
  const m = model();
  const role = (id, kind, iri = NS + id) => m.role(id, kind, iri);
  const datatype = (id, iri = XSD + id) => role(id, "datatype", iri);
  const ap = (id) => role(id, "annotation-property");
  const finish = () => projectFixture(m.source);
  return { ...m, role, datatype, ap, finish };
}
const healthyRuns = () => [
  {
    id: "default",
    options: {},
    outcome: "success",
    mappingProfile: profiles.compatibility,
    diagnostics: [],
  },
  {
    id: "compatibility",
    options: { mappingProfile: profiles.compatibility },
    outcome: "success",
    mappingProfile: profiles.compatibility,
    diagnostics: [],
  },
  {
    id: "strict",
    options: { mappingProfile: profiles.strict },
    outcome: "success",
    mappingProfile: profiles.strict,
    diagnostics: [],
  },
];
export function recoveryRuns(code, extra = {}) {
  return [
    {
      id: "default",
      options: {},
      outcome: "success",
      mappingProfile: profiles.compatibility,
      diagnostics: [{ code, ...extra }],
    },
    {
      id: "compatibility",
      options: { mappingProfile: profiles.compatibility },
      outcome: "success",
      mappingProfile: profiles.compatibility,
      diagnostics: [{ code, ...extra }],
    },
    {
      id: "strict",
      options: { mappingProfile: profiles.strict },
      outcome: "error",
      errorCode: code,
    },
  ];
}
export function seedCases() {
  const result = [];
  function add(
    id,
    sourceText,
    expectedSource,
    rules,
    rationale,
    runs = healthyRuns(),
    mediaType = "text/owl-functional",
  ) {
    result.push({
      id,
      root: {
        sourceText,
        documentIri: `https://documents.example/${id}`,
        mediaType,
      },
      expectedSource,
      rules,
      rationale,
      runs,
    });
  }
  add(
    "empty-anonymous-ontology",
    functional(""),
    manual().finish(),
    ["A9.1", "D10"],
    "The required retrieval/base IRI is not an authored ontology IRI. No semantic record or ontology IRI is invented.",
  );
  {
    const m = manual();
    m.role("A", "class");
    m.role("B", "class");
    m.fact("sub", "subclass", { sub: "A", super: "B" });
    const expected = m.finish();
    add(
      "declared-subclass",
      functional(
        "Declaration(Class(:A))\nDeclaration(Class(:B))\nSubClassOf(:A :B)",
      ),
      expected,
      ["A2", "A4", "A9.2", "B2.4"],
      "Explicit declarations and subclass yield two class nodes, one subclass edge and its label.",
    );
    add(
      "typed-use-without-redundant-declarations",
      functional("SubClassOf(:A :B)"),
      structuredClone(expected),
      ["A9.2", "D11.2"],
      "An unambiguous typed constructor establishes both class roles; redundant declaration syntax cannot change bytes or emit a compatibility recovery.",
    );
  }
  {
    const m = manual();
    m.role("A", "class");
    m.role("B", "class");
    m.ap("note");
    m.ap("meta");
    m.datatype("integer");
    m.datatype("string");
    m.datatype("langString", RDF + "langString");
    m.fact("sub", "subclass", { sub: "A", super: "B" });
    m.fact("anchor", "assertion-anchor", {
      assertion: { kind: "subclass", sub: "A", super: "B" },
      annotations: [
        annotation(NS + "note", typed("01", XSD + "integer"), [
          annotation(NS + "meta", typed("nested")),
        ]),
      ],
    });
    m.fact("label", "annotation-assertion", {
      subject: "s:A",
      predicate: NS + "note",
      value: { kind: "language", lexical: "Colour", language: "en-gb" },
    });
    add(
      "nested-annotations-and-exact-literals",
      functional(
        'Declaration(Class(:A))\nDeclaration(Class(:B))\nDeclaration(AnnotationProperty(:note))\nDeclaration(AnnotationProperty(:meta))\nSubClassOf(Annotation(Annotation(:meta "nested") :note "01"^^xsd:integer) :A :B)\nAnnotationAssertion(:note :A "Colour"@EN-gb)',
      ),
      m.finish(),
      ["A2", "A4", "D11.5", "D12"],
      "The axiom annotation is an anchor; its nested annotation remains nested. Integer lexeme 01 is unchanged; only ASCII language-tag case changes.",
    );
  }
  {
    const m = manual();
    m.role("A", "class");
    m.role("p", "object-property");
    m.role("d", "data-property");
    m.role("i", "individual");
    m.role("j", "individual");
    m.ap("note");
    m.datatype("string");
    m.role("Thing", "class", IRIS.Thing);
    m.datatype("Literal", IRIS.Literal);
    m.fact("member", "class-membership", { class: "A", individual: "i" });
    m.fact("note-i", "annotation-assertion", {
      subject: "s:i",
      predicate: NS + "note",
      value: typed("kept"),
    });
    const constructors = [
      "ObjectPropertyAssertion",
      "NegativeObjectPropertyAssertion",
      "DataPropertyAssertion",
      "NegativeDataPropertyAssertion",
      "SameIndividual",
      "DifferentIndividuals",
    ];
    const runs = healthyRuns().map((run) => ({
      ...run,
      diagnostics: constructors.map((sourceConstructor) => ({
        code: "MAPPING_EXCLUDED_AXIOM",
        sourceConstructor,
      })),
    }));
    add(
      "six-explicit-abox-exclusions",
      functional(
        'Declaration(Class(:A))\nDeclaration(ObjectProperty(:p))\nDeclaration(DataProperty(:d))\nDeclaration(NamedIndividual(:i))\nDeclaration(NamedIndividual(:j))\nDeclaration(AnnotationProperty(:note))\nClassAssertion(:A :i)\nAnnotationAssertion(:note :i "kept")\nObjectPropertyAssertion(Annotation(:note "discard with owning axiom") :p :i :j)\nNegativeObjectPropertyAssertion(:p :i :j)\nDataPropertyAssertion(:d :i "positive")\nNegativeDataPropertyAssertion(:d :i "negative")\nSameIndividual(:i :j)\nDifferentIndividuals(:i :j)',
      ),
      m.finish(),
      ["A9.2", "D13", "D12", "B2.2"],
      "Six excluded source kinds are diagnosed. Explicit roles and direct class membership remain; excluded-axiom annotations do not become anchors or participant annotations. The logically inconsistent pair does not fail a structural check.",
      runs,
    );
  }
  {
    const m = manual();
    m.role("A", "class");
    m.structural.ontology = {
      iri: "urn:owl-seed:root",
      imports: ["urn:owl-seed:missing"],
      annotations: [],
    };
    add(
      "unresolved-authored-import",
      functional(
        "Import(<urn:owl-seed:missing>)\nDeclaration(Class(:A))",
        "<urn:owl-seed:root>",
      ),
      m.finish(),
      ["A9.1", "A9.2", "D10"],
      "No resolver is supplied. Compatibility retains the exact authored root import and resolved root subset, diagnosing the authored import IRI; strict fails.",
      recoveryRuns("MAPPING_IMPORT_UNRESOLVED", {
        subject: "urn:owl-seed:missing",
      }),
    );
  }
  for (const unverified of [false, true]) {
    const m = manual();
    m.role("A", "class");
    m.ap("note");
    const dt = unverified ? NS + "CustomDatatype" : XSD + "integer";
    const lexical = unverified ? "opaque" : "not-an-integer";
    m.datatype(unverified ? "CustomDatatype" : "integer", dt);
    m.fact("literal", "annotation-assertion", {
      subject: "s:A",
      predicate: NS + "note",
      value: typed(lexical, dt),
    });
    const code = unverified
      ? "MAPPING_DATATYPE_UNVERIFIED"
      : "MAPPING_ILL_TYPED_LITERAL";
    add(
      unverified ? "unverified-custom-datatype" : "known-ill-typed-literal",
      functional(
        `Declaration(Class(:A))\nDeclaration(AnnotationProperty(:note))\n${unverified ? "Declaration(Datatype(:CustomDatatype))\n" : ""}AnnotationAssertion(:note :A "${lexical}"^^<${dt}>)`,
      ),
      m.finish(),
      ["A9.2", "D11.5", "A2"],
      unverified
        ? "A declared custom datatype does not establish lexical validity; compatibility preserves exact datatype and lexeme with the unverified code."
        : "Known integer lexical failure is checked even in an annotation. Compatibility preserves the exact ill-typed lexeme.",
      recoveryRuns(code),
    );
  }
  {
    const m = manual();
    m.role("A", "class");
    m.role("p-object", "object-property", NS + "p");
    m.role("p-data", "data-property", NS + "p");
    m.datatype("string");
    m.fact("od", "object-domain", { property: "p-object", target: "A" });
    m.fact("or", "object-range", { property: "p-object", target: "A" });
    m.fact("dd", "data-domain", { property: "p-data", target: "A" });
    m.fact("dr", "data-range", { property: "p-data", target: "string" });
    add(
      "explicit-multiple-property-roles",
      functional(
        "Declaration(Class(:A))\nDeclaration(ObjectProperty(:p))\nDeclaration(DataProperty(:p))\nObjectPropertyDomain(:p :A)\nObjectPropertyRange(:p :A)\nDataPropertyDomain(:p :A)\nDataPropertyRange(:p xsd:string)",
      ),
      m.finish(),
      ["A9.2", "A2", "D11.2", "B2.2"],
      "Typed positions disambiguate each use despite the explicit object/data category collision. Compatibility preserves two roles over one named subject and distinct projections.",
      recoveryRuns("MAPPING_MULTIPLE_ROLES", { subject: NS + "p" }),
    );
  }
  {
    const m = manual();
    m.role("A", "rdf-class");
    m.role("p", "rdf-property");
    m.fact("domain", "rdf-domain", { property: "p", target: "A" });
    m.fact("range", "rdf-range", { property: "p", target: "A" });
    add(
      "explicit-rdfs-only-roles",
      `@prefix : <${NS}> .\n@prefix rdf: <${RDF}> .\n@prefix rdfs: <${RDFS}> .\n:A a rdfs:Class .\n:p a rdf:Property ; rdfs:domain :A ; rdfs:range :A .\n`,
      m.finish(),
      ["A9.2", "A2", "A4", "C9"],
      "Explicit generic RDFS roles and their relations remain generic; compatibility must not manufacture a specific OWL property category.",
      recoveryRuns("MAPPING_RDFS_ROLE"),
      "text/turtle",
    );
  }
  {
    const m = manual();
    m.role("A", "class");
    m.role("p", "object-property");
    m.fact("domain", "object-domain", { property: "p", target: "A" });
    m.fact("range", "object-range", { property: "p", target: "A" });
    m.fact("transitive", "object-characteristic", {
      property: "p",
      characteristic: "transitive",
    });
    m.fact("functional", "object-characteristic", {
      property: "p",
      characteristic: "functional",
    });
    add(
      "non-simple-functional-property",
      functional(
        "Declaration(Class(:A))\nDeclaration(ObjectProperty(:p))\nObjectPropertyDomain(:p :A)\nObjectPropertyRange(:p :A)\nTransitiveObjectProperty(:p)\nFunctionalObjectProperty(:p)",
      ),
      m.finish(),
      ["A9.2", "D21.2", "OWL-11.2"],
      "An explicitly transitive property is non-simple and cannot occupy the functional-property position in OWL 2 DL. Compatibility retains both unambiguous characteristics without inference.",
      recoveryRuns("MAPPING_GLOBAL_RESTRICTION", {
        restrictionIdentifier: "NONSIMPLE_OBJECT_PROPERTY",
      }),
    );
  }
  return result;
}

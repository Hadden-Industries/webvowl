// SPDX-License-Identifier: AGPL-3.0-only
import { model, projectFixture, IRIS } from "./model.mjs";
import { at, profiles } from "../field-contract/support.mjs";
export function valueStatePairs() {
  const pairs = [];
  function add(
    id,
    m,
    descriptor,
    field,
    path,
    beforeValue,
    afterValue,
    extra = {},
  ) {
    const before = structuredClone(m.source),
      after = structuredClone(m.source);
    if (beforeValue !== undefined)
      at(before, path)[field] = structuredClone(beforeValue);
    else delete at(before, path)[field];
    if (afterValue !== undefined)
      at(after, path)[field] = structuredClone(afterValue);
    else delete at(after, path)[field];
    projectFixture(before);
    projectFixture(after);
    pairs.push({
      id,
      descriptor,
      field,
      path,
      obligation: `mapping/${descriptor}/${field}`,
      profile: before.visualization ? profiles.artifact : profiles.structural,
      before,
      after,
      ...extra,
    });
  }
  function signatures(m) {
    m.role("ap", "annotation-property", "urn:mapping-pair:annotation");
    m.role("aq", "annotation-property", "urn:mapping-pair:other-annotation");
    m.role("string", "datatype");
    m.role("langString", "datatype");
    m.role("D", "datatype");
  }
  const typed = (lexical = "before") => ({
    kind: "typed",
    lexical,
    datatype: IRIS.string,
  });
  const language = (lexical = "before") => ({
    kind: "language",
    lexical,
    language: "en",
  });
  const annotation = (value = typed()) => ({
    predicate: "urn:mapping-pair:annotation",
    value,
    annotations: [],
  });
  for (const [field, before, after] of [
    ["iri", "urn:mapping-pair:root-before", "urn:mapping-pair:root-after"],
    ["versionIri", undefined, "urn:mapping-pair:version"],
    ["imports", [], ["urn:mapping-pair:import"]],
    ["annotations", [], [annotation()]],
  ]) {
    const m = model();
    signatures(m);
    m.structural.ontology.iri = "urn:mapping-pair:root";
    add(
      `ontology-${field}`,
      m,
      "Ontology",
      field,
      ["structural", "ontology"],
      before,
      after,
      { additionalObligations: ["mapping/Structural/ontology"] },
    );
  }
  {
    const m = model();
    m.role("i", "individual");
    add(
      "subject-absent-versus-iri",
      m,
      "Subject",
      "iri",
      ["structural", "subjects", 0],
      undefined,
      "urn:mapping-pair:named-individual",
    );
  }
  {
    const m = model();
    m.alternatives("I");
    m.structural.roles.push({ id: "focus", kind: "class", subject: "s:i" });
    add(
      "role-subject-with-distinct-punned-subjects",
      m,
      "Role",
      "subject",
      ["structural", "roles", 2],
      "s:i",
      "s:j",
    );
  }
  for (const [field, before, after] of [
    [
      "predicate",
      "urn:mapping-pair:annotation",
      "urn:mapping-pair:other-annotation",
    ],
    ["value", typed(), typed("after")],
    ["annotations", [], [annotation(typed("nested"))]],
  ]) {
    const m = model();
    signatures(m);
    m.structural.ontology.annotations = [annotation()];
    add(
      `annotation-${field}`,
      m,
      "Annotation",
      field,
      ["structural", "ontology", "annotations", 0],
      before,
      after,
    );
  }
  for (const [kind, fields] of [
    ["iri", [["iri", "urn:mapping-pair:before", "urn:mapping-pair:after"]]],
    [
      "typed",
      [
        ["lexical", "", "after"],
        ["datatype", IRIS.string, "urn:mapping-pair:D"],
      ],
    ],
    [
      "language",
      [
        ["lexical", "", "after"],
        ["language", "en", "fr"],
      ],
    ],
  ]) {
    for (const [field, before, after] of fields) {
      const m = model();
      signatures(m);
      m.structural.ontology.annotations = [
        annotation(
          kind === "iri"
            ? { kind, iri: before }
            : kind === "typed"
              ? typed()
              : language(),
        ),
      ];
      add(
        `annotation-value-${kind}-${field}`,
        m,
        `AnnotationValue:${kind}`,
        field,
        ["structural", "ontology", "annotations", 0, "value"],
        before,
        after,
      );
    }
  }
  {
    const m = model();
    signatures(m);
    m.role("anon1", "individual");
    m.role("anon2", "individual");
    for (const subject of m.structural.subjects.filter((item) =>
      ["s:anon1", "s:anon2"].includes(item.id),
    ))
      delete subject.iri;
    m.structural.roles.push({
      id: "anon2-class",
      kind: "class",
      subject: "s:anon2",
    });
    m.structural.ontology.annotations = [
      annotation({ kind: "subject", subject: "s:anon1" }),
    ];
    add(
      "anonymous-value-target-with-distinguishing-role",
      m,
      "AnnotationValue:subject",
      "subject",
      ["structural", "ontology", "annotations", 0, "value"],
      "s:anon1",
      "s:anon2",
    );
  }
  function literalOwner(kind) {
    const m = model();
    signatures(m);
    m.role("dp", "data-property");
    m.expression("literal-owner", "data-enumeration", {
      members: [kind === "typed" ? typed() : language()],
    });
    m.fact("range-owner", "data-range", {
      property: "dp",
      target: "literal-owner",
    });
    return m;
  }
  for (const [kind, fields] of [
    [
      "typed",
      [
        ["lexical", "", "after"],
        ["datatype", IRIS.string, "urn:mapping-pair:D"],
      ],
    ],
    [
      "language",
      [
        ["lexical", "", "after"],
        ["language", "en", "fr"],
      ],
    ],
  ])
    for (const [field, before, after] of fields) {
      add(
        `literal-${kind}-${field}`,
        literalOwner(kind),
        `Literal:${kind}`,
        field,
        ["structural", "expressions", 0, "members", 0],
        before,
        after,
      );
    }
  for (const [field, before, after] of [
    ["facet", "urn:mapping-pair:facet-before", "urn:mapping-pair:facet-after"],
    ["value", typed(), typed("after")],
  ]) {
    const m = model();
    signatures(m);
    m.role("dp", "data-property");
    m.expression("facet-owner", "datatype-restriction", {
      datatype: "D",
      facets: [{ facet: "urn:mapping-pair:facet-before", value: typed() }],
    });
    m.fact("range-owner", "data-range", {
      property: "dp",
      target: "facet-owner",
    });
    add(
      `facet-${field}`,
      m,
      "Facet",
      field,
      ["structural", "expressions", 0, "facets", 0],
      before,
      after,
    );
  }
  {
    const m = model();
    signatures(m);
    m.role("i", "individual");
    m.fact("anchor", "assertion-anchor", {
      assertion: { kind: "declaration", role: "i" },
      annotations: [annotation()],
    });
    add(
      "assertion-anchor-annotation-set",
      m,
      "Construct:assertion-anchor",
      "annotations",
      ["structural", "constructs", 0],
      [annotation()],
      [annotation(typed("after"))],
    );
  }
  function artifact() {
    const m = model();
    m.role("A", "class");
    m.role("B", "class");
    projectFixture(m.source);
    m.source.visualization = {
      placements: m.structural.occurrences.map((item, index) => ({
        occurrence: item.id,
        position: { x: index * 10, y: 0 },
        pinned: false,
      })),
      camera: { center: { x: 0, y: 0 }, zoom: 1 },
      hidden: [],
      labelSelection: { mode: "iri" },
      prefixes: [{ prefix: "p", iri: "urn:mapping-pair:" }],
      display: {
        compactNotation: false,
        nodeScaling: "uniform",
        externalColoring: false,
      },
    };
    return m;
  }
  for (const [
    id,
    descriptor,
    field,
    path,
    before,
    after,
    additionalObligations,
  ] of [
    [
      "placement-pin",
      "Placement",
      "pinned",
      ["visualization", "placements", 0],
      false,
      true,
      [],
    ],
    [
      "placement-y",
      "Point",
      "y",
      ["visualization", "placements", 0, "position"],
      0,
      5,
      [],
    ],
    [
      "camera-center",
      "Camera",
      "center",
      ["visualization", "camera"],
      { x: 0, y: 0 },
      { x: 12, y: -4 },
      ["mapping/Visualization/camera"],
    ],
    ["camera-zoom", "Camera", "zoom", ["visualization", "camera"], 1, 2, []],
    [
      "selection-iri-to-untagged",
      "LabelSelection:iri",
      "mode",
      ["visualization", "labelSelection"],
      "iri",
      "untagged",
      [
        "mapping/LabelSelection:untagged/mode",
        "mapping/Visualization/labelSelection",
      ],
    ],
    [
      "prefix-name",
      "PrefixBinding",
      "prefix",
      ["visualization", "prefixes", 0],
      "p",
      "",
      ["mapping/Visualization/prefixes"],
    ],
    [
      "prefix-iri",
      "PrefixBinding",
      "iri",
      ["visualization", "prefixes", 0],
      "urn:mapping-pair:",
      "urn:mapping-alternative:",
      [],
    ],
    [
      "display-compact",
      "Display",
      "compactNotation",
      ["visualization", "display"],
      false,
      true,
      ["mapping/Visualization/display"],
    ],
    [
      "display-scaling",
      "Display",
      "nodeScaling",
      ["visualization", "display"],
      "uniform",
      "direct-membership",
      [],
    ],
    [
      "display-external",
      "Display",
      "externalColoring",
      ["visualization", "display"],
      false,
      true,
      [],
    ],
  ])
    add(id, artifact(), descriptor, field, path, before, after, {
      additionalObligations,
    });
  {
    const m = artifact();
    m.source.visualization.labelSelection = { mode: "language", range: "en" };
    add(
      "selection-language-range",
      m,
      "LabelSelection:language",
      "range",
      ["visualization", "labelSelection"],
      "en",
      "fr",
    );
  }
  {
    const m = artifact(),
      before = structuredClone(m.source),
      after = structuredClone(m.source);
    const first = after.visualization.placements[0].occurrence;
    after.visualization.placements[0].occurrence =
      after.visualization.placements[1].occurrence;
    after.visualization.placements[1].occurrence = first;
    pairs.push({
      id: "placement-occurrence-bijection",
      descriptor: "Placement",
      field: "occurrence",
      path: ["visualization", "placements", 0],
      obligation: "mapping/Placement/occurrence",
      profile: profiles.artifact,
      before,
      after,
      companionReason:
        "B3 requires exactly one placement per positionable occurrence, so swapping the other placement reference is mandatory for valid state.",
    });
  }
  return pairs;
}

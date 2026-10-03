import { createNodeMap } from "../elements/nodes/nodeMap.js";
import { createPropertyMap } from "../elements/properties/propertyMap.js";
import { createAttributeParser } from "./attributeParser.js";

const nodeTypes = {
  class: "owl:Class",
  "rdf-class": "rdfs:Class",
  datatype: "rdfs:Datatype",
  "class-union": "owl:unionOf",
  "class-intersection": "owl:intersectionOf",
  "class-complement": "owl:complementOf",
};
const builtinTypes = new Map([
  ["http://www.w3.org/2002/07/owl#Thing", "owl:Thing"],
  ["http://www.w3.org/2002/07/owl#Nothing", "owl:Nothing"],
  ["http://www.w3.org/2000/01/rdf-schema#Resource", "rdfs:Resource"],
  ["http://www.w3.org/2000/01/rdf-schema#Literal", "rdfs:Literal"],
]);
const propertyTypes = {
  "object-property": "owl:ObjectProperty",
  "data-property": "owl:DatatypeProperty",
  "rdf-property": "rdf:Property",
};

/** Materialize existing SVG primitives directly from authoritative drawing rows. */
export function createCanonicalRenderElements(graph, drawing) {
  const nodeMap = createNodeMap();
  const propertyMap = createPropertyMap();
  const attributes = createAttributeParser();
  const elements = new Map();
  const bindings = new Map();
  function position(element, placement) {
    element.x = placement.position.x;
    element.y = placement.position.y;
    element.px = element.x;
    element.py = element.y;
    element.pinned(placement.pinned);
  }
  function named(element, value, id) {
    element.id(id).label(value.name).iri(value.iri);
    return element;
  }
  function nodeType(member) {
    return builtinTypes.get(member.iri) ?? nodeTypes[member.kind];
  }
  const nodes = drawing.nodes.map((row) => {
    const Prototype = nodeMap.get(nodeType(row.principal));
    if (!Prototype) {
      throw new TypeError("Unsupported admitted node drawing kind.");
    }
    const element = named(new Prototype(graph), row.principal, row.occurrence);
    element.equivalents(
      row.aliases.map((alias) => {
        const Alias = nodeMap.get(nodeType(alias));
        return named(
          new Alias(graph),
          alias,
          `${row.occurrence}:alias:${alias.record}`,
        );
      }),
    );
    if (row.radiusFactor !== undefined) {
      // Canonical B5 supplies the complete radius factor, including generic nodes.
      // The legacy individual list stays empty; it must not scale this a second time.
      element.radius(50 * row.radiusFactor);
    }
    const styles = [...element.attributes()];
    if (row.principal.externalStyle) {
      styles.push("external");
    }
    if (!row.principal.iri && !row.operator) {
      styles.push("anonymous");
    }
    element.attributes(styles);
    attributes.parseClassAttributes(element);
    if (row.additionalOperands?.length) {
      element.indications([
        ...element.indications(),
        "additional operands in details",
      ]);
    }
    position(element, row);
    elements.set(row.occurrence, element);
    bindings.set(row.occurrence, {
      occurrence: row.occurrence,
      records: [...row.targets],
      positionable: true,
    });
    return element;
  });
  const labelsByEdge = new Map();
  for (const label of drawing.labels) {
    const labels = labelsByEdge.get(label.edge) ?? [];
    labels.push(label);
    labelsByEdge.set(label.edge, labels);
  }
  const properties = [];
  for (const edge of drawing.edges) {
    if (edge.hidden) {
      continue;
    }
    const labels = labelsByEdge.get(edge.occurrence) ?? [];
    const rows = labels.length ? labels : [undefined];
    for (const label of rows) {
      const type =
        edge.kind === "operator-edge"
          ? "setOperatorProperty"
          : edge.kind === "disjoint-edge"
            ? "owl:disjointWith"
            : edge.kind === "subclass-edge"
              ? "rdfs:subClassOf"
              : propertyTypes[label.principal.kind];
      const Prototype = propertyMap.get(type);
      if (!Prototype) {
        throw new TypeError("Unsupported admitted edge drawing kind.");
      }
      const property = new Prototype(graph);
      const reverse = label?.direction === "reverse";
      const from = elements.get(reverse ? edge.to : edge.from);
      const to = elements.get(reverse ? edge.from : edge.to);
      if (!from || !to) {
        throw new TypeError("Missing admitted drawing endpoint.");
      }
      const id = label?.occurrence ?? edge.occurrence;
      property.id(id).domain(from).range(to);
      if (label) {
        property.label(label.name).iri(label.principal?.iri);
        if (label.principal?.externalStyle) {
          property.attributes([...property.attributes(), "external"]);
        }
        attributes.parsePropertyAttributes(property);
        property.labelVisible(!label.hidden && Boolean(label.name));
        property.cardinality(label.cardinality);
        property.equivalents(
          label.aliases.map((alias) => {
            const Alias = propertyMap.get(propertyTypes[alias.kind]);
            return named(
              new Alias(graph),
              alias,
              `${id}:alias:${alias.record}`,
            );
          }),
        );
        property.indications(
          label.characteristics.map((value) => value.replaceAll("-", " ")),
        );
        position(property, label);
      } else {
        // Edge decorations have derived geometry, never independent scene state.
        position(property, {
          position: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
          pinned: false,
        });
      }
      // An inverse occurrence has two routed directions, each bound to its own
      // label placement. Legacy inverse pairing would collapse those placements.
      bindings.set(id, {
        occurrence: edge.occurrence,
        ...(label
          ? { label: label.occurrence, direction: label.direction }
          : {}),
        records: [...(label?.records ?? edge.records)],
        positionable: Boolean(label),
      });
      properties.push(property);
    }
  }
  const visibleNodes = new Set(
    drawing.nodes.filter((row) => !row.hidden).map((row) => row.occurrence),
  );
  return {
    nodes: nodes.filter((node) => visibleNodes.has(node.id())),
    properties,
    bindings,
  };
}

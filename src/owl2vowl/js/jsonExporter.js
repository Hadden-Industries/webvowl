function isIriExternal(iri, headerIri) {
  if (!iri) {
    return false;
  }
  if (
    iri === "http://www.w3.org/2000/01/rdf-schema#Literal" ||
    iri === "http://www.w3.org/2002/07/owl#Thing"
  ) {
    return false;
  }

  if (
    iri.startsWith("http://www.w3.org/2002/07/owl#") ||
    iri.startsWith("http://www.w3.org/1999/02/22-rdf-syntax-ns#") ||
    iri.startsWith("http://www.w3.org/2000/01/rdf-schema#")
  ) {
    return true;
  }

  if (!headerIri) {
    return false;
  }

  function removeTrailingHash(str) {
    return str.replace(/[#]$/, "");
  }

  const trimmedElementIri = removeTrailingHash(iri);
  const trimmedOntologyIri = removeTrailingHash(headerIri);

  if (trimmedElementIri === trimmedOntologyIri) {
    return false;
  }

  if (trimmedElementIri.includes("#")) {
    const parts = trimmedElementIri.split("#");
    if (parts[0] === trimmedOntologyIri) {
      return false;
    }
  }

  if (trimmedElementIri.includes("/") && !trimmedElementIri.endsWith("/")) {
    const lastSlashIndex = trimmedElementIri.lastIndexOf("/");
    const indexAfterSlash = lastSlashIndex + 1;
    const elementNamespaceWithoutLastPart = trimmedElementIri.substring(
      0,
      indexAfterSlash,
    );

    if (elementNamespaceWithoutLastPart === trimmedOntologyIri) {
      return false;
    }
  }

  return true;
}

function shouldSkipDatatype(cls, connectedNodeIds, connectedDatatypeIris) {
  if (
    cls.iri === "http://www.w3.org/2000/01/rdf-schema#Literal" &&
    !connectedNodeIds.has(String(cls.id))
  ) {
    return true;
  }
  if (cls.type !== "rdfs:Datatype" && cls.type !== "rdfs:Literal") {
    return false;
  }
  if (connectedNodeIds.has(String(cls.id))) {
    return false;
  }
  if (cls.iri && connectedDatatypeIris.has(cls.iri)) {
    return true;
  }
  return false;
}

function createVirtualDatatype(datatypeIri, resolver, context) {
  const cls = context.classMap.get(datatypeIri);
  const virtualId = context.nextId();
  const label =
    cls && cls.label
      ? JSON.parse(JSON.stringify(cls.label))
      : { undefined: resolver.getLocalName(datatypeIri) };
  if (!label["undefined"]) {
    label["undefined"] = resolver.getLocalName(datatypeIri);
  }
  const virtualCls = {
    id: virtualId,
    type:
      datatypeIri === "http://www.w3.org/2000/01/rdf-schema#Literal"
        ? "rdfs:Literal"
        : "rdfs:Datatype",
    iri: datatypeIri,
    baseIri:
      datatypeIri === "http://www.w3.org/2000/01/rdf-schema#Literal"
        ? undefined
        : cls
          ? cls.baseIri
          : resolver.getBaseIri(datatypeIri),
    label: label,
    comment: cls && cls.comment ? JSON.parse(JSON.stringify(cls.comment)) : {},
    attributes:
      datatypeIri === "http://www.w3.org/2000/01/rdf-schema#Literal"
        ? []
        : ["datatype"],
    subClasses: [],
    superClasses: [],
    annotations: cls && cls.annotations ? cls.annotations : {},
  };
  context.virtualDatatypes.push(virtualCls);
  return virtualId;
}

/**
 * Serializes the converted VOWL parser contexts into a structured VOWL-JSON document.
 * @param {PerformanceIriResolver} resolver
 * @param {VowlParserContext} context
 * @param {object} header
 * @returns {object}
 */
export function exportToJson(resolver, context, header) {
  const subclassProperties = [];
  const exportedSubclassPairs = new Set();
  context.subclassRelations.forEach((rel) => {
    if (rel.superclassIri === "http://www.w3.org/2002/07/owl#Thing") {
      return;
    }
    const subCls = context.classMap.get(rel.subclassIri);
    const superCls = context.classMap.get(rel.superclassIri);

    if (subCls && superCls && subCls.id !== superCls.id) {
      const pairKey = String(subCls.id) + ":" + String(superCls.id);
      if (!exportedSubclassPairs.has(pairKey)) {
        exportedSubclassPairs.add(pairKey);
        const propId = context.nextId();
        subclassProperties.push({
          property: { id: propId, type: "rdfs:SubClassOf" },
          attribute: {
            id: propId,
            iri: "http://www.w3.org/2000/01/rdf-schema#subClassOf",
            baseIri: "http://www.w3.org/2000/01/rdf-schema",
            domain: subCls.id,
            range: superCls.id,
            attributes: ["transitive"],
          },
        });
      }
    }
  });

  const restrictionProperties = [];
  const exportedRestrictionKeys = new Set();
  context.parsedRestrictions.forEach((rest) => {
    const subCls = context.classMap.get(rest.domainIri);
    const superCls = context.classMap.get(rest.rangeIri);

    if (subCls && superCls) {
      const restKey = `${subCls.id}:${rest.propertyIri}:${superCls.id}:${rest.type}`;
      if (exportedRestrictionKeys.has(restKey)) {
        return;
      }
      exportedRestrictionKeys.add(restKey);

      const refProp = context.propertyMap.get(rest.propertyIri);
      const propId = context.nextId();
      const attributes = ["object"];
      if (rest.type === "owl:someValuesFrom" || rest.type === "owl:hasValue") {
        attributes.push("someValuesFrom");
      } else if (rest.type === "owl:allValuesFrom") {
        attributes.push("allValuesFrom");
      }
      if (!attributes.includes("inferred")) {
        attributes.push("inferred");
      }

      if (refProp && refProp.attributes) {
        refProp.attributes.forEach((attr) => {
          if (!attributes.includes(attr)) {
            attributes.push(attr);
          }
        });
      }

      const refPropIri = refProp ? refProp.iri : rest.propertyIri;
      const refPropBaseIri = refProp
        ? refProp.baseIri
        : resolver.getBaseIri(rest.propertyIri);
      const refPropLabel =
        refProp && refProp.label
          ? refProp.label
          : { undefined: resolver.getLocalName(rest.propertyIri) };

      let resolvedRangeId = superCls.id;
      if (
        superCls.type === "rdfs:Datatype" ||
        superCls.type === "rdfs:Literal" ||
        rest.rangeIri === "http://www.w3.org/2000/01/rdf-schema#Literal"
      ) {
        resolvedRangeId = createVirtualDatatype(
          rest.rangeIri,
          resolver,
          context,
        );
      }

      const restProp = {
        property: {
          id: propId,
          type: rest.type === "owl:hasValue" ? "owl:someValuesFrom" : rest.type,
        },
        attribute: {
          id: propId,
          iri: refPropIri,
          baseIri: refPropBaseIri,
          label: Object.assign({}, refPropLabel),
          domain: subCls.id,
          range: resolvedRangeId,
          attributes: attributes,
        },
      };

      if (
        refProp &&
        refProp.comment &&
        Object.keys(refProp.comment).length > 0
      ) {
        restProp.attribute.comment = refProp.comment;
      }
      if (
        refProp &&
        refProp.annotations &&
        Object.keys(refProp.annotations).length > 0
      ) {
        restProp.attribute.annotations = refProp.annotations;
      }

      restrictionProperties.push(restProp);
    }
  });

  const connectedNodeIds = new Set();
  context.propertyMap.forEach((prop) => {
    if (prop.domain) {
      connectedNodeIds.add(String(prop.domain));
    }
    if (prop.range) {
      connectedNodeIds.add(String(prop.range));
    }
  });
  subclassProperties.forEach((subProp) => {
    if (subProp.attribute.domain) {
      connectedNodeIds.add(String(subProp.attribute.domain));
    }
    if (subProp.attribute.range) {
      connectedNodeIds.add(String(subProp.attribute.range));
    }
  });
  restrictionProperties.forEach((rp) => {
    if (rp.attribute.domain) {
      connectedNodeIds.add(String(rp.attribute.domain));
    }
    if (rp.attribute.range) {
      connectedNodeIds.add(String(rp.attribute.range));
    }
  });
  context.classMap.forEach((cls) => {
    if (cls.disjointWith && cls.disjointWith.length > 0) {
      cls.disjointWith.forEach((targetIri) => {
        const targetCls = context.classMap.get(targetIri);
        if (targetCls) {
          connectedNodeIds.add(String(cls.id));
          connectedNodeIds.add(String(targetCls.id));
        }
      });
    }
  });

  const connectedDatatypeIris = new Set();
  context.classMap.forEach((cls) => {
    if (cls.type === "rdfs:Datatype" && connectedNodeIds.has(String(cls.id))) {
      if (cls.iri) {
        connectedDatatypeIris.add(cls.iri);
      }
    }
  });
  context.virtualDatatypes.forEach((cls) => {
    if (connectedNodeIds.has(String(cls.id))) {
      if (cls.iri) {
        connectedDatatypeIris.add(cls.iri);
      }
    }
  });

  const classesArray = [];
  const classAttributesArray = [];
  const disjointProperties = [];
  const exportedDisjointPairs = new Set();

  function exportClassNode(cls) {
    if (shouldSkipDatatype(cls, connectedNodeIds, connectedDatatypeIris)) {
      return;
    }

    const isAnonymous = !cls.iri || cls.iri.startsWith("_:");

    if (isAnonymous && !connectedNodeIds.has(String(cls.id))) {
      return;
    }

    classesArray.push({ id: cls.id, type: cls.type });
    const attr = { id: cls.id };

    if (!isAnonymous) {
      attr.iri = cls.iri;
      attr.baseIri = cls.baseIri;
      attr.instances = cls.individuals ? cls.individuals.length : 0;
      attr.label = cls.label;
      if (cls.annotations && Object.keys(cls.annotations).length > 0) {
        attr.annotations = cls.annotations;
      }
      if (cls.comment && Object.keys(cls.comment).length > 0) {
        attr.comment = cls.comment;
      }
      if (cls.individuals && cls.individuals.length > 0) {
        attr.individuals = cls.individuals;
      }
    }

    if (cls.attributes && cls.attributes.length > 0) {
      attr.attributes = cls.attributes;
    }
    if (cls.subClasses && cls.subClasses.length > 0) {
      attr.subClasses = cls.subClasses;
    }
    if (cls.superClasses && cls.superClasses.length > 0) {
      attr.superClasses = cls.superClasses;
    }
    if (cls.union) {
      attr.union = cls.union;
    }
    if (cls.intersection && cls.intersection.length > 0) {
      attr.intersection = cls.intersection;
    }
    if (cls.complement) {
      attr.complement = Array.isArray(cls.complement)
        ? cls.complement
        : [cls.complement];
    }
    if (cls.disjointUnion && cls.disjointUnion.length > 0) {
      attr.disjointUnion = cls.disjointUnion;
    }
    if (cls.equivalent && cls.equivalent.length > 0) {
      attr.equivalent = cls.equivalent;
    }
    classAttributesArray.push(attr);

    if (cls.disjointWith && cls.disjointWith.length > 0) {
      cls.disjointWith.forEach((targetIri) => {
        const targetCls = context.classMap.get(targetIri);
        if (targetCls) {
          const pairKey = [String(cls.id), String(targetCls.id)]
            .sort()
            .join(":");
          if (!exportedDisjointPairs.has(pairKey)) {
            exportedDisjointPairs.add(pairKey);
            const propId = context.nextId();
            disjointProperties.push({
              property: { id: propId, type: "owl:disjointWith" },
              propertyAttribute: {
                id: propId,
                domain: cls.id,
                range: targetCls.id,
                attributes: ["object", "anonymous"],
              },
            });
          }
        }
      });
    }
  }

  context.classMap.forEach(exportClassNode);
  if (context.virtualThings) {
    context.virtualThings.forEach(exportClassNode);
  }

  context.virtualDatatypes.forEach((cls) => {
    if (shouldSkipDatatype(cls, connectedNodeIds, connectedDatatypeIris)) {
      return;
    }
    if (
      isIriExternal(cls.iri, header.iri) &&
      !cls.attributes.includes("external")
    ) {
      cls.attributes.push("external");
    }
    classesArray.push({ id: cls.id, type: cls.type });
    const attr = {
      id: cls.id,
      iri: cls.iri,
      baseIri: cls.baseIri,
      label: cls.label || { undefined: "Datatype" },
      attributes: cls.attributes,
    };
    if (cls.annotations && Object.keys(cls.annotations).length > 0) {
      attr.annotations = cls.annotations;
    }
    if (cls.comment && Object.keys(cls.comment).length > 0) {
      attr.comment = cls.comment;
    }
    classAttributesArray.push(attr);
  });

  const propertiesArray = [];
  const propertyAttributesArray = [];

  context.propertyMap.forEach((prop) => {
    if (prop.skipExport) {
      return;
    }

    propertiesArray.push({ id: prop.id, type: prop.type });
    const attr = {
      id: prop.id,
      iri: prop.iri,
      baseIri: prop.baseIri,
      label: prop.label || { undefined: "Property" },
      domain: prop.domain,
      range: prop.range,
      attributes: prop.attributes,
    };
    if (Object.keys(prop.comment).length > 0) {
      attr.comment = prop.comment;
    }
    if (prop.annotations && Object.keys(prop.annotations).length > 0) {
      attr.annotations = prop.annotations;
    }
    if (prop.superproperty.length > 0) {
      attr.superproperty = prop.superproperty;
    }
    if (prop.subproperty.length > 0) {
      attr.subproperty = prop.subproperty;
    }
    if (prop.inverse) {
      attr.inverse = prop.inverse;
    }
    if (prop.minCardinality !== undefined) {
      attr.minCardinality = prop.minCardinality;
    }
    if (prop.maxCardinality !== undefined) {
      attr.maxCardinality = prop.maxCardinality;
    }
    if (prop.cardinality !== undefined) {
      attr.cardinality = prop.cardinality;
    }
    if (prop.equivalentProperties && prop.equivalentProperties.length > 0) {
      attr.equivalent = [];
      if (!attr.attributes.includes("equivalent")) {
        attr.attributes.push("equivalent");
      }
      prop.equivalentProperties.forEach((equivIri) => {
        const equivProp = context.propertyMap.get(equivIri);
        if (equivProp) {
          attr.equivalent.push(equivProp.id);
          if (!equivProp.attributes.includes("equivalent")) {
            equivProp.attributes.push("equivalent");
          }
        }
      });
    }
    propertyAttributesArray.push(attr);
  });

  subclassProperties.forEach((subProp) => {
    propertiesArray.push(subProp.property);
    propertyAttributesArray.push(subProp.attribute);
  });

  disjointProperties.forEach((dp) => {
    propertiesArray.push(dp.property);
    propertyAttributesArray.push(dp.propertyAttribute);
  });

  restrictionProperties.forEach((rp) => {
    propertiesArray.push(rp.property);
    propertyAttributesArray.push(rp.attribute);
  });

  const metrics = {
    classCount: 0,
    datatypeCount: 0,
    objectPropertyCount: 0,
    datatypePropertyCount: 0,
    propertyCount: propertiesArray.length,
    nodeCount: classesArray.length,
    individualCount: 0,
  };

  classesArray.forEach((c) => {
    if (c.type === "owl:Class") {
      metrics.classCount++;
    }
    if (c.type === "rdfs:Datatype") {
      metrics.datatypeCount++;
    }
  });

  propertiesArray.forEach((p) => {
    if (
      p.type === "owl:objectProperty" ||
      p.type === "owl:someValuesFrom" ||
      p.type === "owl:allValuesFrom" ||
      p.type === "owl:hasValue"
    ) {
      metrics.objectPropertyCount++;
    }
    if (p.type === "owl:datatypeProperty") {
      metrics.datatypePropertyCount++;
    }
  });

  let totalIndividualCount = 0;
  context.classMap.forEach((cls) => {
    if (cls.individuals) {
      totalIndividualCount += cls.individuals.length;
    }
  });
  metrics.individualCount = totalIndividualCount;

  const usedNamespaces = new Set();
  context.classMap.forEach((c) => {
    if (c.iri) {
      usedNamespaces.add(resolver.getBaseIri(c.iri));
    }
  });
  context.propertyMap.forEach((p) => {
    if (p.iri) {
      usedNamespaces.add(resolver.getBaseIri(p.iri));
    }
  });

  const reserved = [
    "http://www.w3.org/2002/07/owl",
    "http://www.w3.org/1999/02/22-rdf-syntax-ns",
    "http://www.w3.org/2000/01/rdf-schema",
    "http://www.w3.org/2001/XMLSchema",
  ];
  usedNamespaces.forEach((ns) => {
    if (ns && !reserved.includes(ns) && !ns.startsWith("_:")) {
      header.baseIris.push(ns);
    }
  });

  header.baseIris = Array.from(
    new Set(header.baseIris.filter((b) => b && !b.startsWith("_:"))),
  );
  header.baseIris.sort();

  return {
    _comment: "Created with client-side JS-OWL2VOWL parser",
    header: header,
    namespace: [],
    metrics: metrics,
    class: classesArray,
    classAttribute: classAttributesArray,
    property: propertiesArray,
    propertyAttribute: propertyAttributesArray,
  };
}

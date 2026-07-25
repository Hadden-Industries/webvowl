import { NAMESPACES, IGNORED_PROPERTIES } from "./constants.js";

function isVowlId(str) {
  if (typeof str !== "string") {return false;}
  return /^\d+$/.test(str);
}

function isDatatypeIri(iri, resolver) {
  if (!iri) {return false;}
  if (iri === "http://www.w3.org/2000/01/rdf-schema#Literal") {return false;}
  if (iri.startsWith("http://www.w3.org/2001/XMLSchema#")) {return true;}
  if (iri.startsWith("http://www.w3.org/1999/02/22-rdf-syntax-ns#")) {
    const local = resolver.getLocalName(iri);
    return ["PlainLiteral", "XMLLiteral", "HTML", "langString"].includes(local);
  }
  if (iri.startsWith("http://www.w3.org/2002/07/owl#")) {
    const local = resolver.getLocalName(iri);
    return ["real", "rational"].includes(local);
  }
  return false;
}

function isIriExternal(iri, headerIri) {
  if (!iri) {return false;}
  if (iri === "http://www.w3.org/2000/01/rdf-schema#Literal" || iri === "http://www.w3.org/2002/07/owl#Thing") {
    return false;
  }
  
  if (iri.startsWith("http://www.w3.org/2002/07/owl#") || 
      iri.startsWith("http://www.w3.org/1999/02/22-rdf-syntax-ns#") || 
      iri.startsWith("http://www.w3.org/2000/01/rdf-schema#")) {
    return true;
  }
  
  if (!headerIri) {return false;}
  
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
    const elementNamespaceWithoutLastPart = trimmedElementIri.substring(0, indexAfterSlash);
    
    if (elementNamespaceWithoutLastPart === trimmedOntologyIri) {
      return false;
    }
  }
  
  return true;
}

function getClassId(ref, context) {
  if (isVowlId(ref)) {return ref;}
  let cls = context.classMap.get(ref);
  if (!cls) {cls = context.classMap.get("http://www.w3.org/2002/07/owl#Thing");}
  return cls ? cls.id : "0";
}

function createVirtualDatatype(datatypeIri, resolver, context) {
  const cls = context.classMap.get(datatypeIri);
  const virtualId = context.nextId();
  const label = cls && cls.label ? JSON.parse(JSON.stringify(cls.label)) : { "undefined": resolver.getLocalName(datatypeIri) };
  if (!label["undefined"]) {
    label["undefined"] = resolver.getLocalName(datatypeIri);
  }
  const virtualCls = {
    id: virtualId,
    type: datatypeIri === "http://www.w3.org/2000/01/rdf-schema#Literal" ? "rdfs:Literal" : "rdfs:Datatype",
    iri: datatypeIri,
    baseIri: datatypeIri === "http://www.w3.org/2000/01/rdf-schema#Literal" ? undefined : (cls ? cls.baseIri : resolver.getBaseIri(datatypeIri)),
    label: label,
    comment: cls && cls.comment ? JSON.parse(JSON.stringify(cls.comment)) : {},
    attributes: datatypeIri === "http://www.w3.org/2000/01/rdf-schema#Literal" ? [] : ["datatype"],
    subClasses: [],
    superClasses: [],
    annotations: cls && cls.annotations ? cls.annotations : {}
  };
  context.virtualDatatypes.push(virtualCls);
  return virtualId;
}

function ensureClassExists(iri, type = "owl:Class", resolver, context) {
  if (isDatatypeIri(iri, resolver)) {
    type = "rdfs:Datatype";
  }
  if (iri && context.classMap.has(iri)) {
    const cls = context.classMap.get(iri);
    if (type === "owl:unionOf" && cls.type === "owl:Class") {
      cls.type = "owl:unionOf";
    }
    if (type === "rdfs:Datatype" && cls.type === "owl:Class") {
      cls.type = "rdfs:Datatype";
      if (!cls.attributes.includes("datatype")) {
        cls.attributes.push("datatype");
      }
    }
    return cls;
  }
  const id = context.nextId();
  
  const isAnonymous = type === "owl:unionOf";
  const attributes = [];
  if (isAnonymous) {attributes.push("anonymous");}
  if (type === "rdfs:Datatype") {attributes.push("datatype");}

  const cls = {
    id: id,
    type: type === "owl:unionOf" ? "owl:unionOf" : type,
    iri: iri,
    baseIri: iri ? resolver.getBaseIri(iri) : null,
    label: iri ? { "undefined": resolver.getLocalName(iri) } : {},
    comment: {},
    attributes: attributes,
    subClasses: [],
    superClasses: [],
    individuals: []
  };
  if (iri) {
    context.classMap.set(iri, cls);
  } else {
    context.classMap.set(id, cls);
  }
  return cls;
}

function ensurePropertyExists(iri, type = "owl:objectProperty", resolver, context) {
  if (context.propertyMap.has(iri)) {
    return context.propertyMap.get(iri);
  }
  const id = context.nextId();
  const localName = resolver.getLocalName(iri);
  const baseIri = resolver.getBaseIri(iri);
  const attributes = [type === "owl:datatypeProperty" ? "datatype" : "object"];
  const prop = {
    id: id,
    type: type,
    iri: iri,
    baseIri: baseIri,
    label: { "undefined": localName },
    comment: {},
    attributes: attributes,
    domain: null,
    range: null,
    superproperty: [],
    subproperty: [],
    inverse: null
  };
  context.propertyMap.set(iri, prop);
  return prop;
}

/**
 * Runs the semantic transformation and mutates the context and header objects.
 * @param {object} subjects
 * @param {Set} languagesSet
 * @param {PerformanceIriResolver} resolver
 * @param {VowlParserContext} context
 * @param {object} header
 */
export function convertOntology(subjects, languagesSet, resolver, context, header) {
  const inferredClasses = new Set();

  const isNonVisualSubject = (iri) => {
    const subject = subjects[iri];
    if (!subject) {return false;}
    const types = subject.types;
    if (!types) {return false;}
    if (
      types.has(NAMESPACES.OWL + "Restriction") ||
      types.has(NAMESPACES.OWL + "Axiom") ||
      types.has(NAMESPACES.OWL + "Annotation") ||
      types.has(NAMESPACES.OWL + "AllDisjointClasses") ||
      types.has(NAMESPACES.OWL + "AllDifferent") ||
      types.has(NAMESPACES.OWL + "NegativePropertyAssertion") ||
      types.has(NAMESPACES.RDF + "List") ||
      types.has(NAMESPACES.RDF + "Description")
    ) {
      return true;
    }
    if (subject.annotations && subject.annotations["onProperty"] !== undefined) {
      return true;
    }
    return false;
  };

  // Populate inferred classes from explicit declarations
  for (const iri of Object.keys(subjects)) {
    if (isNonVisualSubject(iri)) {continue;}
    const subject = subjects[iri];
    for (const type of subject.types) {
      if (
        type === NAMESPACES.OWL + "Class" ||
        type === NAMESPACES.RDFS + "Class" ||
        type === NAMESPACES.OWL + "DeprecatedClass"
      ) {
        inferredClasses.add(iri);
      }
    }
  }

  // Infers class status from usage relationships
  for (const iri of Object.keys(subjects)) {
    if (isNonVisualSubject(iri)) {continue;}
    const subject = subjects[iri];

    if (subject.superClasses.length > 0) {
      // Avoid inferring anonymous union/intersection classes whose members are all anonymous restrictions
      const isStructuralAnonUnion = (supIri) => {
        const supSubject = subjects[supIri];
        return supIri.startsWith("_:") && supSubject && (
          supSubject.unionOf || supSubject.intersectionOf
        ) && (() => {
          const members = supSubject.unionOf || supSubject.intersectionOf;
          return Array.isArray(members) && members.length > 0 &&
            members.every(m => m.startsWith("_:") && subjects[m] && (
              subjects[m].types.has(NAMESPACES.OWL + "Restriction") ||
              (subjects[m].annotations && subjects[m].annotations["onProperty"] !== undefined)
            ));
        })();
      };

      inferredClasses.add(iri);
      subject.superClasses.forEach(sup => {
        if (sup && !isNonVisualSubject(sup) && !isVowlId(sup) && !isStructuralAnonUnion(sup)) {
          inferredClasses.add(sup);
        }
      });
    }

    if (subject.equivalentClasses.length > 0) {
      inferredClasses.add(iri);
      subject.equivalentClasses.forEach(eq => {
        if (eq && !isNonVisualSubject(eq) && !isVowlId(eq)) {inferredClasses.add(eq);}
      });
    }

    if (subject.disjointWith.length > 0) {
      inferredClasses.add(iri);
      subject.disjointWith.forEach(dj => {
        if (dj && !isNonVisualSubject(dj) && !isVowlId(dj)) {inferredClasses.add(dj);}
      });
    }
  }

  context.subclassRelations.forEach(rel => {
    if (rel.subclassIri && !isNonVisualSubject(rel.subclassIri)) {inferredClasses.add(rel.subclassIri);}
    if (rel.superclassIri && !isNonVisualSubject(rel.superclassIri)) {inferredClasses.add(rel.superclassIri);}
  });

  context.parsedRestrictions.forEach(rest => {
    if (rest.domainIri && !isNonVisualSubject(rest.domainIri)) {inferredClasses.add(rest.domainIri);}
    if (rest.type !== "owl:hasValue" && rest.rangeIri && !isDatatypeIri(rest.rangeIri, resolver) && !isNonVisualSubject(rest.rangeIri)) {
      inferredClasses.add(rest.rangeIri);
    }
  });

  // Domains & Ranges inference
  for (const iri of Object.keys(subjects)) {
    const subject = subjects[iri];
    const types = Array.from(subject.types);
    const isProperty = types.some(t =>
      t === NAMESPACES.OWL + "ObjectProperty" ||
      t === NAMESPACES.OWL + "DatatypeProperty" ||
      t === NAMESPACES.OWL + "FunctionalProperty" ||
      t === NAMESPACES.OWL + "TransitiveProperty" ||
      t === NAMESPACES.OWL + "SymmetricProperty" ||
      t === NAMESPACES.RDF + "Property"
    );

    if (isProperty) {
      subject.domains.forEach(dom => {
        if (dom && !isNonVisualSubject(dom) && !isVowlId(dom)) {inferredClasses.add(dom);}
      });
      const isDatatypeProp = types.some(t => t === NAMESPACES.OWL + "DatatypeProperty") ||
                             subject.ranges.some(r => isDatatypeIri(r, resolver));
      if (!isDatatypeProp) {
        subject.ranges.forEach(ran => {
          if (ran && !isDatatypeIri(ran, resolver) && !isNonVisualSubject(ran) && !isVowlId(ran)) {inferredClasses.add(ran);}
        });
      }
    }
  }

  // Custom typing / Metaclass inference
  for (const iri of Object.keys(subjects)) {
    if (isNonVisualSubject(iri)) {continue;}
    const subject = subjects[iri];
    subject.types.forEach(t => {
      if (
        t &&
        !isNonVisualSubject(t) &&
        t !== NAMESPACES.OWL + "NamedIndividual" &&
        t !== NAMESPACES.OWL + "Ontology" &&
        t !== NAMESPACES.OWL + "Class" &&
        t !== NAMESPACES.RDFS + "Class" &&
        t !== NAMESPACES.OWL + "DeprecatedClass" &&
        t !== NAMESPACES.OWL + "ObjectProperty" &&
        t !== NAMESPACES.OWL + "DatatypeProperty" &&
        t !== NAMESPACES.OWL + "AnnotationProperty" &&
        t !== NAMESPACES.RDF + "Property" &&
        t !== NAMESPACES.RDFS + "Datatype" &&
        !isDatatypeIri(t, resolver)
      ) {
        inferredClasses.add(t);
      }
    });
  }

  // Pre-seed standard configurations
  ensureClassExists("http://www.w3.org/2002/07/owl#Thing", "owl:Thing", resolver, context);
  ensureClassExists("http://www.w3.org/2000/01/rdf-schema#Literal", "rdfs:Literal", resolver, context);

  // Identify main ontology header details
  let ontologySubject = null;
  for (const iri in subjects) {
    if (subjects[iri].types.has(NAMESPACES.OWL + "Ontology")) {
      ontologySubject = subjects[iri];
      break;
    }
  }

  // Sort dyn-constructed regional languages alphabetically
  const rawLanguages = Array.from(languagesSet).filter(l => l !== "undefined");
  rawLanguages.sort();
  const finalLanguages = [];
  if (languagesSet.has("undefined") || languagesSet.size === 0) {
    finalLanguages.push("undefined");
  }
  finalLanguages.push(...rawLanguages);

  // Populate header properties
  header.languages = finalLanguages;
  header.iri = ontologySubject ? ontologySubject.iri : "https://haddenindustries.com/ontology/newOntology/";
  
  if (ontologySubject) {
    header.title = ontologySubject.labels;
    header.description = ontologySubject.comments;

    if (Object.keys(header.title).length === 0) {
      const titles = ontologySubject.annotations["title"] || ontologySubject.annotations["label"] || [];
      titles.forEach(t => {
        header.title[t.language || "undefined"] = t.value;
      });
    }
    if (Object.keys(header.description).length === 0) {
      const descs = ontologySubject.annotations["description"] || ontologySubject.annotations["comment"] || [];
      descs.forEach(d => {
        header.description[d.language || "undefined"] = d.value;
      });
    }

    const versions = ontologySubject.annotations["versionInfo"] || [];
    if (versions.length > 0) {
      header.version = versions[0].value;
    }

    const creators = ontologySubject.annotations["creator"] || [];
    creators.forEach(c => {
      header.author.push(c.value);
    });

    header.other = ontologySubject.annotations;
  } else {
    header.title = { "en": "Ontology" };
  }

  // Merge anonymous equivalent class expressions into their named subjects
  for (const iri in subjects) {
    if (isNonVisualSubject(iri)) {continue;}
    const subject = subjects[iri];
    
    if (subject.equivalentClasses && subject.equivalentClasses.length > 0) {
      const anonEquivIris = subject.equivalentClasses.filter(eqIri => {
        const eqSub = subjects[eqIri];
        return eqSub && eqIri.startsWith("_:");
      });

      anonEquivIris.forEach(eqIri => {
        const eqSub = subjects[eqIri];
        
        if (eqSub.unionOf && !subject.unionOf) {
          subject.unionOf = eqSub.unionOf;
        }
        if (eqSub.intersectionOf && !subject.intersectionOf) {
          subject.intersectionOf = eqSub.intersectionOf;
        }
        if (eqSub.complementOf && !subject.complementOf) {
          subject.complementOf = eqSub.complementOf;
        }
        if (eqSub.disjointUnionOf && !subject.disjointUnionOf) {
          subject.disjointUnionOf = eqSub.disjointUnionOf;
        }
        
        for (const [key, value] of Object.entries(eqSub.annotations)) {
          if (subject.annotations[key] === undefined) {
            subject.annotations[key] = value;
          }
        }

        subject.equivalentClasses = subject.equivalentClasses.filter(x => x !== eqIri);
        delete subjects[eqIri];
      });
    }
  }

  // Map Subjects to Classes, Properties & Named Individuals
  for (const iri in subjects) {
    if (IGNORED_PROPERTIES.has(iri)) {continue;}
    if (isNonVisualSubject(iri)) {continue;}

    const subject = subjects[iri];
    if (ontologySubject && iri === ontologySubject.iri) {continue;}

    const types = Array.from(subject.types);
    const isClass = inferredClasses.has(iri);
    const isDatatype = types.some(t => t === NAMESPACES.RDFS + "Datatype") || isDatatypeIri(iri, resolver);

    const isAnnotationProperty = types.some(t => t === NAMESPACES.OWL + "AnnotationProperty");
    const isProperty = !isAnnotationProperty && types.some(t =>
      t === NAMESPACES.OWL + "ObjectProperty" ||
      t === NAMESPACES.OWL + "DatatypeProperty" ||
      t === NAMESPACES.OWL + "FunctionalProperty" ||
      t === NAMESPACES.OWL + "TransitiveProperty" ||
      t === NAMESPACES.OWL + "SymmetricProperty" ||
      t === NAMESPACES.RDF + "Property"
    );

    const isExplicitNamedIndividual = types.some(t => t === NAMESPACES.OWL + "NamedIndividual");
    const isIndividual = !isClass && !isDatatype && !isProperty && (
      isExplicitNamedIndividual ||
      types.some(t => inferredClasses.has(t) || t === NAMESPACES.OWL + "Thing")
    );


    if (isClass && !isDatatype) {
      const cls = ensureClassExists(iri, "owl:Class", resolver, context);

      if (Object.keys(subject.labels).length > 0) {
        cls.label = Object.assign({}, subject.labels);
        if (!cls.label["undefined"]) {
          cls.label["undefined"] = resolver.getLocalName(iri);
        }
      } else {
        cls.label = { "undefined": resolver.getLocalName(iri) };
      }
      cls.comment = subject.comments;
      cls.annotations = subject.annotations;
      cls.disjointWith = subject.disjointWith;

      if (types.some(t => t === NAMESPACES.OWL + "DeprecatedClass")) {
        if (!cls.attributes.includes("deprecated")) {cls.attributes.push("deprecated");}
      }

      if (subject.unionOf) {
        cls.type = "owl:unionOf";
        if (!cls.attributes.includes("union")) {cls.attributes.push("union");}
        cls.unionMembers = subject.unionOf;
      }
      if (subject.intersectionOf) {
        cls.type = "owl:intersectionOf";
        if (!cls.attributes.includes("intersection")) {cls.attributes.push("intersection");}
        cls.intersectionMembers = subject.intersectionOf;
      }
      if (subject.complementOf) {
        cls.type = "owl:complementOf";
        if (!cls.attributes.includes("complement")) {cls.attributes.push("complement");}
        cls.complementMember = subject.complementOf;
      }
      if (subject.disjointUnionOf) {
        cls.type = "owl:disjointUnionOf";
        if (!cls.attributes.includes("disjointUnion")) {cls.attributes.push("disjointUnion");}
        cls.disjointUnionMembers = subject.disjointUnionOf;
      }

      subject.superClasses.forEach(superIri => {
        const superSubject = subjects[superIri];
        const isRestriction = superSubject && (
          superSubject.types.has(NAMESPACES.OWL + "Restriction") ||
          (superSubject.annotations && superSubject.annotations["onProperty"] !== undefined)
        );
        // Suppress anonymous union/intersection superclasses where ALL members are anonymous
        // restrictions — Java treats these as structural axioms, not visual union nodes
        const isStructuralAnonymousUnion = superIri.startsWith("_:") && superSubject && (
          superSubject.unionOf || superSubject.intersectionOf
        ) && (() => {
          const members = superSubject.unionOf || superSubject.intersectionOf;
          return Array.isArray(members) && members.length > 0 &&
            members.every(m => m.startsWith("_:") && subjects[m] && (
              subjects[m].types.has(NAMESPACES.OWL + "Restriction") ||
              (subjects[m].annotations && subjects[m].annotations["onProperty"] !== undefined)
            ));
        })();
        if (!isRestriction && !isStructuralAnonymousUnion) {
          context.subclassRelations.push({ subclassIri: iri, superclassIri: superIri });
        }
      });
    } else if (isDatatype) {
      const cls = ensureClassExists(iri, "rdfs:Datatype", resolver, context);
      if (!cls.attributes.includes("datatype")) {cls.attributes.push("datatype");}
      if (Object.keys(subject.labels).length > 0) {
        cls.label = Object.assign({}, subject.labels);
        if (!cls.label["undefined"]) {
          cls.label["undefined"] = resolver.getLocalName(iri);
        }
      } else {
        cls.label = { "undefined": resolver.getLocalName(iri) };
      }
      cls.comment = subject.comments;
      cls.annotations = subject.annotations;
    } else if (isProperty) {
      let type = "owl:objectProperty";
      const attributes = ["object"];

      const isDTP = types.some(t => t === NAMESPACES.OWL + "DatatypeProperty") || 
                    (subject.ranges && subject.ranges.some(r => isDatatypeIri(r, resolver)));
      if (isDTP) {
        type = "owl:datatypeProperty";
        attributes[0] = "datatype";
      }

      if (types.some(t => t === NAMESPACES.OWL + "FunctionalProperty")) {attributes.push("functional");}
      if (types.some(t => t === NAMESPACES.OWL + "TransitiveProperty")) {attributes.push("transitive");}
      if (types.some(t => t === NAMESPACES.OWL + "SymmetricProperty")) {attributes.push("symmetric");}
      
      const propLabel = Object.keys(subject.labels).length > 0 ? Object.assign({}, subject.labels) : { "undefined": resolver.getLocalName(iri) };
      if (!propLabel["undefined"]) {
        propLabel["undefined"] = resolver.getLocalName(iri);
      }

      let domain = null;
      if (subject.domains && subject.domains.length > 0) {
        if (subject.domains.length > 1) {
          domain = createImplicitUnionClass(subject.domains, resolver, context);
        } else {
          domain = subject.domains[0];
        }
      }

      let range = null;
      if (subject.ranges && subject.ranges.length > 0) {
        if (subject.ranges.length > 1) {
          range = createImplicitUnionClass(subject.ranges, resolver, context);
        } else {
          range = subject.ranges[0];
        }
      }

      const prop = {
        id: context.nextId(),
        type: type,
        iri: iri,
        baseIri: resolver.getBaseIri(iri),
        label: propLabel,
        comment: subject.comments,
        attributes: attributes,
        domain: domain,
        range: range,
        superproperty: [],
        subproperty: [],
        inverse: subject.inverses[0] || null,
        equivalentProperties: subject.equivalentProperties || [],
        annotations: subject.annotations
      };

      subject.superProperties.forEach(superIri => {
        context.subpropertyRelations.push({ subpropIri: iri, superpropIri: superIri });
      });

      context.propertyMap.set(iri, prop);
    } else if (isIndividual) {
      const individualIri = iri;
      const localName = resolver.getLocalName(individualIri);

      let finalLabels = {};
      if (Object.keys(subject.labels).length > 0) {
        finalLabels = Object.assign({}, subject.labels);
        if (!finalLabels["undefined"]) {
          finalLabels["undefined"] = localName;
        }
      } else {
        finalLabels = { "undefined": localName };
      }

      const indObj = {
        iri: individualIri,
        baseIri: resolver.getBaseIri(individualIri),
        labels: finalLabels,
        comments: subject.comments || {}
      };
      if (subject.annotations && Object.keys(subject.annotations).length > 0) {
        indObj.annotations = subject.annotations;
      }

      const classIris = types.filter(t => 
        t !== NAMESPACES.OWL + "NamedIndividual" && 
        (inferredClasses.has(t) || t === NAMESPACES.OWL + "Thing")
      );

      if (classIris.length === 0) {
        classIris.push("http://www.w3.org/2002/07/owl#Thing");
      }

      context.parsedIndividuals.push({
        individual: indObj,
        classIris: classIris
      });
    }
  }

  // Step 0: Ensure restriction properties exist in propertyMap
  context.parsedRestrictions.forEach(rest => {
    if (rest.propertyIri) {
      ensurePropertyExists(rest.propertyIri, "owl:objectProperty", resolver, context);
    }
  });

  const isStructuralAnonUnion = (supIri) => {
    const supSubject = subjects[supIri];
    return supIri.startsWith("_:") && supSubject && (
      supSubject.unionOf || supSubject.intersectionOf
    ) && (() => {
      const members = supSubject.unionOf || supSubject.intersectionOf;
      return Array.isArray(members) && members.length > 0 &&
        members.every(m => m.startsWith("_:") && subjects[m] && (
          subjects[m].types.has(NAMESPACES.OWL + "Restriction") ||
          (subjects[m].annotations && subjects[m].annotations["onProperty"] !== undefined)
        ));
    })();
  };

  context.subclassRelations = context.subclassRelations.filter(rel => {
    return !isStructuralAnonUnion(rel.subclassIri) && !isStructuralAnonUnion(rel.superclassIri);
  });

  context.subclassRelations.forEach(rel => {
    ensureClassExists(rel.subclassIri, "owl:Class", resolver, context);
    ensureClassExists(rel.superclassIri, "owl:Class", resolver, context);
  });

  context.parsedRestrictions.forEach(rest => {
    ensureClassExists(rest.domainIri, "owl:Class", resolver, context);
    if (rest.type !== "owl:hasValue") {
      ensureClassExists(rest.rangeIri, "owl:Class", resolver, context);
    }
  });

  for (const iri of Object.keys(subjects)) {
    const subject = subjects[iri];
    subject.equivalentClasses.forEach(equivIri => {
      ensureClassExists(equivIri, "owl:Class", resolver, context);
    });
  }

  context.parsedIndividuals.forEach(item => {
    item.classIris.forEach(clsIri => {
      ensureClassExists(clsIri, "owl:Class", resolver, context);
    });
  });

  context.propertyMap.forEach(prop => {
    if (prop.domain && typeof prop.domain === "string" && !isVowlId(prop.domain)) {
      ensureClassExists(prop.domain, "owl:Class", resolver, context);
    }
    if (prop.range && typeof prop.range === "string" && !isVowlId(prop.range)) {
      if (prop.type === "owl:datatypeProperty") {
        ensureClassExists(prop.range, "rdfs:Datatype", resolver, context);
      } else {
        ensureClassExists(prop.range, "owl:Class", resolver, context);
      }
    }
  });

  context.classMap.forEach(cls => {
    if (cls.unionMembers) {
      cls.unionMembers.forEach(memberIri => {
        ensureClassExists(memberIri, "owl:Class", resolver, context);
      });
    }
  });

  // Map parsed individuals to their corresponding class instances arrays
  context.parsedIndividuals.forEach(item => {
    item.classIris.forEach(clsIri => {
      const cls = context.classMap.get(clsIri);
      if (cls) {
        if (!cls.individuals) {cls.individuals = [];}
        if (!cls.individuals.some(ind => ind.iri === item.individual.iri)) {
          cls.individuals.push(item.individual);
        }
      }
    });
  });

  // Step 2: Ensure subproperties exist in mapping
  context.subpropertyRelations.forEach(rel => {
    if (rel.superpropIri && IGNORED_PROPERTIES.has(rel.superpropIri)) {return;}
    if (rel.subpropIri) {ensurePropertyExists(rel.subpropIri, "owl:objectProperty", resolver, context);}
    if (rel.superpropIri) {ensurePropertyExists(rel.superpropIri, "owl:objectProperty", resolver, context);}
  });

  const inversesToCreate = [];
  const equivalentsToCreate = [];
  context.propertyMap.forEach(prop => {
    if (prop.inverse && typeof prop.inverse === "string" && !isVowlId(prop.inverse)) {
      inversesToCreate.push(prop.inverse);
    }
    if (prop.equivalentProperties) {
      prop.equivalentProperties.forEach(equivIri => {
        if (typeof equivIri === "string" && !isVowlId(equivIri)) {
          equivalentsToCreate.push(equivIri);
        }
      });
    }
  });
  inversesToCreate.forEach(invIri => {
    const prop = ensurePropertyExists(invIri, "owl:objectProperty", resolver, context);
    if (!prop.attributes.includes("inferred")) {
      prop.attributes.push("inferred");
    }
  });
  equivalentsToCreate.forEach(equivIri => {
    const prop = ensurePropertyExists(equivIri, "owl:objectProperty", resolver, context);
    if (!prop.attributes.includes("inferred")) {
      prop.attributes.push("inferred");
    }
  });

  // Step 3: Resolve domains, ranges & inverses to numeric IDs
  // 3a. Resolve explicit domains and ranges
  context.propertyMap.forEach(prop => {
    if (prop.domain && typeof prop.domain === "string" && !isVowlId(prop.domain)) {
      prop.domain = getClassId(prop.domain, context);
    }
    if (prop.range && typeof prop.range === "string" && !isVowlId(prop.range)) {
      const cls = context.classMap.get(prop.range);
      if (isDatatypeIri(prop.range, resolver) || (cls && cls.type === "rdfs:Datatype") || prop.range === "http://www.w3.org/2000/01/rdf-schema#Literal") {
        prop.range = createVirtualDatatype(prop.range, resolver, context);
      } else {
        prop.range = getClassId(prop.range, context);
      }
    }
  });

  // 3b. Fill domain/range from inverse properties
  context.propertyMap.forEach(prop => {
    if (prop.inverse) {
      const invProp = context.propertyMap.get(prop.inverse);
      if (invProp) {
        let filled = false;
        if (!prop.domain && invProp.range) {
          prop.domain = invProp.range;
          filled = true;
        }
        if (!prop.range && invProp.domain) {
          prop.range = invProp.domain;
          filled = true;
        }
        if (filled) {
          if (!prop.attributes.includes("inferred")) {
            prop.attributes.push("inferred");
          }
        }
      }
    }
  });

  // 3c. Resolve inverse IRI to ID
  context.propertyMap.forEach(prop => {
    if (prop.inverse && typeof prop.inverse === "string" && !isVowlId(prop.inverse)) {
      const invProp = context.propertyMap.get(prop.inverse);
      if (invProp) {
        prop.inverse = invProp.id;
        invProp.inverse = prop.id;
      } else {
        prop.inverse = null;
      }
    }
  });

  // Collect all property IRIs referenced by restrictions
  const referencedProps = new Set();
  context.parsedRestrictions.forEach(rest => {
    referencedProps.add(rest.propertyIri);
  });

  // 3d. Default empty domain/range filling (ONLY for properties without inverses)
  context.propertyMap.forEach(prop => {
    if (prop.inverse) {
      return;
    }

    const hasDomain = !!prop.domain;
    const hasRange = !!prop.range;

    if (!hasDomain && !hasRange) {
      if (referencedProps.has(prop.iri)) {
        prop.skipExport = true;
        return;
      }

      if (prop.type === "owl:datatypeProperty") {
        prop.domain = getOrCreateFreeThing(resolver, context);
        prop.range = createVirtualDatatype("http://www.w3.org/2000/01/rdf-schema#Literal", resolver, context);
      } else {
        const freeThingId = getOrCreateFreeThing(resolver, context);
        prop.domain = freeThingId;
        prop.range = freeThingId;
      }
    } else if (!hasDomain) {
      prop.domain = getConnectedThingOrGenerate(prop.range, resolver, context);
    } else if (!hasRange) {
      if (prop.type === "owl:datatypeProperty") {
        prop.range = createVirtualDatatype("http://www.w3.org/2000/01/rdf-schema#Literal", resolver, context);
      } else {
        prop.range = getConnectedThingOrGenerate(prop.domain, resolver, context);
      }
    }
  });

  // Resolve union, intersection, complement & disjointUnion members to IDs
  context.classMap.forEach(cls => {
    if (cls.unionMembers) {
      cls.union = cls.unionMembers.map(memberIri => {
        const memberCls = context.classMap.get(memberIri);
        return memberCls ? memberCls.id : null;
      }).filter(id => id !== null);
      delete cls.unionMembers;
    }
    if (cls.intersectionMembers) {
      cls.intersection = cls.intersectionMembers.map(memberIri => {
        const memberCls = context.classMap.get(memberIri);
        return memberCls ? memberCls.id : null;
      }).filter(id => id !== null);
      delete cls.intersectionMembers;
    }
    if (cls.disjointUnionMembers) {
      cls.disjointUnion = cls.disjointUnionMembers.map(memberIri => {
        const memberCls = context.classMap.get(memberIri);
        return memberCls ? memberCls.id : null;
      }).filter(id => id !== null);
      delete cls.disjointUnionMembers;
    }
    if (cls.complementMember) {
      const compCls = context.classMap.get(cls.complementMember);
      if (compCls) {
        cls.complement = compCls.id;
      }
      delete cls.complementMember;
    }
  });

  // Process hasKey axioms
  for (const iri in subjects) {
    if (Object.prototype.hasOwnProperty.call(subjects, iri)) {
      const subject = subjects[iri];
      if (subject.hasKeys) {
        subject.hasKeys.forEach(propIri => {
          const prop = context.propertyMap.get(propIri);
          if (prop) {
            if (!prop.attributes.includes("key")) {
              prop.attributes.push("key");
            }
          }
        });
      }
    }
  }

  // Resolve equivalence to IDs
  context.classMap.forEach(cls => {
    const subject = subjects[cls.iri];
    if (subject && subject.equivalentClasses && subject.equivalentClasses.length > 0) {
      const sorted = getSortedEquivalents(cls.iri, subject.equivalentClasses, header.iri, subjects, false);
      if (sorted.length > 0) {
        cls.equivalent = [];
        if (!cls.attributes.includes("equivalent")) {
          cls.attributes.push("equivalent");
        }
        sorted.forEach(equivIri => {
          const equivCls = context.classMap.get(equivIri);
          if (equivCls) {
            cls.equivalent.push(equivCls.id);
            if (!equivCls.attributes.includes("equivalent")) {
              equivCls.attributes.push("equivalent");
            }
          }
        });
      }
    }
  });

  // Resolve equivalent properties
  context.propertyMap.forEach(prop => {
    const subject = subjects[prop.iri];
    if (subject && subject.equivalentProperties && subject.equivalentProperties.length > 0) {
      const sorted = getSortedEquivalents(prop.iri, subject.equivalentProperties, header.iri, subjects, true);
      prop.equivalentProperties = sorted;
    } else {
      prop.equivalentProperties = [];
    }
  });

  // Step 4: Map Subclass Properties
  context.subclassRelations.forEach(rel => {
    if (rel.superclassIri === "http://www.w3.org/2002/07/owl#Thing") {return;}
    const subCls = context.classMap.get(rel.subclassIri);
    const superCls = context.classMap.get(rel.superclassIri);
    
    if (subCls && superCls) {
      if (!subCls.superClasses.includes(superCls.id)) {
        subCls.superClasses.push(superCls.id);
      }
      if (!superCls.subClasses.includes(subCls.id)) {
        superCls.subClasses.push(subCls.id);
      }
    }
  });

  // Step 5: Resolve subproperties
  context.subpropertyRelations.forEach(rel => {
    if (rel.superpropIri && IGNORED_PROPERTIES.has(rel.superpropIri)) {return;}
    const subProp = context.propertyMap.get(rel.subpropIri);
    const superProp = context.propertyMap.get(rel.superpropIri);
    if (subProp && superProp) {
      subProp.superproperty.push(superProp.id);
      superProp.subproperty.push(subProp.id);
    }
  });

  // Resolve cardinalities onto VOWL properties
  context.parsedCardinalities.forEach(card => {
    const prop = context.propertyMap.get(card.propertyIri);
    if (prop) {
      if (card.minCardinality !== null) {prop.minCardinality = card.minCardinality;}
      if (card.maxCardinality !== null) {prop.maxCardinality = card.maxCardinality;}
      if (card.cardinality !== null) {prop.cardinality = card.cardinality;}
    }
  });

  // Mark external elements
  context.classMap.forEach(cls => {
    const isAnon = cls.type === "owl:unionOf";
    if (!isAnon && isIriExternal(cls.iri, header.iri)) {
      if (!cls.attributes.includes("external")) {cls.attributes.push("external");}
    }
  });

  // Finalize class types according to VOWL attribute priority (mirrors Java's TypeSetter)
  context.classMap.forEach(cls => {
    const attrs = cls.attributes;
    if (attrs.includes("intersection")) {
      cls.type = "owl:intersectionOf";
    } else if (attrs.includes("union")) {
      cls.type = "owl:unionOf";
    } else if (attrs.includes("complement")) {
      cls.type = "owl:complementOf";
    } else if (attrs.includes("disjointUnion")) {
      cls.type = "owl:disjointUnionOf";
    } else if (attrs.includes("equivalent")) {
      cls.type = "owl:equivalentClass";
    } else if (attrs.includes("datatype")) {
      cls.type = "rdfs:Datatype";
    }
  });

  context.propertyMap.forEach(prop => {
    if (isIriExternal(prop.iri, header.iri)) {
      if (!prop.attributes.includes("external")) {
        prop.attributes.push("external");
      }
    }
  });
}

function getOrCreateFreeThing(resolver, context) {
  const allThings = [];
  context.classMap.forEach(cls => {
    if (cls.type === "owl:Thing") {allThings.push(cls);}
  });
  if (context.virtualThings) {
    context.virtualThings.forEach(cls => {
      if (cls.type === "owl:Thing") {allThings.push(cls);}
    });
  }

  for (const thing of allThings) {
    if (isThingFree(thing, context)) {
      return thing.id;
    }
  }

  const virtualId = context.nextId();
  const virtualCls = {
    id: virtualId,
    type: "owl:Thing",
    iri: "http://www.w3.org/2002/07/owl#Thing",
    baseIri: "http://www.w3.org/2002/07/owl#",
    label: { "undefined": "Thing" },
    comment: {},
    attributes: [],
    subClasses: [],
    superClasses: [],
    annotations: {}
  };
  if (!context.virtualThings) {context.virtualThings = [];}
  context.virtualThings.push(virtualCls);
  return virtualId;
}

function isThingFree(thing, context) {
  for (const prop of context.propertyMap.values()) {
    const isDomain = prop.domain === thing.id;
    const isRange = prop.range === thing.id;
    if (isDomain || isRange) {
      if (isDomain) {
        const rangeNode = getClsOrVirtualNode(prop.range, context);
        if (rangeNode && !isAllowedFreeConnection(rangeNode.type)) {
          return false;
        }
      }
      if (isRange) {
        const domainNode = getClsOrVirtualNode(prop.domain, context);
        if (domainNode && !isAllowedFreeConnection(domainNode.type)) {
          return false;
        }
      }
    }
  }
  return true;
}

function getClsOrVirtualNode(id, context) {
  let node = context.classMap.get(id);
  if (node) {return node;}
  const byId = Array.from(context.classMap.values()).find(n => n.id === id);
  if (byId) {return byId;}
  if (context.virtualThings) {
    node = context.virtualThings.find(n => n.id === id);
    if (node) {return node;}
  }
  if (context.virtualDatatypes) {
    node = context.virtualDatatypes.find(n => n.id === id);
    if (node) {return node;}
  }
  return null;
}

function isAllowedFreeConnection(type) {
  return type === "rdfs:Datatype" || type === "rdfs:Literal" || type === "owl:Thing";
}

function findEquivalentUnionClass(memberIris, context) {
  const sortedMembers = [...memberIris].sort();
  const sortedMembersStr = JSON.stringify(sortedMembers);

  for (const [, cls] of context.classMap.entries()) {
    if (cls.type === "owl:unionOf" && cls.unionMembers) {
      const clsSorted = [...cls.unionMembers].sort();
      if (JSON.stringify(clsSorted) === sortedMembersStr) {
        return cls;
      }
    }
  }
  return null;
}

function createImplicitUnionClass(memberIris, resolver, context) {
  const existing = findEquivalentUnionClass(memberIris, context);
  if (existing) {
    return existing.id;
  }

  const virtualId = context.nextId();
  const virtualCls = {
    id: virtualId,
    type: "owl:unionOf",
    iri: null,
    baseIri: undefined,
    label: {},
    comment: {},
    attributes: ["union"],
    subClasses: [],
    superClasses: [],
    unionMembers: memberIris,
    annotations: {}
  };
  context.classMap.set(virtualId, virtualCls);
  return virtualId;
}

function getConnectedThingOrGenerate(nodeId, resolver, context) {
  for (const prop of context.propertyMap.values()) {
    const isDomain = prop.domain === nodeId;
    const isRange = prop.range === nodeId;
    if (isDomain || isRange) {
      if (isDomain) {
        const rangeNode = getClsOrVirtualNode(prop.range, context);
        if (rangeNode && rangeNode.type === "owl:Thing") {
          return rangeNode.id;
        }
      }
      if (isRange) {
        const domainNode = getClsOrVirtualNode(prop.domain, context);
        if (domainNode && domainNode.type === "owl:Thing") {
          return domainNode.id;
        }
      }
    }
  }

  const virtualId = context.nextId();
  const virtualCls = {
    id: virtualId,
    type: "owl:Thing",
    iri: "http://www.w3.org/2002/07/owl#Thing",
    baseIri: "http://www.w3.org/2002/07/owl#",
    label: { "undefined": "Thing" },
    comment: {},
    attributes: [],
    subClasses: [],
    superClasses: [],
    annotations: {}
  };
  if (!context.virtualThings) {context.virtualThings = [];}
  context.virtualThings.push(virtualCls);
  return virtualId;
}

function getSortedEquivalents(entityIri, equivalentIris, headerIri, subjects, isProperty = false) {
  const iriToSort = [...equivalentIris];

  if (isIriExternal(entityIri, headerIri)) {
    for (const iri of iriToSort) {
      if (!isIriExternal(iri, headerIri)) {
        return [];
      }
    }
  }

  for (const iri of iriToSort) {
    const equivSubject = subjects[iri];
    if (equivSubject) {
      const equivList = isProperty ? equivSubject.equivalentProperties : equivSubject.equivalentClasses;
      if (equivList && equivList.length > equivalentIris.length) {
        return [];
      }
    }
  }

  iriToSort.sort((o1, o2) => {
    if (o1 === headerIri) {return 1;}
    if (o2 === headerIri) {return -1;}
    return 0;
  });

  return iriToSort;
}

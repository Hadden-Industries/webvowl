/**
 * Manages unique VOWL ID allocation, entity mapping structures,
 * and tracks subclass/subproperty and visual virtualization relations.
 */
export class VowlParserContext {
  #idCounter = 0;

  constructor() {
    this.classMap = new Map();     // IRI -> VOWL Class Node Object
    this.propertyMap = new Map();  // IRI -> VOWL Property Edge Object
    this.subclassRelations = [];   // Array of { subclassIri, superclassIri }
    this.subpropertyRelations = []; // Array of { subpropIri, superpropIri }
    this.parsedRestrictions = [];  // Array of { domainIri, propertyIri, rangeIri, type }
    this.parsedCardinalities = []; // Array of { propertyIri, minCardinality, maxCardinality, cardinality }
    this.virtualDatatypes = [];    // Visual-individualized Datatype representations
    this.parsedIndividuals = [];   // List of parsed NamedIndividual models
    this.virtualThings = [];       // Visual-individualized Thing representations
  }

  /**
   * Generates a unique numeric VOWL ID identifier.
   * @returns {string}
   */
  nextId() {
    return String(this.#idCounter++);
  }
}

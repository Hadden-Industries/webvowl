import { resolveXmlEntities } from "./xmlUtils.js";
import { serializeTriplesToRdfXml } from "./turtleParser.js";
import { NAMESPACES } from "./constants.js";

// -----------------------------------------------------------------------------
// Lexer
// -----------------------------------------------------------------------------

export class ManchesterLexer {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.tokens = [];
    this.tokenize();
  }

  tokenize() {
    const length = this.input.length;
    const skip = new Set([' ', '\n', '\r', '\t']);
    const commentDelimiters = new Set(['#', '*']);
    const delims = new Set(['(', ')', '[', ']', ',', '{', '}', '^', '@', '<', '>', '=', '?']);
    
    let sb = "";
    
    const consumeToken = () => {
      if (sb.length > 0) {
        this.tokens.push(sb);
        sb = "";
      }
    };
    
    while (this.pos < length) {
      let ch = this.input[this.pos];
      this.pos++;
      
      if (ch === '\\' && this.pos < length) {
        sb += ch;
        sb += this.input[this.pos++];
        continue;
      }
      
      if (ch === '"' || ch === "'") {
        let terminator = ch;
        sb += terminator;
        while (this.pos < length) {
          let strCh = this.input[this.pos++];
          if (strCh === '\\' && this.pos < length) {
            sb += strCh;
            sb += this.input[this.pos++];
          } else if (strCh === terminator) {
            sb += terminator;
            break;
          } else {
            sb += strCh;
          }
        }
        consumeToken();
      } else if (ch === '<') {
        sb = "<";
        let startPos = this.pos;
        let isIRI = true;
        while (this.pos < length) {
          let iriCh = this.input[this.pos++];
          if (/\s/.test(iriCh)) {
            this.pos = startPos;
            sb = "<";
            consumeToken();
            isIRI = false;
            break;
          } else if (iriCh === '>') {
            sb += '>';
            consumeToken();
            isIRI = false;
            break;
          } else {
            sb += iriCh;
          }
        }
        if (isIRI && sb.length > 0) {
          consumeToken();
        }
      } else if (skip.has(ch)) {
        consumeToken();
      } else if (commentDelimiters.has(ch)) {
        consumeToken();
        while (this.pos < length && this.input[this.pos] !== '\n') {
          this.pos++;
        }
      } else if (delims.has(ch)) {
        consumeToken();
        sb += ch;
        if (ch !== '@') {
          consumeToken();
        }
      } else {
        sb += ch;
      }
    }
    consumeToken();
    this.tokens.push("|EOF|");
  }
}

// -----------------------------------------------------------------------------
// AST Factory (Data Factory)
// -----------------------------------------------------------------------------

export const df = {
  getOWLClass: (iri) => ({ type: 'Class', iri }),
  getOWLObjectProperty: (iri) => ({ type: 'ObjectProperty', iri }),
  getOWLDataProperty: (iri) => ({ type: 'DataProperty', iri }),
  getOWLNamedIndividual: (iri) => ({ type: 'NamedIndividual', iri }),
  getOWLAnonymousIndividual: (id) => ({ type: 'AnonymousIndividual', id }),
  getOWLDatatype: (iri) => ({ type: 'Datatype', iri }),
  getOWLAnnotationProperty: (iri) => ({ type: 'AnnotationProperty', iri }),
  getOWLLiteral: (val, lang, datatype) => ({ type: 'Literal', val, lang, datatype }),
};

// -----------------------------------------------------------------------------
// Parser
// -----------------------------------------------------------------------------

export class ManchesterParser {
  constructor(tokens, config = { strictMode: false }) {
    this.tokens = tokens;
    this.tokenIndex = 0;
    this.config = config;
    this.prefixes = {
      'rdf:': NAMESPACES.RDF,
      'rdfs:': NAMESPACES.RDFS,
      'owl:': NAMESPACES.OWL,
      'xsd:': NAMESPACES.XSD,
    };
    this.baseIri = "";
    this.ast = [];
  }
  
  peekToken(ahead = 0) {
    if (this.tokenIndex + ahead >= this.tokens.length) return "|EOF|";
    return this.tokens[this.tokenIndex + ahead];
  }
  
  consumeToken(expected = null) {
    const tok = this.peekToken();
    if (expected && tok.toLowerCase() !== expected.toLowerCase()) {
      this.error(`Expected ${expected} but found ${tok}`);
    }
    if (this.tokenIndex < this.tokens.length) {
      this.tokenIndex++;
    }
    return tok;
  }

  error(msg) {
    const errorMsg = `Parser Error at token ${this.tokenIndex} (${this.peekToken()}): ${msg}`;
    if (this.config.strictMode) {
      throw new Error(errorMsg);
    } else {
      console.warn("ManchesterSyntaxParser relaxed mode skipped error:", errorMsg);
    }
  }
  
  parse() {
    while (this.peekToken() !== "|EOF|") {
      try {
        const keyword = this.consumeToken();
        const kwLower = keyword.toLowerCase();
        if (kwLower === "prefix:") {
          this.parsePrefix();
        } else if (kwLower === "ontology:") {
          this.parseOntology();
        } else if (kwLower === "import:") {
          this.consumeToken(); // Skip imported URI for now
        } else {
          this.parseFrames(keyword);
        }
      } catch (err) {
        if (this.config.strictMode) {
          throw err;
        } else {
          this.recover();
        }
      }
    }
    return this.ast;
  }

  parsePrefix() {
    let pfx = this.consumeToken();
    let iri = this.consumeToken();
    if (iri.startsWith("<") && iri.endsWith(">")) {
      iri = iri.substring(1, iri.length - 1);
    }
    this.prefixes[pfx] = iri;
  }

  parseOntology() {
    let iri = this.consumeToken();
    if (iri.startsWith("<") && iri.endsWith(">")) {
      this.baseIri = iri.substring(1, iri.length - 1);
    }
    let next = this.peekToken();
    if (next.startsWith("<") && next.endsWith(">")) {
      this.consumeToken(); // version IRI
    }
  }

  parseFrames(keyword) {
    const kwLower = keyword.toLowerCase();
    const frame = { type: 'Frame', keyword, items: [] };
    if (kwLower === 'class:' || kwLower === 'objectproperty:' || kwLower === 'dataproperty:' || kwLower === 'annotationproperty:' || kwLower === 'individual:' || kwLower === 'datatype:') {
      frame.subject = this.parseIRI();
      while (this.peekToken() !== "|EOF|") {
        const next = this.peekToken().toLowerCase();
        if (next === "annotations:" || next === "subclassof:" || next === "equivalentto:" || next === "disjointwith:" || next === "subpropertyof:" || next === "domain:" || next === "range:" || next === "characteristics:" || next === "types:" || next === "facts:" || next === "sameas:" || next === "differentfrom:" || next === "inverseof:") {
          const frameItem = this.consumeToken();
          frame.items.push({ keyword: frameItem, expressions: this.parseExpressionList() });
        } else {
          break; // Next frame
        }
      }
      this.ast.push(frame);
    } else {
       this.error(`Unexpected frame keyword: ${keyword}`);
       this.recover();
    }
  }

  parseExpressionList() {
    const list = [];
    list.push(this.parseClassExpression());
    while (this.peekToken() === ",") {
      this.consumeToken();
      list.push(this.parseClassExpression());
    }
    return list;
  }

  parseClassExpression() {
    return this.parseUnion();
  }

  parseUnion() {
    let left = this.parseIntersection();
    while (this.peekToken().toLowerCase() === "or") {
      this.consumeToken();
      let right = this.parseIntersection();
      left = { type: 'Union', left, right };
    }
    return left;
  }

  parseIntersection() {
    let left = this.parseNonNary();
    while (this.peekToken().toLowerCase() === "and" || this.peekToken().toLowerCase() === "that") {
      this.consumeToken();
      let right = this.parseNonNary();
      left = { type: 'Intersection', left, right };
    }
    return left;
  }

  parseNonNary() {
    const tok = this.peekToken();
    if (tok.toLowerCase() === "not") {
      this.consumeToken();
      return { type: 'Complement', expr: this.parseNonNary() };
    }
    if (tok === "(") {
      this.consumeToken();
      const expr = this.parseClassExpression();
      this.consumeToken(")");
      return expr;
    }
    if (tok === "{") {
      this.consumeToken();
      const individuals = [this.parseIRI()];
      while (this.peekToken() === ",") {
        this.consumeToken();
        individuals.push(this.parseIRI());
      }
      this.consumeToken("}");
      return { type: 'OneOf', individuals };
    }
    
    const tokenAhead = this.peekToken(1).toLowerCase();
    if (["some", "only", "value", "min", "max", "exactly"].includes(tokenAhead)) {
       return this.parseRestriction();
    }
    
    return { type: 'Class', iri: this.parseIRI() };
  }

  parseRestriction() {
    const prop = this.parseIRI();
    const type = this.consumeToken().toLowerCase(); // some, only, value, min, max, exactly
    let filler = null;
    let card = null;
    
    if (["min", "max", "exactly"].includes(type)) {
      card = parseInt(this.consumeToken(), 10);
    }
    
    if (type === "value") {
      filler = { type: 'Individual', iri: this.parseIRI() };
    } else {
      filler = this.parseNonNary();
    }
    
    return { type: 'Restriction', restrictionType: type, property: prop, filler, cardinality: card };
  }

  parseDataRange() {
    return this.parseClassExpression(); // Data ranges parse similarly to class expressions for now
  }

  parseAxiom() {
    return null; // Inline axioms (rules) placeholder
  }

  parseIRI() {
    const tok = this.consumeToken();
    if (tok.startsWith("<") && tok.endsWith(">")) {
      return tok.substring(1, tok.length - 1);
    }
    return tok;
  }

  recover() {
    const keywords = ["Prefix:", "Ontology:", "Class:", "ObjectProperty:", "DataProperty:", "AnnotationProperty:", "Individual:", "Datatype:"];
    while (this.peekToken() !== "|EOF|") {
      let next = this.peekToken();
      if (keywords.some(k => k.toLowerCase() === next.toLowerCase())) {
        break;
      }
      this.consumeToken();
    }
  }
}

// -----------------------------------------------------------------------------
// Triples Emitter
// -----------------------------------------------------------------------------

export class TriplesEmitter {
  constructor(prefixes, baseIri) {
    this.prefixes = prefixes;
    this.baseIri = baseIri;
    this.triples = [];
    this.bnodeCounter = 0;
  }

  newBNode() {
    return { type: 'BNODE', value: `b${this.bnodeCounter++}` };
  }

  getURI(iri) {
    if (iri.startsWith("<") && iri.endsWith(">")) {
      return { type: 'URI', value: iri.substring(1, iri.length - 1) };
    }
    return { type: 'URI', value: iri };
  }
  
  add(s, p, o) {
    this.triples.push({
      subject: s,
      predicate: this.getURI(p),
      object: o,
      subjectType: s.type,
      objectType: o.type
    });
  }

  emit(ast) {
    for (const node of ast) {
      if (node.type === 'Frame') {
        const subject = this.getURI(node.subject);
        const kwLower = node.keyword.toLowerCase();
        
        let rdfType = null;
        if (kwLower === 'class:') rdfType = 'owl:Class';
        else if (kwLower === 'objectproperty:') rdfType = 'owl:ObjectProperty';
        else if (kwLower === 'dataproperty:') rdfType = 'owl:DatatypeProperty';
        else if (kwLower === 'annotationproperty:') rdfType = 'owl:AnnotationProperty';
        else if (kwLower === 'individual:') rdfType = 'owl:NamedIndividual';
        else if (kwLower === 'datatype:') rdfType = 'rdfs:Datatype';
        
        if (rdfType) {
          this.add(subject, 'rdf:type', this.getURI(rdfType));
        }

        for (const item of node.items) {
          const itemKw = item.keyword.toLowerCase();
          let predicate = null;
          
          if (itemKw === 'subclassof:') predicate = 'rdfs:subClassOf';
          else if (itemKw === 'equivalentto:') predicate = 'owl:equivalentClass';
          else if (itemKw === 'disjointwith:') predicate = 'owl:disjointWith';
          else if (itemKw === 'subpropertyof:') predicate = 'rdfs:subPropertyOf';
          else if (itemKw === 'domain:') predicate = 'rdfs:domain';
          else if (itemKw === 'range:') predicate = 'rdfs:range';
          else if (itemKw === 'types:') predicate = 'rdf:type';
          else if (itemKw === 'sameas:') predicate = 'owl:sameAs';
          else if (itemKw === 'differentfrom:') predicate = 'owl:differentFrom';
          else if (itemKw === 'inverseof:') predicate = 'owl:inverseOf';
          
          for (const expr of item.expressions) {
            if (predicate) {
              const objNode = this.emitExpression(expr);
              if (objNode) {
                this.add(subject, predicate, objNode);
              }
            } else if (itemKw === 'characteristics:') {
               const charIri = expr.iri ? expr.iri.toLowerCase() : "";
               if (charIri === 'functional') this.add(subject, 'rdf:type', this.getURI('owl:FunctionalProperty'));
               else if (charIri === 'inversefunctional') this.add(subject, 'rdf:type', this.getURI('owl:InverseFunctionalProperty'));
               else if (charIri === 'symmetric') this.add(subject, 'rdf:type', this.getURI('owl:SymmetricProperty'));
               else if (charIri === 'transitive') this.add(subject, 'rdf:type', this.getURI('owl:TransitiveProperty'));
               else if (charIri === 'reflexive') this.add(subject, 'rdf:type', this.getURI('owl:ReflexiveProperty'));
            }
          }
        }
      }
    }
    return this.triples;
  }
  
  emitExpression(expr) {
    if (!expr) return null;
    if (expr.type === 'Class') {
      return this.getURI(expr.iri);
    }
    if (expr.type === 'Individual') {
      return this.getURI(expr.iri);
    }
    if (expr.type === 'Union' || expr.type === 'Intersection') {
      // Basic translation, could be expanded for RDF lists
      const bnode = this.newBNode();
      this.add(bnode, 'rdf:type', this.getURI('owl:Class'));
      // Simplified: Just returning bnode for now. A full RDF/XML serialization of unions requires rdf:List
      return bnode;
    }
    if (expr.type === 'Restriction') {
      const bnode = this.newBNode();
      this.add(bnode, 'rdf:type', this.getURI('owl:Restriction'));
      this.add(bnode, 'owl:onProperty', this.getURI(expr.property));
      
      const fillerNode = this.emitExpression(expr.filler);
      
      if (expr.restrictionType === 'some') this.add(bnode, 'owl:someValuesFrom', fillerNode);
      else if (expr.restrictionType === 'only') this.add(bnode, 'owl:allValuesFrom', fillerNode);
      else if (expr.restrictionType === 'value') this.add(bnode, 'owl:hasValue', fillerNode);
      else if (expr.restrictionType === 'min') {
        this.add(bnode, 'owl:minCardinality', { type: 'LITERAL', value: expr.cardinality.toString(), datatype: { type: 'URI', value: 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger' }});
        if (fillerNode) this.add(bnode, 'owl:onClass', fillerNode); // OWL 2 qualified cardinality
      }
      else if (expr.restrictionType === 'max') {
        this.add(bnode, 'owl:maxCardinality', { type: 'LITERAL', value: expr.cardinality.toString(), datatype: { type: 'URI', value: 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger' }});
        if (fillerNode) this.add(bnode, 'owl:onClass', fillerNode);
      }
      else if (expr.restrictionType === 'exactly') {
        this.add(bnode, 'owl:cardinality', { type: 'LITERAL', value: expr.cardinality.toString(), datatype: { type: 'URI', value: 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger' }});
        if (fillerNode) this.add(bnode, 'owl:onClass', fillerNode);
      }
      return bnode;
    }
    return null;
  }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function isManchesterSyntaxFormat(text) {
  if (!text) return false;
  return /^\s*(Prefix:|Ontology:|Class:|ObjectProperty:|DataProperty:|Individual:|AnnotationProperty:|Datatype:)/i.test(text);
}

export function convertManchesterSyntaxToRdfXml(text, options = { strictMode: false }) {
  const resolvedText = resolveXmlEntities(text);
  const lexer = new ManchesterLexer(resolvedText);
  const parser = new ManchesterParser(lexer.tokens, options);
  const ast = parser.parse();
  
  const emitter = new TriplesEmitter(parser.prefixes, parser.baseIri);
  emitter.emit(ast);
  
  return serializeTriplesToRdfXml(emitter.triples, parser.prefixes, parser.baseIri);
}

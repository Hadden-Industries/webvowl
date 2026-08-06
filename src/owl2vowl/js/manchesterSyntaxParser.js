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
  }

  *tokenize() {
    const length = this.input.length;
    const skip = new Set([' ', '\n', '\r', '\t']);
    const commentDelimiters = new Set(['#', '*']);
    const delims = new Set(['(', ')', '[', ']', ',', '{', '}', '^', '@', '<', '>', '=']);
    
    let sb = "";
    
    function* consumeToken() {
      if (sb.length > 0) {
        yield sb;
        sb = "";
      }
    }
    
    while (this.pos < length) {
      const ch = this.input[this.pos];
      this.pos++;
      
      if (ch === '\\' && this.pos < length) {
        sb += ch;
        sb += this.input[this.pos++];
        continue;
      }
      
      if (ch === '"' || ch === "'") {
        const terminator = ch;
        sb += terminator;
        while (this.pos < length) {
          const strCh = this.input[this.pos++];
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
        yield* consumeToken();
      } else if (ch === '<') {
        sb = "<";
        const startPos = this.pos;
        let isIRI = true;
        while (this.pos < length) {
          const iriCh = this.input[this.pos++];
          if (/\s/.test(iriCh)) {
            this.pos = startPos;
            sb = "<";
            yield* consumeToken();
            isIRI = false;
            break;
          } else if (iriCh === '>') {
            sb += '>';
            yield* consumeToken();
            isIRI = false;
            break;
          } else {
            sb += iriCh;
          }
        }
        if (isIRI && sb.length > 0) {
          yield* consumeToken();
        }
      } else if (ch === '-' && this.pos < length && this.input[this.pos] === '>') {
        yield* consumeToken();
        yield "->";
        this.pos++;
      } else if (ch === '?') {
        yield* consumeToken();
        sb = "?";
        while (this.pos < length && !skip.has(this.input[this.pos]) && !delims.has(this.input[this.pos]) && !commentDelimiters.has(this.input[this.pos])) {
          sb += this.input[this.pos++];
        }
        yield* consumeToken();
      } else if (skip.has(ch)) {
        yield* consumeToken();
      } else if (commentDelimiters.has(ch)) {
        yield* consumeToken();
        while (this.pos < length && this.input[this.pos] !== '\n') {
          this.pos++;
        }
      } else if (delims.has(ch)) {
        yield* consumeToken();
        sb += ch;
        if (ch !== '@') {
          yield* consumeToken();
        }
      } else {
        sb += ch;
      }
    }
    yield* consumeToken();
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
  constructor(lexer, config = { strictMode: false }) {
    this.iterator = lexer.tokenize();
    this.tokenBuffer = [];
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
    while (this.tokenBuffer.length <= this.tokenIndex + ahead) {
      const next = this.iterator.next();
      if (next.done) {
        this.tokenBuffer.push("|EOF|");
      } else {
        this.tokenBuffer.push(next.value);
      }
    }
    return this.tokenBuffer[this.tokenIndex + ahead];
  }
  
  consumeToken(expected = null) {
    const tok = this.peekToken();
    if (expected && tok.toLowerCase() !== expected.toLowerCase()) {
      this.error(`Expected ${expected} but found ${tok}`);
    }
    this.tokenIndex++;
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
          const importIri = this.consumeToken(); 
          this.ast.push({ type: 'OntologyImport', iri: importIri });
        } else if (kwLower === "annotations:") {
          this.ast.push({ type: 'OntologyAnnotations', annotations: this.parseAnnotationList() });
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
    const pfx = this.consumeToken();
    let iri = this.consumeToken();
    if (iri.startsWith("<") && iri.endsWith(">")) {
      iri = iri.substring(1, iri.length - 1);
    }
    this.prefixes[pfx] = iri;
  }

  parseOntology() {
    const iri = this.consumeToken();
    if (iri.startsWith("<") && iri.endsWith(">")) {
      this.baseIri = iri.substring(1, iri.length - 1);
    }
    const next = this.peekToken();
    if (next.startsWith("<") && next.endsWith(">")) {
      this.consumeToken(); // version IRI
    }
  }

  parseFrames(keyword) {
    const kwLower = keyword.toLowerCase();
    const frame = { type: 'Frame', keyword, items: [] };
    if (kwLower === 'class:' || kwLower === 'objectproperty:' || kwLower === 'dataproperty:' || kwLower === 'annotationproperty:' || kwLower === 'individual:' || kwLower === 'datatype:' || kwLower === 'valuepartition:') {
      frame.subject = this.parseIRI();
      while (this.peekToken() !== "|EOF|") {
        const next = this.peekToken().toLowerCase();
        if (next === "annotations:" || next === "subclassof:" || next === "equivalentto:" || next === "disjointwith:" || next === "subpropertyof:" || next === "domain:" || next === "range:" || next === "characteristics:" || next === "types:" || next === "facts:" || next === "sameas:" || next === "differentfrom:" || next === "inverseof:" || next === "inverses:" || next === "superclassof:" || next === "superpropertyof:" || next === "disjointunionof:" || next === "haskey:" || next === "subpropertychain:") {
          const frameItem = this.consumeToken();
          const itemKwLower = frameItem.toLowerCase();
          let expressions;
          if (itemKwLower === "facts:") {
            expressions = this.parseFactList();
          } else if (itemKwLower === "annotations:") {
            expressions = this.parseAnnotationList();
          } else if (itemKwLower === "characteristics:") {
            expressions = this.parseCharacteristicList();
          } else if (itemKwLower === "subpropertychain:") {
            expressions = this.parsePropertyChainList();
          } else {
            expressions = this.parseExpressionList();
          }
          frame.items.push({ keyword: frameItem, expressions });
        } else {
          break; // Next frame
        }
      }
      this.ast.push(frame);
    } else if (['disjointclasses:', 'equivalentclasses:', 'equivalentproperties:', 'disjointproperties:', 'sameindividual:', 'differentindividuals:'].includes(kwLower)) {
      const frame = { type: 'TopLevelAxiom', keyword, expressions: this.parseExpressionList() };
      this.ast.push(frame);
    } else if (kwLower === 'rule:') {
      this.parseRuleFrame();
    } else {
       this.error(`Unexpected frame keyword: ${keyword}`);
       this.recover();
    }
  }

  parsePropertyChainList() {
    const list = [];
    list.push(this.parsePropertyChain());
    while (this.peekToken() === ",") {
      this.consumeToken();
      list.push(this.parsePropertyChain());
    }
    return list;
  }

  parsePropertyChain() {
    const chain = [];
    chain.push(this.parseIRI());
    while (this.peekToken() === "o" || this.peekToken() === "->") {
      this.consumeToken();
      chain.push(this.parseIRI());
    }
    return { type: 'PropertyChain', properties: chain };
  }

  parseFactList() {
    const list = [];
    list.push(this.parseFact());
    while (this.peekToken() === ",") {
      this.consumeToken();
      list.push(this.parseFact());
    }
    return list;
  }

  parseFact() {
    let isNegative = false;
    if (this.peekToken().toLowerCase() === "not") {
      this.consumeToken();
      isNegative = true;
    }
    const property = this.parseIRI();
    const value = this.parseSwrlArgument(); // Reusing argument parser as it matches IRI/Literal
    return { type: 'Fact', isNegative, property, value };
  }

  parseAnnotationList() {
    const list = [];
    list.push(this.parseAnnotation());
    while (this.peekToken() === ",") {
      this.consumeToken();
      list.push(this.parseAnnotation());
    }
    return list;
  }

  parseAnnotation() {
    // Basic annotation parsing: Property Value
    const property = this.parseIRI();
    const value = this.parseSwrlArgument();
    return { type: 'Annotation', property, value };
  }

  parseCharacteristicList() {
    const list = [];
    list.push({ type: 'Characteristic', iri: this.consumeToken() });
    while (this.peekToken() === ",") {
      this.consumeToken();
      list.push({ type: 'Characteristic', iri: this.consumeToken() });
    }
    return list;
  }

  parseRuleFrame() {
    const frame = { type: 'Rule', body: [], head: [] };
    
    // Parse body atoms
    if (this.peekToken() !== '->') {
      frame.body.push(this.parseSwrlAtom());
      while (this.peekToken() === ',') {
        this.consumeToken();
        frame.body.push(this.parseSwrlAtom());
      }
    }
    
    this.consumeToken('->');
    
    // Parse head atoms
    if (this.peekToken() !== '|EOF|' && !isManchesterSyntaxFormat(this.peekToken())) {
      frame.head.push(this.parseSwrlAtom());
      while (this.peekToken() === ',') {
        this.consumeToken();
        frame.head.push(this.parseSwrlAtom());
      }
    }
    
    this.ast.push(frame);
  }

  parseSwrlAtom() {
    const predicate = this.parseIRI();
    this.consumeToken('(');
    const args = [];
    if (this.peekToken() !== ')') {
      args.push(this.parseSwrlArgument());
      while (this.peekToken() === ',') {
        this.consumeToken();
        args.push(this.parseSwrlArgument());
      }
    }
    this.consumeToken(')');
    return { type: 'SwrlAtom', predicate, args };
  }

  parseSwrlArgument() {
    const tok = this.peekToken();
    if (tok.startsWith('?')) {
      return { type: 'SwrlVariable', name: this.consumeToken().substring(1) };
    } else if (tok === '"' || tok.startsWith('"')) {
      return this.parseLiteral();
    } else if (!isNaN(tok) || ['true', 'false', 'true:', 'false:'].includes(tok.toLowerCase())) {
      return this.parseLiteral();
    } else {
      return { type: 'NamedIndividual', iri: this.parseIRI() };
    }
  }

  parseLiteral() {
    const tok = this.consumeToken();
    let val = tok;
    let datatype = null;
    let lang = null;

    if (tok.startsWith('"') || tok.startsWith("'")) {
      val = tok.substring(1, tok.length - 1);
    } else if (!isNaN(tok)) {
      if (tok.includes('.')) {
        datatype = 'xsd:decimal';
      } else {
        datatype = 'xsd:integer';
      }
    } else if (tok.toLowerCase() === 'true' || tok.toLowerCase() === 'false') {
      datatype = 'xsd:boolean';
    }

    if (this.peekToken() === '^') {
      this.consumeToken();
      if (this.peekToken() === '^') {
        this.consumeToken();
      }
      datatype = this.parseIRI();
    } else if (this.peekToken().startsWith('@')) {
      // Language tag is emitted as a single token, e.g. "@en" — mirrors Java's
      // consumeToken().substring(1) in ManchesterOWLSyntaxParserImpl.parseLiteral
      lang = this.consumeToken().substring(1);
    }

    return { type: 'Literal', value: val, datatype, lang };
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
      const right = this.parseIntersection();
      left = { type: 'Union', left, right };
    }
    return left;
  }

  parseIntersection() {
    let left = this.parseNonNary();
    while (this.peekToken().toLowerCase() === "and" || this.peekToken().toLowerCase() === "that") {
      this.consumeToken();
      const right = this.parseNonNary();
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
    if (["some", "only", "onlysome", "value", "min", "max", "exactly"].includes(tokenAhead)) {
       return this.parseRestriction();
    }
    
    const iri = this.parseIRI();
    if (this.peekToken() === '[') {
      const restrictions = this.parseDatatypeFacets();
      return { type: 'DatatypeWithRestrictions', iri, restrictions };
    }
    return { type: 'Class', iri };
  }

  parseRestriction() {
    const prop = this.parseIRI();
    const type = this.consumeToken().toLowerCase(); // some, only, onlysome, value, min, max, exactly
    let filler;
    let card = null;
    
    if (["min", "max", "exactly"].includes(type)) {
      card = parseInt(this.consumeToken(), 10);
    }
    
    if (type === "value") {
      filler = this.parseSwrlArgument();
    } else {
      if (this.peekToken().toLowerCase() === "self") {
        this.consumeToken();
        filler = { type: 'Self' };
      } else {
        filler = this.parseNonNary();
      }
    }
    
    return { type: 'Restriction', restrictionType: type, property: prop, filler, cardinality: card };
  }

  parseDatatypeFacets() {
    const facets = [];
    this.consumeToken('[');
    while (this.peekToken() !== ']' && this.peekToken() !== '|EOF|') {
      let facetType = this.consumeToken(); // e.g. '>', '<'
      if ((facetType === '>' || facetType === '<') && this.peekToken() === '=') {
        facetType += this.consumeToken(); // e.g. '>=', '<='
      }
      const facetValue = this.parseLiteral();
      facets.push({ facetType, facetValue });
      if (this.peekToken() === ',') {
        this.consumeToken();
      }
    }
    if (this.peekToken() === ']') {
      this.consumeToken(']');
    }
    return { type: 'DatatypeRestrictions', facets };
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
      const next = this.peekToken();
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
    if (iri.includes(":") && !iri.startsWith("http://") && !iri.startsWith("https://")) {
      return { type: 'QNAME', value: iri };
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
    if (this.baseIri) {
      this.add(this.getURI(`<${this.baseIri}>`), 'rdf:type', this.getURI('owl:Ontology'));
    }
    // 1-for-1 Context Gathering
    this.knownObjectProperties = new Set();
    this.knownDataProperties = new Set();
    for (const node of ast) {
      if (node.type === 'Frame') {
        const kwLower = node.keyword.toLowerCase();
        if (kwLower === 'objectproperty:') {this.knownObjectProperties.add(node.subject);}
        if (kwLower === 'dataproperty:') {this.knownDataProperties.add(node.subject);}
      }
    }

    for (const node of ast) {
      if (node.type === 'Frame') {
        const subject = this.getURI(node.subject);
        const kwLower = node.keyword.toLowerCase();
        
        let rdfType = null;
        if (kwLower === 'class:') {rdfType = 'owl:Class';}
        else if (kwLower === 'objectproperty:') {rdfType = 'owl:ObjectProperty';}
        else if (kwLower === 'dataproperty:') {rdfType = 'owl:DatatypeProperty';}
        else if (kwLower === 'annotationproperty:') {rdfType = 'owl:AnnotationProperty';}
        else if (kwLower === 'individual:') {rdfType = 'owl:NamedIndividual';}
        else if (kwLower === 'datatype:') {rdfType = 'rdfs:Datatype';}
        
        if (rdfType) {
          this.add(subject, 'rdf:type', this.getURI(rdfType));
        }

        for (const item of node.items) {
          const itemKw = item.keyword.toLowerCase();
          let predicate = null;
          
          if (itemKw === 'subclassof:') {predicate = 'rdfs:subClassOf';}
          else if (itemKw === 'superclassof:') {predicate = 'owl:hasSubClass';} // non-standard but often used or inverted
          else if (itemKw === 'equivalentto:') {predicate = 'owl:equivalentClass';}
          else if (itemKw === 'disjointwith:') {predicate = 'owl:disjointWith';}
          else if (itemKw === 'disjointunionof:') {predicate = 'owl:disjointUnionOf';}
          else if (itemKw === 'subpropertyof:') {predicate = 'rdfs:subPropertyOf';}
          else if (itemKw === 'superpropertyof:') {predicate = 'owl:hasSubProperty';}
          else if (itemKw === 'domain:') {predicate = 'rdfs:domain';}
          else if (itemKw === 'range:') {predicate = 'rdfs:range';}
          else if (itemKw === 'types:') {predicate = 'rdf:type';}
          else if (itemKw === 'sameas:') {predicate = 'owl:sameAs';}
          else if (itemKw === 'differentfrom:') {predicate = 'owl:differentFrom';}
          else if (itemKw === 'inverseof:' || itemKw === 'inverses:') {predicate = 'owl:inverseOf';}
          else if (itemKw === 'haskey:') {predicate = 'owl:hasKey';}
          else if (itemKw === 'subpropertychain:') {predicate = 'owl:propertyChainAxiom';}
          
          if (itemKw === 'disjointunionof:' || itemKw === 'haskey:' || itemKw === 'subpropertychain:') {
            // These take a list in OWL 2
            for (const listExpr of item.expressions) {
              if (listExpr.type === 'PropertyChain') {
                const chainList = listExpr.properties;
                this.add(subject, predicate, this.emitList(chainList.map(u => ({ type: 'NamedIndividual', iri: u })))); // emitList expects AST nodes or will pass objects
              } else {
                this.add(subject, predicate, this.emitList(item.expressions));
                break; // Because if it's a list, we emit it once
              }
            }
          } else if (itemKw === 'facts:') {
            for (const fact of item.expressions) {
              const objNode = this.emitExpression(fact.value);
              if (fact.isNegative) {
                const bnode = this.newBNode();
                this.add(bnode, 'rdf:type', this.getURI('owl:NegativePropertyAssertion'));
                this.add(bnode, 'owl:sourceIndividual', subject);
                this.add(bnode, 'owl:assertionProperty', this.getURI(fact.property));
                if (fact.value && fact.value.type === 'Literal') {
                  this.add(bnode, 'owl:targetValue', objNode);
                } else {
                  this.add(bnode, 'owl:targetIndividual', objNode); // Simplified
                }
              } else {
                this.add(subject, fact.property, objNode);
              }
            }
          } else if (itemKw === 'annotations:') {
            for (const ann of item.expressions) {
              const objNode = this.emitExpression(ann.value);
              this.add(subject, ann.property, objNode);
            }
          } else if (itemKw === 'characteristics:') {
            for (const charExpr of item.expressions) {
               const charIri = charExpr.iri ? charExpr.iri.toLowerCase() : "";
               if (charIri === 'functional') {this.add(subject, 'rdf:type', this.getURI('owl:FunctionalProperty'));}
               else if (charIri === 'inversefunctional') {this.add(subject, 'rdf:type', this.getURI('owl:InverseFunctionalProperty'));}
               else if (charIri === 'symmetric') {this.add(subject, 'rdf:type', this.getURI('owl:SymmetricProperty'));}
               else if (charIri === 'transitive') {this.add(subject, 'rdf:type', this.getURI('owl:TransitiveProperty'));}
               else if (charIri === 'reflexive') {this.add(subject, 'rdf:type', this.getURI('owl:ReflexiveProperty'));}
               else if (charIri === 'irreflexive') {this.add(subject, 'rdf:type', this.getURI('owl:IrreflexiveProperty'));}
               else if (charIri === 'asymmetric' || charIri === 'antisymmetric') {this.add(subject, 'rdf:type', this.getURI('owl:AsymmetricProperty'));}
            }
          } else {
            for (const expr of item.expressions) {
              if (predicate) {
                const objNode = this.emitExpression(expr);
                if (objNode) {
                  // If SuperClassOf or SuperPropertyOf, we invert the subject and object
                  if (itemKw === 'superclassof:') {
                    this.add(objNode, 'rdfs:subClassOf', subject);
                  } else if (itemKw === 'superpropertyof:') {
                    this.add(objNode, 'rdfs:subPropertyOf', subject);
                  } else {
                    this.add(subject, predicate, objNode);
                  }
                }
              }
            }
          }
        }
      } else if (node.type === 'TopLevelAxiom') {
        const kwLower = node.keyword.toLowerCase();
        let rdfType = null;
        if (kwLower === 'disjointclasses:') {rdfType = 'owl:AllDisjointClasses';}
        else if (kwLower === 'equivalentclasses:') {rdfType = 'owl:EquivalentClasses';}
        else if (kwLower === 'equivalentproperties:') {rdfType = 'owl:EquivalentProperties';}
        else if (kwLower === 'disjointproperties:') {rdfType = 'owl:AllDisjointProperties';}
        else if (kwLower === 'sameindividual:') {rdfType = 'owl:SameIndividual';}
        else if (kwLower === 'differentindividuals:') {rdfType = 'owl:AllDifferent';}

        if (rdfType) {
          const bnode = this.newBNode();
          this.add(bnode, 'rdf:type', this.getURI(rdfType));
          this.add(bnode, 'owl:members', this.emitList(node.expressions));
        }
      } else if (node.type === 'OntologyAnnotations') {
        const subject = this.baseIri ? this.getURI(`<${this.baseIri}>`) : this.newBNode();
        for (const ann of node.annotations) {
          const objNode = this.emitExpression(ann.value);
          this.add(subject, ann.property, objNode);
        }
      } else if (node.type === 'OntologyImport') {
        const subject = this.baseIri ? this.getURI(`<${this.baseIri}>`) : this.newBNode();
        this.add(subject, 'owl:imports', this.getURI(node.iri));
      } else if (node.type === 'Rule') {
        const bnode = this.newBNode();
        this.add(bnode, 'rdf:type', this.getURI('swrl:Imp'));
        if (node.body && node.body.length > 0) {
          this.add(bnode, 'swrl:body', this.emitList(node.body));
        }
        if (node.head && node.head.length > 0) {
          this.add(bnode, 'swrl:head', this.emitList(node.head));
        }
      }
    }
    return this.triples;
  }
  
  emitList(items) {
    if (!items || items.length === 0) {
      return this.getURI('rdf:nil');
    }
    const headNode = this.newBNode();
    let current = headNode;
    
    for (let i = 0; i < items.length; i++) {
      const itemNode = this.emitExpression(items[i]);
      this.add(current, 'rdf:first', itemNode);
      
      if (i < items.length - 1) {
        const nextNode = this.newBNode();
        this.add(current, 'rdf:rest', nextNode);
        current = nextNode;
      } else {
        this.add(current, 'rdf:rest', this.getURI('rdf:nil'));
      }
    }
    return headNode;
  }
  
  emitExpression(expr) {
    if (!expr) {return null;}
    if (expr.type === 'Class') {
      return this.getURI(expr.iri);
    }
    if (expr.type === 'Individual' || expr.type === 'NamedIndividual') {
      return this.getURI(expr.iri);
    }
    if (expr.type === 'Literal') {
      const dt = expr.datatype ? this.getURI(expr.datatype) : null;
      return { type: 'LITERAL', value: expr.value, lang: expr.lang, datatype: dt };
    }
    if (expr.type === 'SwrlVariable') {
      return this.getURI('urn:swrl:var#' + expr.name);
    }
    if (expr.type === 'SwrlAtom') {
      const bnode = this.newBNode();
      
      const predStr = expr.predicate.toLowerCase();
      const isBuiltin = predStr.startsWith('swrlb:') || predStr.startsWith('http://www.w3.org/2003/11/swrlb#');
      
      if (isBuiltin) {
        this.add(bnode, 'rdf:type', this.getURI('swrl:BuiltinAtom'));
        this.add(bnode, 'swrl:builtin', this.getURI(expr.predicate));
        this.add(bnode, 'swrl:arguments', this.emitList(expr.args));
      } else if (expr.args.length === 1) {
        this.add(bnode, 'rdf:type', this.getURI('swrl:ClassAtom'));
        this.add(bnode, 'swrl:classPredicate', this.getURI(expr.predicate));
        this.add(bnode, 'swrl:argument1', this.emitExpression(expr.args[0]));
      } else if (expr.args.length === 2) {
        // 1-for-1 parity requires checking if it's Object or Data property. Default to ObjectProperty.
        let atomType = 'swrl:IndividualPropertyAtom';
        if (this.knownDataProperties && this.knownDataProperties.has(expr.predicate)) {
          atomType = 'swrl:DatatypePropertyAtom';
        } else if (expr.predicate === 'owl:sameAs') {
          atomType = 'swrl:SameIndividualAtom';
        } else if (expr.predicate === 'owl:differentFrom') {
          atomType = 'swrl:DifferentIndividualsAtom';
        }
        
        this.add(bnode, 'rdf:type', this.getURI(atomType));
        this.add(bnode, 'swrl:propertyPredicate', this.getURI(expr.predicate));
        this.add(bnode, 'swrl:argument1', this.emitExpression(expr.args[0]));
        this.add(bnode, 'swrl:argument2', this.emitExpression(expr.args[1]));
      } else {
        // Fallback for unknown builtins without swrlb: prefix but >2 args
        this.add(bnode, 'rdf:type', this.getURI('swrl:BuiltinAtom'));
        this.add(bnode, 'swrl:builtin', this.getURI(expr.predicate));
        this.add(bnode, 'swrl:arguments', this.emitList(expr.args));
      }
      return bnode;
    }
    
    // Convert binary AST trees into flat arrays for RDF lists
    const flatten = (node, type) => {
      if (node.type === type) {
        return [...flatten(node.left, type), ...flatten(node.right, type)];
      }
      return [node];
    };
    
    if (expr.type === 'Union') {
      const items = flatten(expr, 'Union');
      const bnode = this.newBNode();
      this.add(bnode, 'rdf:type', this.getURI('owl:Class'));
      this.add(bnode, 'owl:unionOf', this.emitList(items));
      return bnode;
    }
    if (expr.type === 'Intersection') {
      const items = flatten(expr, 'Intersection');
      const bnode = this.newBNode();
      this.add(bnode, 'rdf:type', this.getURI('owl:Class'));
      this.add(bnode, 'owl:intersectionOf', this.emitList(items));
      return bnode;
    }
    if (expr.type === 'OneOf') {
      const bnode = this.newBNode();
      this.add(bnode, 'rdf:type', this.getURI('owl:Class'));
      const individuals = expr.individuals.map(iri => ({ type: 'NamedIndividual', iri }));
      this.add(bnode, 'owl:oneOf', this.emitList(individuals));
      return bnode;
    }
    if (expr.type === 'DatatypeWithRestrictions') {
      const bnode = this.newBNode();
      this.add(bnode, 'rdf:type', this.getURI('rdfs:Datatype'));
      this.add(bnode, 'owl:onDatatype', this.getURI(expr.iri));
      
      const restrictionsList = [];
      for (const facet of expr.restrictions.facets) {
        let facetIri = 'xsd:maxInclusive';
        if (facet.facetType === '>=') {facetIri = 'xsd:minInclusive';}
        else if (facet.facetType === '>') {facetIri = 'xsd:minExclusive';}
        else if (facet.facetType === '<=') {facetIri = 'xsd:maxInclusive';}
        else if (facet.facetType === '<') {facetIri = 'xsd:maxExclusive';}
        else if (facet.facetType === 'length') {facetIri = 'xsd:length';}
        else if (facet.facetType === 'minLength') {facetIri = 'xsd:minLength';}
        else if (facet.facetType === 'maxLength') {facetIri = 'xsd:maxLength';}
        else if (facet.facetType === 'pattern') {facetIri = 'xsd:pattern';}
        else if (facet.facetType === 'langRange') {facetIri = 'rdf:langRange';}
        
        const rNode = this.newBNode();
        this.add(rNode, facetIri, { type: 'LITERAL', value: facet.facetValue.val, datatype: facet.facetValue.datatype ? this.getURI(facet.facetValue.datatype) : null, lang: facet.facetValue.lang });
        restrictionsList.push(rNode);
      }
      this.add(bnode, 'owl:withRestrictions', this.emitList(restrictionsList.map(n => ({ type: 'RawBNode', id: n }))));
      return bnode;
    }
    
    if (expr.type === 'RawBNode') {
      return expr.id;
    }

    if (expr.type === 'Restriction') {
      if (expr.restrictionType === 'onlysome') {
         // onlysome is an intersection of some and only.
         const someNode = this.newBNode();
         this.add(someNode, 'rdf:type', this.getURI('owl:Restriction'));
         this.add(someNode, 'owl:onProperty', this.getURI(expr.property));
         this.add(someNode, 'owl:someValuesFrom', this.emitExpression(expr.filler));
         
         const onlyNode = this.newBNode();
         this.add(onlyNode, 'rdf:type', this.getURI('owl:Restriction'));
         this.add(onlyNode, 'owl:onProperty', this.getURI(expr.property));
         this.add(onlyNode, 'owl:allValuesFrom', this.emitExpression(expr.filler));
         
         const interNode = this.newBNode();
         this.add(interNode, 'rdf:type', this.getURI('owl:Class'));
         this.add(interNode, 'owl:intersectionOf', this.emitList([{type: 'RawBNode', id: someNode}, {type: 'RawBNode', id: onlyNode}]));
         return interNode;
      }
      
      const bnode = this.newBNode();
      this.add(bnode, 'rdf:type', this.getURI('owl:Restriction'));
      this.add(bnode, 'owl:onProperty', this.getURI(expr.property));
      
      if (expr.filler && expr.filler.type === 'Self') {
        this.add(bnode, 'owl:hasSelf', { type: 'LITERAL', value: 'true', datatype: this.getURI('xsd:boolean') });
      } else {
        const fillerNode = this.emitExpression(expr.filler);
        if (expr.restrictionType === 'some') {
          this.add(bnode, 'owl:someValuesFrom', fillerNode);
        } else if (expr.restrictionType === 'only') {
          this.add(bnode, 'owl:allValuesFrom', fillerNode);
        } else if (expr.restrictionType === 'value') {
          this.add(bnode, 'owl:hasValue', fillerNode);
        } else if (expr.restrictionType === 'min') {
          this.add(bnode, 'owl:minQualifiedCardinality', { type: 'LITERAL', value: expr.cardinality.toString(), datatype: this.getURI('xsd:nonNegativeInteger') });
          if (fillerNode) {this.add(bnode, 'owl:onClass', fillerNode);}
        } else if (expr.restrictionType === 'max') {
          this.add(bnode, 'owl:maxQualifiedCardinality', { type: 'LITERAL', value: expr.cardinality.toString(), datatype: this.getURI('xsd:nonNegativeInteger') });
          if (fillerNode) {this.add(bnode, 'owl:onClass', fillerNode);}
        } else if (expr.restrictionType === 'exactly') {
          this.add(bnode, 'owl:qualifiedCardinality', { type: 'LITERAL', value: expr.cardinality.toString(), datatype: this.getURI('xsd:nonNegativeInteger') });
          if (fillerNode) {this.add(bnode, 'owl:onClass', fillerNode);}
        }
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
  if (!text) {return false;}
  return /^\s*(Prefix:|Ontology:|Class:|ObjectProperty:|DataProperty:|Individual:|AnnotationProperty:|Datatype:|Rule:|ValuePartition:)/i.test(text);
}

export function convertManchesterSyntaxToRdfXml(text, options = { strictMode: false }) {
  const resolvedText = resolveXmlEntities(text);
  const lexer = new ManchesterLexer(resolvedText);
  const parser = new ManchesterParser(lexer, options);
  const ast = parser.parse();
  
  const emitter = new TriplesEmitter(parser.prefixes, parser.baseIri);
  emitter.emit(ast);
  
  return serializeTriplesToRdfXml(emitter.triples, parser.prefixes, parser.baseIri);
}

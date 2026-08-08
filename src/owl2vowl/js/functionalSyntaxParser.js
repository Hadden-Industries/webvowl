import { serializeTriplesToRdfXml } from "./rdfXmlSerializer.js";
import { MAX_SNIFF_BYTES } from "./constants.js";

export function isFunctionalSyntaxFormat(text) {
  if (!text) { return false; }
  // Check if it looks like OFN by searching for Ontology( or Prefix(
  const snippet = text.slice(0, MAX_SNIFF_BYTES);
  return /^\s*(Prefix|Ontology)\s*\(/i.test(snippet);
}

const TokenTypes = {
  LPAREN: "LPAREN",
  RPAREN: "RPAREN",
  EQUALS: "EQUALS",
  KEYWORD: "KEYWORD",
  FULL_IRI: "FULL_IRI",
  PNAME_LN: "PNAME_LN",
  PNAME_NS: "PNAME_NS",
  BLANK_NODE: "BLANK_NODE",
  STRING_LITERAL: "STRING_LITERAL",
  LANG_TAG: "LANG_TAG",
  DATATYPE_MARKER: "DATATYPE_MARKER",
  INTEGER: "INTEGER",
  EOF: "EOF"
};

class FunctionalLexer {
  constructor(text) {
    this.text = text;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
  }

  nextToken() {
    this.skipWhitespaceAndComments();
    if (this.pos >= this.text.length) {
      return { type: TokenTypes.EOF, value: "EOF", startOffset: this.pos, endOffset: this.pos, line: this.line, column: this.col };
    }

    const char = this.text[this.pos];
    const startOffset = this.pos;
    const startLine = this.line;
    const startCol = this.col;

    let type, value;

    if (char === "(") {
      type = TokenTypes.LPAREN;
      value = "(";
      this.advance();
    } else if (char === ")") {
      type = TokenTypes.RPAREN;
      value = ")";
      this.advance();
    } else if (char === "=") {
      type = TokenTypes.EQUALS;
      value = "=";
      this.advance();
    } else if (char === "<") {
      type = TokenTypes.FULL_IRI;
      value = this.readUntil(">");
    } else if (char === '"') {
      type = TokenTypes.STRING_LITERAL;
      value = this.readString();
    } else if (char === "@") {
      type = TokenTypes.LANG_TAG;
      value = this.readWhile(/[a-zA-Z0-9-]/);
    } else if (char === "^" && this.text[this.pos + 1] === "^") {
      type = TokenTypes.DATATYPE_MARKER;
      value = "^^";
      this.advance();
      this.advance();
    } else if (char === "_" && this.text[this.pos + 1] === ":") {
      type = TokenTypes.BLANK_NODE;
      value = this.readWhile(/[a-zA-Z0-9_:-]/);
    } else {
      const word = this.readWhile(/[a-zA-Z0-9_:-]/);
      if (!word) {
        throw new Error(`Lexer error at line ${startLine}:${startCol}: Unexpected character '${char}'`);
      }
      if (/^[0-9]+$/.test(word)) {
        type = TokenTypes.INTEGER;
        value = word;
      } else if (word.includes(":")) {
        type = word.endsWith(":") ? TokenTypes.PNAME_NS : TokenTypes.PNAME_LN;
        value = word;
      } else {
        type = TokenTypes.KEYWORD;
        value = word;
      }
    }

    return {
      type, value, startOffset, endOffset: this.pos, line: startLine, column: startCol
    };
  }

  advance() {
    if (this.text[this.pos] === "\n") {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    this.pos++;
  }

  skipWhitespaceAndComments() {
    while (this.pos < this.text.length) {
      const char = this.text[this.pos];
      if (/\s/.test(char)) {
        this.advance();
      } else if (char === "#") {
        while (this.pos < this.text.length && this.text[this.pos] !== "\n") {this.advance();}
      } else {
        break;
      }
    }
  }

  readUntil(endChar) {
    let result = "";
    this.advance();
    while (this.pos < this.text.length && this.text[this.pos] !== endChar) {
      result += this.text[this.pos];
      this.advance();
    }
    if (this.pos < this.text.length) {this.advance();}
    return result;
  }

  readString() {
    let result = "";
    this.advance();
    while (this.pos < this.text.length) {
      const char = this.text[this.pos];
      if (char === '"') {
        this.advance();
        break;
      }
      if (char === '\\') {
        this.advance();
        result += this.text[this.pos];
      } else {
        result += char;
      }
      this.advance();
    }
    return result;
  }

  readWhile(regex) {
    let result = "";
    while (this.pos < this.text.length && regex.test(this.text[this.pos])) {
      result += this.text[this.pos];
      this.advance();
    }
    return result;
  }
}

class TokenStream {
  constructor(lexer) {
    this.lexer = lexer;
    this.buffer = [];
  }

  peek(offset = 0) {
    while (this.buffer.length <= offset) {
      const token = this.lexer.nextToken();
      this.buffer.push(token);
      if (token.type === TokenTypes.EOF) {
        break;
      }
    }
    return this.buffer[offset] || this.buffer[this.buffer.length - 1];
  }

  consume(expectedType) {
    const token = this.peek();
    if (expectedType && token.type !== expectedType) {
      throw new Error(`Parse error at line ${token.line}:${token.column}: Expected ${expectedType}, got ${token.type} ('${token.value}')`);
    }
    this.buffer.shift();
    return token;
  }

  match(type) {
    return this.peek().type === type;
  }

  matchKeyword(kw) {
    const token = this.peek();
    return token.type === TokenTypes.KEYWORD && token.value === kw;
  }

  consumeKeyword(kw) {
    const token = this.peek();
    if (token.type !== TokenTypes.KEYWORD || token.value !== kw) {
      throw new Error(`Parse error at line ${token.line}:${token.column}: Expected keyword ${kw}, got ${token.type} ('${token.value}')`);
    }
    this.buffer.shift();
    return token;
  }
}

class TriplesEmitter {
  constructor() {
    this.ontologyIri = "http://example.com/ontology";
    this.prefixes = {};
    this.triples = [];
    this.bnodeCounter = 0;
  }

  setOntologyIri(iri) {
    this.ontologyIri = iri;
    this.addTriple(iri, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "http://www.w3.org/2002/07/owl#Ontology");
  }

  addPrefix(pfx, ns) {
    const cleanPfx = pfx.endsWith(":") ? pfx.slice(0, -1) : pfx;
    this.prefixes[cleanPfx] = ns;
  }

  newBNode() {
    this.bnodeCounter++;
    return { type: "BNODE", value: `fnode_${this.bnodeCounter}` };
  }

  addTriple(subj, pred, obj) {
    const sTerm = typeof subj === "string" ? { type: subj.startsWith("_:") ? "BNODE" : "URI", value: subj } : subj;
    const pTerm = typeof pred === "string" ? { type: "IRI", value: pred } : pred;
    const oTerm = typeof obj === "string" ? { type: obj.startsWith("_:") ? "BNODE" : "URI", value: obj } : obj;
    this.triples.push({ subject: sTerm, predicate: pTerm, object: oTerm });
  }

  addClass(iri) {
    this.addTriple(iri, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "http://www.w3.org/2002/07/owl#Class");
  }

  addObjectProperty(iri) {
    this.addTriple(iri, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "http://www.w3.org/2002/07/owl#ObjectProperty");
  }

  addDataProperty(iri) {
    this.addTriple(iri, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "http://www.w3.org/2002/07/owl#DatatypeProperty");
  }

  addNamedIndividual(iri) {
    this.addTriple(iri, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "http://www.w3.org/2002/07/owl#NamedIndividual");
  }

  addDatatype(iri) {
    this.addTriple(iri, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "http://www.w3.org/2000/01/rdf-schema#Datatype");
  }

  addAnnotationProperty(iri) {
    this.addTriple(iri, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "http://www.w3.org/2002/07/owl#AnnotationProperty");
  }

  emitList(items) {
    if (!items || items.length === 0) {
      return { type: "URI", value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil" };
    }
    const headNode = this.newBNode();
    let current = headNode;

    for (let i = 0; i < items.length; i++) {
      const itemNode = this.emitExpression(items[i]);
      this.addTriple(current, "http://www.w3.org/1999/02/22-rdf-syntax-ns#first", itemNode);

      if (i < items.length - 1) {
        const nextNode = this.newBNode();
        this.addTriple(current, "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest", nextNode);
        current = nextNode;
      } else {
        this.addTriple(current, "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest", { type: "URI", value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil" });
      }
    }
    return headNode;
  }

  emitExpression(expr) {
    if (!expr) { return null; }
    if (expr.type === "IRI") {
      return { type: "URI", value: expr.iri };
    }
    if (expr.type === "ObjectIntersectionOf" || expr.type === "ObjectUnionOf") {
      const bnode = this.newBNode();
      this.addTriple(bnode, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "http://www.w3.org/2002/07/owl#Class");
      const tag = expr.type === "ObjectIntersectionOf"
        ? "http://www.w3.org/2002/07/owl#intersectionOf"
        : "http://www.w3.org/2002/07/owl#unionOf";
      const listHead = this.emitList(expr.classes);
      this.addTriple(bnode, tag, listHead);
      return bnode;
    }
    if (expr.type === "ObjectSomeValuesFrom" || expr.type === "ObjectAllValuesFrom") {
      const bnode = this.newBNode();
      this.addTriple(bnode, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "http://www.w3.org/2002/07/owl#Restriction");
      this.addTriple(bnode, "http://www.w3.org/2002/07/owl#onProperty", { type: "URI", value: expr.property });
      const tag = expr.type === "ObjectSomeValuesFrom"
        ? "http://www.w3.org/2002/07/owl#someValuesFrom"
        : "http://www.w3.org/2002/07/owl#allValuesFrom";
      const fillerNode = this.emitExpression(expr.filler);
      this.addTriple(bnode, tag, fillerNode);
      return bnode;
    }
    if (expr.type === "ObjectHasValue") {
      const bnode = this.newBNode();
      this.addTriple(bnode, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", "http://www.w3.org/2002/07/owl#Restriction");
      this.addTriple(bnode, "http://www.w3.org/2002/07/owl#onProperty", { type: "URI", value: expr.property });
      this.addTriple(bnode, "http://www.w3.org/2002/07/owl#hasValue", { type: "URI", value: expr.individual });
      return bnode;
    }
    return { type: "URI", value: "http://www.w3.org/2002/07/owl#Thing" };
  }

  addSubClassOf(subExpr, superExpr) {
    const subNode = this.emitExpression(subExpr);
    const superNode = this.emitExpression(superExpr);
    this.addTriple(subNode, "http://www.w3.org/2000/01/rdf-schema#subClassOf", superNode);
  }

  addEquivalentClass(exprA, exprB) {
    const nodeA = this.emitExpression(exprA);
    const nodeB = this.emitExpression(exprB);
    this.addTriple(nodeA, "http://www.w3.org/2002/07/owl#equivalentClass", nodeB);
  }

  addSubObjectPropertyOf(subIri, superIri) {
    this.addTriple(subIri, "http://www.w3.org/2000/01/rdf-schema#subPropertyOf", superIri);
  }

  serialize() {
    return serializeTriplesToRdfXml(this.triples, this.prefixes, this.ontologyIri);
  }
}

class FunctionalParser {
  constructor(stream) {
    this.stream = stream;
    this.triples = new TriplesEmitter();
    this.prefixMap = new Map();
    const defaults = [
      ["owl:", "http://www.w3.org/2002/07/owl#"],
      ["rdf:", "http://www.w3.org/1999/02/22-rdf-syntax-ns#"],
      ["rdfs:", "http://www.w3.org/2000/01/rdf-schema#"],
      ["xsd:", "http://www.w3.org/2001/XMLSchema#"]
    ];
    for (const [pfx, ns] of defaults) {
      this.prefixMap.set(pfx, ns);
      this.triples.addPrefix(pfx, ns);
    }
  }

  parseDocument() {
    while (this.stream.matchKeyword("Prefix")) {
      this.parsePrefix();
    }
    this.parseOntology();
    this.stream.consume(TokenTypes.EOF);
    return this.triples.serialize();
  }

  parsePrefix() {
    this.stream.consumeKeyword("Prefix");
    this.stream.consume(TokenTypes.LPAREN);
    let prefixName = ":";
    if (this.stream.match(TokenTypes.PNAME_NS)) {
      prefixName = this.stream.consume(TokenTypes.PNAME_NS).value;
    } else if (this.stream.peek().value === ":") {
      this.stream.consume();
    }
    this.stream.consume(TokenTypes.EQUALS);
    const iriToken = this.stream.consume(TokenTypes.FULL_IRI);
    this.prefixMap.set(prefixName, iriToken.value);
    this.triples.addPrefix(prefixName, iriToken.value);
    this.stream.consume(TokenTypes.RPAREN);
  }

  getIRI(token) {
    if (token.type === TokenTypes.FULL_IRI) {return token.value;}
    if (token.type === TokenTypes.PNAME_LN || token.type === TokenTypes.PNAME_NS) {
      const parts = token.value.split(":");
      const prefix = parts[0] + ":";
      const localName = parts[1] || "";
      if (this.prefixMap.has(prefix)) {return this.prefixMap.get(prefix) + localName;}
      throw new Error(`Parse error at line ${token.line}:${token.column}: Unresolved prefix '${prefix}'`);
    }
    throw new Error(`Parse error at line ${token.line}:${token.column}: Expected IRI, got ${token.type} ('${token.value}')`);
  }

  parseOntology() {
    this.stream.consumeKeyword("Ontology");
    this.stream.consume(TokenTypes.LPAREN);
    if (this.stream.match(TokenTypes.FULL_IRI) || this.stream.match(TokenTypes.PNAME_LN) || this.stream.match(TokenTypes.PNAME_NS)) {
      const iriToken = this.stream.consume();
      this.triples.setOntologyIri(this.getIRI(iriToken));
    }
    while (!this.stream.match(TokenTypes.RPAREN)) {
      if (this.stream.matchKeyword("Declaration")) {this.parseDeclaration();}
      else if (this.stream.matchKeyword("SubClassOf")) {this.parseSubClassOf();}
      else if (this.stream.matchKeyword("EquivalentClasses")) {this.parseEquivalentClasses();}
      else if (this.stream.matchKeyword("SubObjectPropertyOf")) {this.parseSubObjectPropertyOf();}
      else {this.skipUnknownAxiom();}
    }
    this.stream.consume(TokenTypes.RPAREN);
  }

  skipUnknownAxiom() {
    this.stream.consume(TokenTypes.KEYWORD);
    this.stream.consume(TokenTypes.LPAREN);
    let depth = 1;
    while (depth > 0) {
      const t = this.stream.consume();
      if (t.type === TokenTypes.LPAREN) {depth++;}
      else if (t.type === TokenTypes.RPAREN) {depth--;}
      else if (t.type === TokenTypes.EOF) {break;}
    }
  }

  parseDeclaration() {
    this.stream.consumeKeyword("Declaration");
    this.stream.consume(TokenTypes.LPAREN);
    const entityTypeToken = this.stream.consume(TokenTypes.KEYWORD);
    const entityType = entityTypeToken.value;
    this.stream.consume(TokenTypes.LPAREN);
    const iriToken = this.stream.consume();
    const iri = this.getIRI(iriToken);

    if (entityType === "Class") {this.triples.addClass(iri);}
    else if (entityType === "ObjectProperty") {this.triples.addObjectProperty(iri);}
    else if (entityType === "DataProperty") {this.triples.addDataProperty(iri);}
    else if (entityType === "NamedIndividual") {this.triples.addNamedIndividual(iri);}
    else if (entityType === "Datatype") {this.triples.addDatatype(iri);}
    else if (entityType === "AnnotationProperty") {this.triples.addAnnotationProperty(iri);}

    this.stream.consume(TokenTypes.RPAREN);
    this.stream.consume(TokenTypes.RPAREN);
  }

  parseClassExpression() {
    const token = this.stream.peek();
    if (token.type === TokenTypes.KEYWORD && token.value !== "owl:Thing" && token.value !== "owl:Nothing") {
      const kw = this.stream.consume(TokenTypes.KEYWORD).value;
      this.stream.consume(TokenTypes.LPAREN);

      const expr = { type: kw };
      if (kw === "ObjectIntersectionOf" || kw === "ObjectUnionOf") {
        expr.classes = [];
        while (!this.stream.match(TokenTypes.RPAREN)) {expr.classes.push(this.parseClassExpression());}
      } else if (kw === "ObjectSomeValuesFrom" || kw === "ObjectAllValuesFrom") {
        expr.property = this.getIRI(this.stream.consume());
        expr.filler = this.parseClassExpression();
      } else if (kw === "ObjectHasValue") {
        expr.property = this.getIRI(this.stream.consume());
        expr.individual = this.getIRI(this.stream.consume());
      } else {
        // Fallback for unknown nested expressions
        let depth = 1;
        while (depth > 0) {
          const t = this.stream.consume();
          if (t.type === TokenTypes.LPAREN) {depth++;}
          else if (t.type === TokenTypes.RPAREN) {depth--;}
          else if (t.type === TokenTypes.EOF) {break;}
        }
        return { type: "IRI", iri: "http://www.w3.org/2002/07/owl#Thing" };
      }
      this.stream.consume(TokenTypes.RPAREN);
      return expr;
    } else {
      const t = this.stream.consume();
      if (t.value === "owl:Thing") {return { type: "IRI", iri: "http://www.w3.org/2002/07/owl#Thing" };}
      if (t.value === "owl:Nothing") {return { type: "IRI", iri: "http://www.w3.org/2002/07/owl#Nothing" };}
      return { type: "IRI", iri: this.getIRI(t) };
    }
  }

  parseSubClassOf() {
    this.stream.consumeKeyword("SubClassOf");
    this.stream.consume(TokenTypes.LPAREN);
    const subExpr = this.parseClassExpression();
    const superExpr = this.parseClassExpression();
    this.triples.addSubClassOf(subExpr, superExpr);
    this.stream.consume(TokenTypes.RPAREN);
  }

  parseEquivalentClasses() {
    this.stream.consumeKeyword("EquivalentClasses");
    this.stream.consume(TokenTypes.LPAREN);
    const classes = [];
    while (!this.stream.match(TokenTypes.RPAREN)) {classes.push(this.parseClassExpression());}
    for (let i = 0; i < classes.length - 1; i++) {
      this.triples.addEquivalentClass(classes[i], classes[i+1]);
    }
    this.stream.consume(TokenTypes.RPAREN);
  }

  parseSubObjectPropertyOf() {
    this.stream.consumeKeyword("SubObjectPropertyOf");
    this.stream.consume(TokenTypes.LPAREN);
    const subToken = this.stream.consume();
    const superToken = this.stream.consume();
    this.triples.addSubObjectPropertyOf(this.getIRI(subToken), this.getIRI(superToken));
    this.stream.consume(TokenTypes.RPAREN);
  }
}

export function parseFunctionalSyntax(text) {
  const lexer = new FunctionalLexer(text);
  const stream = new TokenStream(lexer);
  const parser = new FunctionalParser(stream);
  return parser.parseDocument();
}



/* eslint-disable no-use-before-define */
export function isFunctionalSyntaxFormat(text) {
  // Check if it looks like OFN by searching for Ontology( or Prefix(
  return /^\s*(Prefix|Ontology)\s*\(/i.test(text);
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
    this.classes = {};
    this.objectProperties = {};
    this.dataProperties = {};
    this.namedIndividuals = {};
    this.datatypes = {};
    this.annotationProperties = {};
    this.axioms = [];
  }

  setOntologyIri(iri) { this.ontologyIri = iri; }
  
  ensureClass(iri) {
    if (!this.classes[iri]) {this.classes[iri] = true;}
  }
  
  ensureObjectProperty(iri) {
    if (!this.objectProperties[iri]) {this.objectProperties[iri] = true;}
  }

  addClass(iri) { this.ensureClass(iri); }
  addObjectProperty(iri) { this.ensureObjectProperty(iri); }
  addDataProperty(iri) { this.dataProperties[iri] = true; }
  addNamedIndividual(iri) { this.namedIndividuals[iri] = true; }
  addDatatype(iri) { this.datatypes[iri] = true; }
  addAnnotationProperty(iri) { this.annotationProperties[iri] = true; }

  addSubClassOf(subExpr, superExpr) {
    this.axioms.push({ type: "SubClassOf", sub: subExpr, sup: superExpr });
  }

  addEquivalentClass(exprA, exprB) {
    this.axioms.push({ type: "EquivalentClasses", a: exprA, b: exprB });
  }

  addSubObjectPropertyOf(subIri, superIri) {
    this.axioms.push({ type: "SubObjectPropertyOf", sub: subIri, sup: superIri });
  }

  renderClassExpression(expr, indent) {
    if (expr.type === "IRI") {
      return `<owl:Class rdf:about="${expr.iri}"/>`;
    }
    if (expr.type === "ObjectIntersectionOf" || expr.type === "ObjectUnionOf") {
      const tag = expr.type === "ObjectIntersectionOf" ? "owl:intersectionOf" : "owl:unionOf";
      const parts = expr.classes.map(c => this.renderClassExpression(c, indent + "      ")).join("\n");
      return `<owl:Class>\n${indent}  <${tag} rdf:parseType="Collection">\n${parts}\n${indent}  </${tag}>\n${indent}</owl:Class>`;
    }
    if (expr.type === "ObjectSomeValuesFrom" || expr.type === "ObjectAllValuesFrom") {
      const tag = expr.type === "ObjectSomeValuesFrom" ? "owl:someValuesFrom" : "owl:allValuesFrom";
      if (expr.filler.type === "IRI") {
        return `<owl:Restriction>\n${indent}  <owl:onProperty rdf:resource="${expr.property}"/>\n${indent}  <${tag} rdf:resource="${expr.filler.iri}"/>\n${indent}</owl:Restriction>`;
      } else {
        const filler = this.renderClassExpression(expr.filler, indent + "    ");
        return `<owl:Restriction>\n${indent}  <owl:onProperty rdf:resource="${expr.property}"/>\n${indent}  <${tag}>\n${indent}    ${filler}\n${indent}  </${tag}>\n${indent}</owl:Restriction>`;
      }
    }
    if (expr.type === "ObjectHasValue") {
      return `<owl:Restriction>\n${indent}  <owl:onProperty rdf:resource="${expr.property}"/>\n${indent}  <owl:hasValue rdf:resource="${expr.individual}"/>\n${indent}</owl:Restriction>`;
    }
    return `<owl:Class rdf:about="http://www.w3.org/2002/07/owl#Thing"/>`;
  }

  serialize() {
    const lines = [
      `<?xml version="1.0" encoding="utf-8"?>`,
      `<rdf:RDF`,
      `  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"`,
      `  xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"`,
      `  xmlns:owl="http://www.w3.org/2002/07/owl#"`,
      `  xml:base="${this.ontologyIri}">`,
      `  <owl:Ontology rdf:about="${this.ontologyIri}"/>`
    ];
    
    // Group axioms by subject if it's an IRI, otherwise just dump them as subClassOf tags inside owl:Class
    const grouped = {};
    for (const ax of this.axioms) {
      if (ax.type === "SubClassOf" && ax.sub.type === "IRI") {
        if (!grouped[ax.sub.iri]) {grouped[ax.sub.iri] = [];}
        grouped[ax.sub.iri].push(ax);
      } else if (ax.type === "EquivalentClasses" && ax.a.type === "IRI") {
        if (!grouped[ax.a.iri]) {grouped[ax.a.iri] = [];}
        grouped[ax.a.iri].push(ax);
      }
    }
    
    for (const iri of Object.keys(this.classes)) {
      if (!grouped[iri] || grouped[iri].length === 0) {
        lines.push(`  <owl:Class rdf:about="${iri}"/>`);
      } else {
        lines.push(`  <owl:Class rdf:about="${iri}">`);
        for (const ax of grouped[iri]) {
          if (ax.type === "SubClassOf") {
            const inner = this.renderClassExpression(ax.sup, "      ");
            // If the super class is just an IRI, we can do rdf:resource
            if (ax.sup.type === "IRI") {
              lines.push(`    <rdfs:subClassOf rdf:resource="${ax.sup.iri}"/>`);
            } else {
              lines.push(`    <rdfs:subClassOf>\n      ${inner}\n    </rdfs:subClassOf>`);
            }
          } else if (ax.type === "EquivalentClasses") {
            if (ax.b.type === "IRI") {
              lines.push(`    <owl:equivalentClass rdf:resource="${ax.b.iri}"/>`);
            } else {
              const inner = this.renderClassExpression(ax.b, "      ");
              lines.push(`    <owl:equivalentClass>\n      ${inner}\n    </owl:equivalentClass>`);
            }
          }
        }
        lines.push(`  </owl:Class>`);
      }
    }

    const propGrouped = {};
    for (const ax of this.axioms) {
      if (ax.type === "SubObjectPropertyOf") {
        if (!propGrouped[ax.sub]) {propGrouped[ax.sub] = [];}
        propGrouped[ax.sub].push(ax.sup);
      }
    }

    for (const iri of Object.keys(this.objectProperties)) {
      if (!propGrouped[iri]) {
        lines.push(`  <owl:ObjectProperty rdf:about="${iri}"/>`);
      } else {
        lines.push(`  <owl:ObjectProperty rdf:about="${iri}">`);
        for (const sup of propGrouped[iri]) {
          lines.push(`    <rdfs:subPropertyOf rdf:resource="${sup}"/>`);
        }
        lines.push(`  </owl:ObjectProperty>`);
      }
    }

    for (const iri of Object.keys(this.dataProperties)) {lines.push(`  <owl:DatatypeProperty rdf:about="${iri}"/>`);}
    for (const iri of Object.keys(this.namedIndividuals)) {lines.push(`  <owl:NamedIndividual rdf:about="${iri}"/>`);}
    for (const iri of Object.keys(this.datatypes)) {lines.push(`  <rdfs:Datatype rdf:about="${iri}"/>`);}
    for (const iri of Object.keys(this.annotationProperties)) {lines.push(`  <owl:AnnotationProperty rdf:about="${iri}"/>`);}

    lines.push(`</rdf:RDF>`);
    return lines.join("\n");
  }
}
export function parseFunctionalSyntax(text) {
  const lexer = new FunctionalLexer(text);
  const stream = new TokenStream(lexer);
  const parser = new FunctionalParser(stream);
  return parser.parseDocument();
}

class FunctionalParser {
  constructor(stream) {
    this.stream = stream;
    this.triples = new TriplesEmitter();
    this.prefixMap = new Map();
    this.prefixMap.set("owl:", "http://www.w3.org/2002/07/owl#");
    this.prefixMap.set("rdf:", "http://www.w3.org/1999/02/22-rdf-syntax-ns#");
    this.prefixMap.set("rdfs:", "http://www.w3.org/2000/01/rdf-schema#");
    this.prefixMap.set("xsd:", "http://www.w3.org/2001/XMLSchema#");
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



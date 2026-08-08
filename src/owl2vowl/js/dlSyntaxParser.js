import { serializeTriplesToRdfXml } from "./rdfXmlSerializer.js";
import { MAX_SNIFF_BYTES } from "./constants.js";

export function isDLSyntaxFormat(text) {
  if (!text) {
    return false;
  }
  const snippet = text.slice(0, MAX_SNIFF_BYTES);
  // If it's clearly XML, Turtle, Functional, or Manchester, reject early.
  if (/^\s*(<|@prefix|Prefix|Ontology)/i.test(snippet)) {
    return false;
  }

  // Look for characteristic DL syntax operators in the header snippet.
  // Unicode math operators, LaTeX equivalents, and ASCII fallbacks.
  // We avoid 'sub' and 'not' to prevent false positives with other syntaxes.
  return /(⊑|≡|≠|⊓|⊔|∃|∀|\\sqsubseteq|\\equiv|\\not=|\\sqcap|\\sqcup|\\exists|\\forall|->|==|!=)/.test(
    snippet,
  );
}

const TokenTypes = {
  SUBCLASSOF: "SUBCLASSOF",
  EQUIVALENTTO: "EQUIVALENTTO",
  NEQ: "NEQ",
  COMPOSE: "COMPOSE",
  DOT: "DOT",
  INVERSE: "INVERSE",
  OPENPAR: "OPENPAR",
  CLOSEPAR: "CLOSEPAR",
  OPENSQPAR: "OPENSQPAR",
  CLOSESQPAR: "CLOSESQPAR",
  OPENBRACE: "OPENBRACE",
  CLOSEBRACE: "CLOSEBRACE",
  COLON: "COLON",
  AND: "AND",
  OR: "OR",
  NOT: "NOT",
  SOME: "SOME",
  ALL: "ALL",
  MIN: "MIN",
  MAX: "MAX",
  EXACT: "EXACT",
  IN: "IN",
  TRANSITIVEROLES: "TRANSITIVEROLES",
  INT: "INT",
  DOUBLE: "DOUBLE",
  ID: "ID",
  NEWLINE: "NEWLINE",
  EOF: "EOF",
};

class DLSyntaxLexer {
  constructor(text) {
    this.text = text;
    this.pos = 0;
    this.line = 1;
    this.col = 1;
    this.delimiters = new Set([
      " ",
      "\n",
      "\t",
      "(",
      ")",
      "[",
      "]",
      "{",
      "}",
      ",",
      "^",
      "=",
      "<",
      ">",
      ".",
      "\u207B",
      "\u00AC",
      "\u2208",
    ]);
  }

  nextToken() {
    this.skipWhitespace(); // only skips ' ', '\t', '\r'

    if (this.pos >= this.text.length) {
      return {
        type: TokenTypes.EOF,
        value: "EOF",
        line: this.line,
        column: this.col,
      };
    }

    const startLine = this.line;
    const startCol = this.col;
    const char = this.text[this.pos];

    if (char === "\n") {
      this.advance();
      return {
        type: TokenTypes.NEWLINE,
        value: "\n",
        line: startLine,
        column: startCol,
      };
    }
    if (char === "(") {
      this.advance();
      return {
        type: TokenTypes.OPENPAR,
        value: "(",
        line: startLine,
        column: startCol,
      };
    }
    if (char === ")") {
      this.advance();
      return {
        type: TokenTypes.CLOSEPAR,
        value: ")",
        line: startLine,
        column: startCol,
      };
    }
    if (char === "[") {
      this.advance();
      return {
        type: TokenTypes.OPENSQPAR,
        value: "[",
        line: startLine,
        column: startCol,
      };
    }
    if (char === "]") {
      this.advance();
      return {
        type: TokenTypes.CLOSESQPAR,
        value: "]",
        line: startLine,
        column: startCol,
      };
    }
    if (char === "{") {
      this.advance();
      return {
        type: TokenTypes.OPENBRACE,
        value: "{",
        line: startLine,
        column: startCol,
      };
    }
    if (char === "}") {
      this.advance();
      return {
        type: TokenTypes.CLOSEBRACE,
        value: "}",
        line: startLine,
        column: startCol,
      };
    }
    if (char === ",") {
      this.advance();
      return {
        type: TokenTypes.ID,
        value: ",",
        line: startLine,
        column: startCol,
      };
    } // In DL Syntax JavaCC, ',' is just part of parser rules literally, but we can treat as ID or specific token. Actually, wait, it's not a named token but matched literally. We'll emit it as ID or special token. Let's make it a token or just ID. Let's use ID for literal commas to match JavaCC `","`.
    if (char === ":") {
      this.advance();
      return {
        type: TokenTypes.COLON,
        value: ":",
        line: startLine,
        column: startCol,
      };
    }
    if (char === ".") {
      this.advance();
      return {
        type: TokenTypes.DOT,
        value: ".",
        line: startLine,
        column: startCol,
      };
    }

    // Multi-char operators
    if (this.matchPrefix("->") || this.matchPrefix("\\sqsubseteq")) {
      const val = this.matchPrefix("->") ? "->" : "\\sqsubseteq";
      this.advanceBy(val.length);
      return {
        type: TokenTypes.SUBCLASSOF,
        value: val,
        line: startLine,
        column: startCol,
      };
    }
    if (char === "\u2291") {
      this.advance();
      return {
        type: TokenTypes.SUBCLASSOF,
        value: "\u2291",
        line: startLine,
        column: startCol,
      };
    }

    if (this.matchPrefix("==") || this.matchPrefix("\\equiv")) {
      const val = this.matchPrefix("==") ? "==" : "\\equiv";
      this.advanceBy(val.length);
      return {
        type: TokenTypes.EQUIVALENTTO,
        value: val,
        line: startLine,
        column: startCol,
      };
    }
    if (char === "\u2261") {
      this.advance();
      return {
        type: TokenTypes.EQUIVALENTTO,
        value: "\u2261",
        line: startLine,
        column: startCol,
      };
    }

    if (this.matchPrefix("!=") || this.matchPrefix("\\not=")) {
      const val = this.matchPrefix("!=") ? "!=" : "\\not=";
      this.advanceBy(val.length);
      return {
        type: TokenTypes.NEQ,
        value: val,
        line: startLine,
        column: startCol,
      };
    }
    if (char === "\u2260") {
      this.advance();
      return {
        type: TokenTypes.NEQ,
        value: "\u2260",
        line: startLine,
        column: startCol,
      };
    }

    if (this.matchPrefix("^-")) {
      this.advanceBy(2);
      return {
        type: TokenTypes.INVERSE,
        value: "^-",
        line: startLine,
        column: startCol,
      };
    }
    if (char === "\u207B") {
      this.advance();
      return {
        type: TokenTypes.INVERSE,
        value: "\u207B",
        line: startLine,
        column: startCol,
      };
    }

    if (this.matchPrefix("\\sqcap")) {
      this.advanceBy(6);
      return {
        type: TokenTypes.AND,
        value: "\\sqcap",
        line: startLine,
        column: startCol,
      };
    }
    if (char === "\u2293") {
      this.advance();
      return {
        type: TokenTypes.AND,
        value: "\u2293",
        line: startLine,
        column: startCol,
      };
    }

    if (this.matchPrefix("\\sqcup")) {
      this.advanceBy(6);
      return {
        type: TokenTypes.OR,
        value: "\\sqcup",
        line: startLine,
        column: startCol,
      };
    }
    if (char === "\u2294") {
      this.advance();
      return {
        type: TokenTypes.OR,
        value: "\u2294",
        line: startLine,
        column: startCol,
      };
    }

    if (this.matchPrefix("\\lnot")) {
      this.advanceBy(5);
      return {
        type: TokenTypes.NOT,
        value: "\\lnot",
        line: startLine,
        column: startCol,
      };
    }
    if (char === "\u00AC") {
      this.advance();
      return {
        type: TokenTypes.NOT,
        value: "\u00AC",
        line: startLine,
        column: startCol,
      };
    }

    if (this.matchPrefix("\\exists")) {
      this.advanceBy(7);
      return {
        type: TokenTypes.SOME,
        value: "\\exists",
        line: startLine,
        column: startCol,
      };
    }
    if (char === "\u2203") {
      this.advance();
      return {
        type: TokenTypes.SOME,
        value: "\u2203",
        line: startLine,
        column: startCol,
      };
    }

    if (this.matchPrefix("\\forall")) {
      this.advanceBy(7);
      return {
        type: TokenTypes.ALL,
        value: "\\forall",
        line: startLine,
        column: startCol,
      };
    }
    if (char === "\u2200") {
      this.advance();
      return {
        type: TokenTypes.ALL,
        value: "\u2200",
        line: startLine,
        column: startCol,
      };
    }

    if (this.matchPrefix("\\geq")) {
      this.advanceBy(4);
      return {
        type: TokenTypes.MIN,
        value: "\\geq",
        line: startLine,
        column: startCol,
      };
    }
    if (char === "\u2265" || char === ">") {
      this.advance();
      return {
        type: TokenTypes.MIN,
        value: char,
        line: startLine,
        column: startCol,
      };
    }

    if (this.matchPrefix("\\leq")) {
      this.advanceBy(4);
      return {
        type: TokenTypes.MAX,
        value: "\\leq",
        line: startLine,
        column: startCol,
      };
    }
    if (char === "\u2264" || char === "<") {
      this.advance();
      return {
        type: TokenTypes.MAX,
        value: char,
        line: startLine,
        column: startCol,
      };
    }

    if (char === "=") {
      this.advance();
      return {
        type: TokenTypes.EXACT,
        value: "=",
        line: startLine,
        column: startCol,
      };
    }
    if (char === "\u2208") {
      this.advance();
      return {
        type: TokenTypes.IN,
        value: "\u2208",
        line: startLine,
        column: startCol,
      };
    }

    // Read words / numbers
    const word = this.readUntilDelimiter();
    if (word === "sub") {
      return {
        type: TokenTypes.SUBCLASSOF,
        value: word,
        line: startLine,
        column: startCol,
      };
    }
    if (word === "o" || word === "\u2218") {
      return {
        type: TokenTypes.COMPOSE,
        value: word,
        line: startLine,
        column: startCol,
      };
    }
    if (word === "and") {
      return {
        type: TokenTypes.AND,
        value: word,
        line: startLine,
        column: startCol,
      };
    }
    if (word === "or") {
      return {
        type: TokenTypes.OR,
        value: word,
        line: startLine,
        column: startCol,
      };
    }
    if (word === "not") {
      return {
        type: TokenTypes.NOT,
        value: word,
        line: startLine,
        column: startCol,
      };
    }
    if (word === "exists") {
      return {
        type: TokenTypes.SOME,
        value: word,
        line: startLine,
        column: startCol,
      };
    }
    if (word === "forall") {
      return {
        type: TokenTypes.ALL,
        value: word,
        line: startLine,
        column: startCol,
      };
    }
    if (word === "equal") {
      return {
        type: TokenTypes.EXACT,
        value: word,
        line: startLine,
        column: startCol,
      };
    }
    if (word === "in") {
      return {
        type: TokenTypes.IN,
        value: word,
        line: startLine,
        column: startCol,
      };
    }
    if (word === "trans" || word === "transitive" || word === "R\u207A") {
      return {
        type: TokenTypes.TRANSITIVEROLES,
        value: word,
        line: startLine,
        column: startCol,
      };
    }

    if (/^[0-9]+$/.test(word)) {
      return {
        type: TokenTypes.INT,
        value: word,
        line: startLine,
        column: startCol,
      };
    }
    if (/^[0-9]+\.[0-9]*$/.test(word)) {
      return {
        type: TokenTypes.DOUBLE,
        value: word,
        line: startLine,
        column: startCol,
      };
    }

    // Everything else is an ID, unless it was just a comma
    if (word === "") {
      // Fallback for single char delimiters that aren't special tokens, like ','
      if (char === ",") {
        this.advance();
        return {
          type: TokenTypes.ID,
          value: ",",
          line: startLine,
          column: startCol,
        };
      }
      throw new Error(
        `Parse error at line ${startLine}:${startCol}: Unexpected character '${char}'`,
      );
    }

    return {
      type: TokenTypes.ID,
      value: word,
      line: startLine,
      column: startCol,
    };
  }

  matchPrefix(prefix) {
    if (this.pos + prefix.length > this.text.length) {
      return false;
    }
    for (let i = 0; i < prefix.length; i++) {
      if (this.text[this.pos + i] !== prefix[i]) {
        return false;
      }
    }
    return true;
  }

  advanceBy(count) {
    for (let i = 0; i < count; i++) {
      this.advance();
    }
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

  skipWhitespace() {
    while (this.pos < this.text.length) {
      const char = this.text[this.pos];
      if (char === " " || char === "\t" || char === "\r") {
        this.advance();
      } else {
        break;
      }
    }
  }

  readUntilDelimiter() {
    let result = "";
    while (this.pos < this.text.length) {
      const char = this.text[this.pos];
      if (this.delimiters.has(char)) {
        break;
      }
      result += char;
      this.advance();
    }
    return result;
  }
}

class TokenStream {
  constructor(lexer) {
    this.lexer = lexer;
    this.buffer = [];
    this.tokenIndex = 0;
  }

  peek(offset = 0) {
    while (this.buffer.length <= this.tokenIndex + offset) {
      const token = this.lexer.nextToken();
      this.buffer.push(token);
      if (token.type === TokenTypes.EOF) {
        break;
      }
    }
    return (
      this.buffer[this.tokenIndex + offset] ||
      this.buffer[this.buffer.length - 1]
    );
  }

  consume(expectedType = null, expectedValue = null) {
    const token = this.peek();
    if (expectedType && token.type !== expectedType) {
      throw new Error(
        `Parse error at line ${token.line}:${token.column}: Expected ${expectedType}, got ${token.type} ('${token.value}')`,
      );
    }
    if (expectedValue && token.value !== expectedValue) {
      throw new Error(
        `Parse error at line ${token.line}:${token.column}: Expected '${expectedValue}', got '${token.value}'`,
      );
    }
    this.tokenIndex++;
    return token;
  }
}

class TriplesEmitter {
  constructor() {
    this.triples = [];
  }

  addTriple(subject, predicate, object) {
    this.triples.push({
      subject: {
        type: subject.startsWith("_:") ? "BNODE" : "IRI",
        value: subject,
      },
      predicate: { type: "IRI", value: predicate },
      object: object,
    });
  }
}

class DLSyntaxParser {
  constructor(stream) {
    this.stream = stream;
    this.emitter = new TriplesEmitter();
    this.defaultNamespace = "http://www.semanticweb.org/ontologies/Ontology";
    this.prefixes = {};

    this.bnodeCounter = 0;
  }

  generateBNode() {
    return `_:b${this.bnodeCounter++}`;
  }

  getIRI(idStr) {
    if (idStr === "top" || idStr === "\u22A4") {
      return "http://www.w3.org/2002/07/owl#Thing";
    }
    if (idStr === "bottom" || idStr === "\u22A5") {
      return "http://www.w3.org/2002/07/owl#Nothing";
    }
    return this.defaultNamespace + "#" + idStr;
  }

  parse() {
    while (this.stream.peek().type === TokenTypes.NEWLINE) {
      this.stream.consume();
    }
    while (this.stream.peek().type !== TokenTypes.EOF) {
      this.parseAxiom();
      while (this.stream.peek().type === TokenTypes.NEWLINE) {
        this.stream.consume();
      }
    }
    return serializeTriplesToRdfXml(
      this.emitter.triples,
      this.prefixes,
      this.defaultNamespace,
    );
  }

  parseAxiom() {
    const next1 = this.stream.peek();
    const next2 = this.stream.peek(1);

    if (next1.type === TokenTypes.COLON) {
      this.stream.consume();
      this.parsePropertyAxiom();
      return;
    }

    // Since LL(3) lookahead is required for JavaCC, we approximate it by trying
    // to identify the axiom type based on the first few tokens.

    // Check for PropertyAssertion: objProp(ind1, ind2)
    if (next1.type === TokenTypes.ID && next2.type === TokenTypes.OPENPAR) {
      // Could be ClassAssertion: Class(ind)
      // Or ObjectPropertyAssertion: prop(ind1, ind2)
      // Or DataPropertyAssertion: prop(ind, literal)
      // We distinguish by checking if there's a comma
      let isPropertyAssertion = false;
      let lookahead = 2;
      while (
        this.stream.peek(lookahead).type !== TokenTypes.EOF &&
        this.stream.peek(lookahead).type !== TokenTypes.CLOSEPAR
      ) {
        if (this.stream.peek(lookahead).value === ",") {
          isPropertyAssertion = true;
          break;
        }
        lookahead++;
      }

      if (isPropertyAssertion) {
        // Need to distinguish Object vs Data property assertion.
        // In DL Syntax, literals are INT or DOUBLE tokens.
        // So if the token after comma is INT/DOUBLE, it's DataProperty.
        const afterComma = this.stream.peek(lookahead + 1);
        if (
          afterComma.type === TokenTypes.INT ||
          afterComma.type === TokenTypes.DOUBLE
        ) {
          this.parseDataPropertyAssertion();
        } else {
          this.parseObjectPropertyAssertion();
        }
        return;
      }
    }

    // Check for ClassAssertion: Class(ind) or (ClassExpr)(ind)
    // For Class(ind), next1=ID, next2=(, no comma
    // For (ClassExpr)(ind), next1=(
    // But (ClassExpr) could also be LHS of SubClassOf!
    // We can distinguish ClassAssertion by seeing if the token after the expression is '(' followed by ID and ')'.
    // A simpler way for a handwritten parser is backtracking, but we can do a quick check.

    // Parse LHS as Class Description
    // Wait, what about SameIndividual? ind = ind
    // DifferentIndividuals? ind != ind
    if (
      next1.type === TokenTypes.ID &&
      (next2.type === TokenTypes.EXACT || next2.type === TokenTypes.NEQ)
    ) {
      if (next2.type === TokenTypes.EXACT) {
        this.parseSameIndividual();
      } else {
        this.parseDifferentIndividualsAxiom();
      }
      return;
    }

    // Try parsing as ClassAxiom, if it fails, fallback.
    // We can just parse a class expression. If the next token is '(', it's a class assertion.
    const lhs = this.parseClassDescription();

    if (this.stream.peek().type === TokenTypes.OPENPAR) {
      // It's a ClassAssertion
      this.stream.consume(TokenTypes.OPENPAR);
      const ind = this.getIRI(this.stream.consume(TokenTypes.ID).value);
      this.stream.consume(TokenTypes.CLOSEPAR);
      // Optional NEWLINE in JavaCC
      if (this.stream.peek().type === TokenTypes.NEWLINE) {
        this.stream.consume();
      }
      this.emitter.addTriple(
        ind,
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        { type: "IRI", value: lhs },
      );
      return;
    }

    // Otherwise it's a ClassAxiom
    if (this.stream.peek().type === TokenTypes.SUBCLASSOF) {
      this.stream.consume();
      const rhs = this.parseClassDescription();
      // If LHS is owl:Thing, it might be Range or Functional property axiom
      if (lhs === "http://www.w3.org/2002/07/owl#Thing") {
        if (rhs.isAllValuesFrom) {
          this.emitter.addTriple(
            rhs.property,
            "http://www.w3.org/2000/01/rdf-schema#range",
            { type: "IRI", value: rhs.filler },
          );
        } else if (
          rhs.isMaxCardinality &&
          rhs.cardinality === 1 &&
          rhs.filler === "http://www.w3.org/2002/07/owl#Thing"
        ) {
          this.emitter.addTriple(
            rhs.property,
            "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
            {
              type: "IRI",
              value: "http://www.w3.org/2002/07/owl#FunctionalProperty",
            },
          );
        } else {
          this.emitter.addTriple(
            lhs,
            "http://www.w3.org/2000/01/rdf-schema#subClassOf",
            { type: "IRI", value: rhs },
          );
        }
      } else if (
        lhs.isSomeValuesFrom &&
        lhs.filler === "http://www.w3.org/2002/07/owl#Thing"
      ) {
        // Domain axiom
        this.emitter.addTriple(
          lhs.property,
          "http://www.w3.org/2000/01/rdf-schema#domain",
          { type: "IRI", value: rhs },
        );
      } else {
        // General subclass
        const rhsIri = typeof rhs === "string" ? rhs : rhs.id;
        const lhsIri = typeof lhs === "string" ? lhs : lhs.id;
        this.emitter.addTriple(
          lhsIri,
          "http://www.w3.org/2000/01/rdf-schema#subClassOf",
          { type: "IRI", value: rhsIri },
        );
      }
    } else if (this.stream.peek().type === TokenTypes.EQUIVALENTTO) {
      this.stream.consume();
      const rhs = this.parseClassDescription();
      const rhsIri = typeof rhs === "string" ? rhs : rhs.id;
      const lhsIri = typeof lhs === "string" ? lhs : lhs.id;
      this.emitter.addTriple(
        lhsIri,
        "http://www.w3.org/2002/07/owl#equivalentClass",
        { type: "IRI", value: rhsIri },
      );
    } else {
      throw new Error(
        `Parse error at line ${this.stream.peek().line}: Expected subclass or equivalent to`,
      );
    }
  }

  parseDifferentIndividualsAxiom() {
    const inds = [];
    inds.push(this.getIRI(this.stream.consume(TokenTypes.ID).value));
    this.stream.consume(TokenTypes.NEQ);
    inds.push(this.getIRI(this.stream.consume(TokenTypes.ID).value));
    while (this.stream.peek().type === TokenTypes.NEQ) {
      this.stream.consume();
      inds.push(this.getIRI(this.stream.consume(TokenTypes.ID).value));
    }

    const bnode = this.generateBNode();
    this.emitter.addTriple(
      bnode,
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      { type: "IRI", value: "http://www.w3.org/2002/07/owl#AllDifferent" },
    );

    let currentList = this.generateBNode();
    this.emitter.addTriple(
      bnode,
      "http://www.w3.org/2002/07/owl#distinctMembers",
      { type: "BNODE", value: currentList },
    );

    for (let i = 0; i < inds.length; i++) {
      this.emitter.addTriple(
        currentList,
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#first",
        { type: "IRI", value: inds[i] },
      );
      if (i < inds.length - 1) {
        const nextList = this.generateBNode();
        this.emitter.addTriple(
          currentList,
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest",
          { type: "BNODE", value: nextList },
        );
        currentList = nextList;
      } else {
        this.emitter.addTriple(
          currentList,
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest",
          {
            type: "IRI",
            value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil",
          },
        );
      }
    }
  }

  parseSameIndividual() {
    const indA = this.getIRI(this.stream.consume(TokenTypes.ID).value);
    this.stream.consume(TokenTypes.EXACT);
    const indB = this.getIRI(this.stream.consume(TokenTypes.ID).value);
    this.emitter.addTriple(indA, "http://www.w3.org/2002/07/owl#sameAs", {
      type: "IRI",
      value: indB,
    });
  }

  parseObjectPropertyAssertion() {
    const prop = this.parseObjectPropertyId();
    this.stream.consume(TokenTypes.OPENPAR);
    const subj = this.getIRI(this.stream.consume(TokenTypes.ID).value);
    this.stream.consume(TokenTypes.ID, ","); // comma
    const obj = this.getIRI(this.stream.consume(TokenTypes.ID).value);
    this.stream.consume(TokenTypes.CLOSEPAR);
    this.emitter.addTriple(subj, prop, { type: "IRI", value: obj });
  }

  parseDataPropertyAssertion() {
    const prop = this.getIRI(this.stream.consume(TokenTypes.ID).value); // data property
    this.stream.consume(TokenTypes.OPENPAR);
    const subj = this.getIRI(this.stream.consume(TokenTypes.ID).value);
    this.stream.consume(TokenTypes.ID, ","); // comma
    const lit = this.parseLiteral();
    this.stream.consume(TokenTypes.CLOSEPAR);
    this.emitter.addTriple(subj, prop, lit);
  }

  parsePropertyAxiom() {
    // lhs could be property chain or single property
    const props = [];
    props.push(this.parseObjectPropertyId());

    if (this.stream.peek().type === TokenTypes.COMPOSE) {
      while (this.stream.peek().type === TokenTypes.COMPOSE) {
        this.stream.consume();
        props.push(this.parseObjectPropertyId());
      }
      this.stream.consume(TokenTypes.SUBCLASSOF);
      const supProp = this.parseObjectPropertyId();

      const bnode = this.generateBNode();
      this.emitter.addTriple(
        supProp,
        "http://www.w3.org/2002/07/owl#propertyChainAxiom",
        { type: "BNODE", value: bnode },
      );
      let currentList = bnode;
      for (let i = 0; i < props.length; i++) {
        this.emitter.addTriple(
          currentList,
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#first",
          { type: "IRI", value: props[i] },
        );
        if (i < props.length - 1) {
          const nextList = this.generateBNode();
          this.emitter.addTriple(
            currentList,
            "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest",
            { type: "BNODE", value: nextList },
          );
          currentList = nextList;
        } else {
          this.emitter.addTriple(
            currentList,
            "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest",
            {
              type: "IRI",
              value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil",
            },
          );
        }
      }
      return;
    }

    const lhs = props[0];
    if (this.stream.peek().type === TokenTypes.SUBCLASSOF) {
      this.stream.consume();
      const rhs = this.parseObjectPropertyId();
      this.emitter.addTriple(
        lhs,
        "http://www.w3.org/2000/01/rdf-schema#subPropertyOf",
        { type: "IRI", value: rhs },
      );
    } else if (this.stream.peek().type === TokenTypes.EQUIVALENTTO) {
      this.stream.consume();
      const rhs = this.parseObjectPropertyId();
      this.emitter.addTriple(
        lhs,
        "http://www.w3.org/2002/07/owl#equivalentProperty",
        { type: "IRI", value: rhs },
      );
    } else if (this.stream.peek().type === TokenTypes.IN) {
      this.stream.consume();
      this.stream.consume(TokenTypes.TRANSITIVEROLES);
      this.emitter.addTriple(
        lhs,
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        {
          type: "IRI",
          value: "http://www.w3.org/2002/07/owl#TransitiveProperty",
        },
      );
    } else {
      throw new Error("Expected subproperty, equivalent property, or in trans");
    }
  }

  parseClassDescription() {
    return this.parseOr();
  }

  parseOr() {
    const operands = [];
    operands.push(this.parseAnd());
    while (this.stream.peek().type === TokenTypes.OR) {
      this.stream.consume();
      operands.push(this.parseAnd());
    }
    if (operands.length === 1) {
      return operands[0];
    }

    const bnode = this.generateBNode();
    this.emitter.addTriple(
      bnode,
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      { type: "IRI", value: "http://www.w3.org/2002/07/owl#Class" },
    );

    let currentList = this.generateBNode();
    this.emitter.addTriple(bnode, "http://www.w3.org/2002/07/owl#unionOf", {
      type: "BNODE",
      value: currentList,
    });
    for (let i = 0; i < operands.length; i++) {
      const opIri =
        typeof operands[i] === "string" ? operands[i] : operands[i].id;
      this.emitter.addTriple(
        currentList,
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#first",
        { type: "IRI", value: opIri },
      );
      if (i < operands.length - 1) {
        const nextList = this.generateBNode();
        this.emitter.addTriple(
          currentList,
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest",
          { type: "BNODE", value: nextList },
        );
        currentList = nextList;
      } else {
        this.emitter.addTriple(
          currentList,
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest",
          {
            type: "IRI",
            value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil",
          },
        );
      }
    }
    return bnode;
  }

  parseAnd() {
    const operands = [];
    operands.push(this.parseNonNaryBooleanDescription());
    while (this.stream.peek().type === TokenTypes.AND) {
      this.stream.consume();
      operands.push(this.parseNonNaryBooleanDescription());
    }
    if (operands.length === 1) {
      return operands[0];
    }

    const bnode = this.generateBNode();
    this.emitter.addTriple(
      bnode,
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      { type: "IRI", value: "http://www.w3.org/2002/07/owl#Class" },
    );

    let currentList = this.generateBNode();
    this.emitter.addTriple(
      bnode,
      "http://www.w3.org/2002/07/owl#intersectionOf",
      { type: "BNODE", value: currentList },
    );
    for (let i = 0; i < operands.length; i++) {
      const opIri =
        typeof operands[i] === "string" ? operands[i] : operands[i].id;
      this.emitter.addTriple(
        currentList,
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#first",
        { type: "IRI", value: opIri },
      );
      if (i < operands.length - 1) {
        const nextList = this.generateBNode();
        this.emitter.addTriple(
          currentList,
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest",
          { type: "BNODE", value: nextList },
        );
        currentList = nextList;
      } else {
        this.emitter.addTriple(
          currentList,
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest",
          {
            type: "IRI",
            value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil",
          },
        );
      }
    }
    return bnode;
  }

  parseNonNaryBooleanDescription() {
    const peek = this.stream.peek().type;
    if (
      peek === TokenTypes.SOME ||
      peek === TokenTypes.ALL ||
      peek === TokenTypes.MIN ||
      peek === TokenTypes.MAX ||
      peek === TokenTypes.EXACT
    ) {
      return this.parseRestriction();
    }
    if (peek === TokenTypes.NOT) {
      this.stream.consume();
      const op = this.parseNamedClassOrNestedDescription();
      const opIri = typeof op === "string" ? op : op.id;
      const bnode = this.generateBNode();
      this.emitter.addTriple(
        bnode,
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        { type: "IRI", value: "http://www.w3.org/2002/07/owl#Class" },
      );
      this.emitter.addTriple(
        bnode,
        "http://www.w3.org/2002/07/owl#complementOf",
        { type: "IRI", value: opIri },
      );
      return bnode;
    }
    return this.parseNamedClassOrNestedDescription();
  }

  parseObjectPropertyId() {
    const iri = this.getIRI(this.stream.consume(TokenTypes.ID).value);
    if (this.stream.peek().type === TokenTypes.INVERSE) {
      this.stream.consume();
      const bnode = this.generateBNode();
      this.emitter.addTriple(bnode, "http://www.w3.org/2002/07/owl#inverseOf", {
        type: "IRI",
        value: iri,
      });
      return bnode;
    }
    return iri;
  }

  parseRestriction() {
    const type = this.stream.peek().type;
    if (type === TokenTypes.SOME) {
      this.stream.consume();
      const prop = this.getIRI(this.stream.consume(TokenTypes.ID).value); // In DL Syntax, it can be Object or Data property. Java tries SomeRestriction, then DataSomeRestriction
      if (this.stream.peek().type === TokenTypes.DOT) {
        this.stream.consume();
      }

      if (this.stream.peek().type === TokenTypes.OPENBRACE) {
        // DataOneOf -> DataSomeRestriction
        const filler = this.parseDataOneOf();
        const bnode = this.generateBNode();
        this.emitter.addTriple(
          bnode,
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
          { type: "IRI", value: "http://www.w3.org/2002/07/owl#Restriction" },
        );
        this.emitter.addTriple(
          bnode,
          "http://www.w3.org/2002/07/owl#onProperty",
          { type: "IRI", value: prop },
        );
        this.emitter.addTriple(
          bnode,
          "http://www.w3.org/2002/07/owl#someValuesFrom",
          { type: "BNODE", value: filler },
        );
        return bnode;
      } else {
        const filler = this.parseNamedClassOrNestedDescription();
        const fillerIri = typeof filler === "string" ? filler : filler.id;
        const bnode = this.generateBNode();
        this.emitter.addTriple(
          bnode,
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
          { type: "IRI", value: "http://www.w3.org/2002/07/owl#Restriction" },
        );
        this.emitter.addTriple(
          bnode,
          "http://www.w3.org/2002/07/owl#onProperty",
          { type: "IRI", value: prop },
        );
        this.emitter.addTriple(
          bnode,
          "http://www.w3.org/2002/07/owl#someValuesFrom",
          { type: "IRI", value: fillerIri },
        );

        // We return an object so higher levels know this is a SomeValuesFrom (e.g. for Domain axioms)
        return {
          id: bnode,
          isSomeValuesFrom: true,
          property: prop,
          filler: fillerIri,
        };
      }
    }

    if (type === TokenTypes.ALL) {
      this.stream.consume();
      const prop = this.parseObjectPropertyId();
      if (this.stream.peek().type === TokenTypes.DOT) {
        this.stream.consume();
      }
      const filler = this.parseNamedClassOrNestedDescription();
      const fillerIri = typeof filler === "string" ? filler : filler.id;
      const bnode = this.generateBNode();
      this.emitter.addTriple(
        bnode,
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        { type: "IRI", value: "http://www.w3.org/2002/07/owl#Restriction" },
      );
      this.emitter.addTriple(
        bnode,
        "http://www.w3.org/2002/07/owl#onProperty",
        { type: "IRI", value: prop },
      );
      this.emitter.addTriple(
        bnode,
        "http://www.w3.org/2002/07/owl#allValuesFrom",
        { type: "IRI", value: fillerIri },
      );
      return {
        id: bnode,
        isAllValuesFrom: true,
        property: prop,
        filler: fillerIri,
      };
    }

    if (
      type === TokenTypes.MIN ||
      type === TokenTypes.MAX ||
      type === TokenTypes.EXACT
    ) {
      this.stream.consume();
      const card = this.stream.consume(TokenTypes.INT).value;
      const prop = this.parseObjectPropertyId();

      let filler = "http://www.w3.org/2002/07/owl#Thing";
      if (
        this.stream.peek().type === TokenTypes.DOT ||
        this.stream.peek().type === TokenTypes.ID ||
        this.stream.peek().type === TokenTypes.OPENPAR ||
        this.stream.peek().type === TokenTypes.OPENBRACE
      ) {
        if (this.stream.peek().type === TokenTypes.DOT) {
          this.stream.consume();
        }
        const parsedFiller = this.parseNamedClassOrNestedDescription();
        filler =
          typeof parsedFiller === "string" ? parsedFiller : parsedFiller.id;
      }

      const bnode = this.generateBNode();
      this.emitter.addTriple(
        bnode,
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        { type: "IRI", value: "http://www.w3.org/2002/07/owl#Restriction" },
      );
      this.emitter.addTriple(
        bnode,
        "http://www.w3.org/2002/07/owl#onProperty",
        { type: "IRI", value: prop },
      );

      let pred;
      if (type === TokenTypes.MIN) {
        pred = "http://www.w3.org/2002/07/owl#minCardinality";
      } else if (type === TokenTypes.MAX) {
        pred = "http://www.w3.org/2002/07/owl#maxCardinality";
      } else {
        pred = "http://www.w3.org/2002/07/owl#cardinality";
      }

      this.emitter.addTriple(bnode, pred, {
        type: "LITERAL",
        value: card,
        datatype: "http://www.w3.org/2001/XMLSchema#nonNegativeInteger",
      });
      if (filler !== "http://www.w3.org/2002/07/owl#Thing") {
        // In OWL1/2, often qualified cardinality uses onClass, but DL Syntax maps to standard cardinality if unqualified.
        // For strict OWL2 it would be minQualifiedCardinality and onClass, but we'll stick to basic mapping.
        this.emitter.addTriple(bnode, "http://www.w3.org/2002/07/owl#onClass", {
          type: "IRI",
          value: filler,
        });
      }

      return {
        id: bnode,
        isMaxCardinality: type === TokenTypes.MAX,
        cardinality: parseInt(card),
        property: prop,
        filler: filler,
      };
    }
  }

  parseDataOneOf() {
    const literals = [];
    this.stream.consume(TokenTypes.OPENBRACE);
    literals.push(this.parseLiteral());
    while (this.stream.peek().type !== TokenTypes.CLOSEBRACE) {
      literals.push(this.parseLiteral());
    }
    this.stream.consume(TokenTypes.CLOSEBRACE);

    const bnode = this.generateBNode();
    this.emitter.addTriple(
      bnode,
      "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
      { type: "IRI", value: "http://www.w3.org/2002/07/owl#DataRange" },
    );

    let currentList = this.generateBNode();
    this.emitter.addTriple(bnode, "http://www.w3.org/2002/07/owl#oneOf", {
      type: "BNODE",
      value: currentList,
    });
    for (let i = 0; i < literals.length; i++) {
      this.emitter.addTriple(
        currentList,
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#first",
        literals[i],
      );
      if (i < literals.length - 1) {
        const nextList = this.generateBNode();
        this.emitter.addTriple(
          currentList,
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest",
          { type: "BNODE", value: nextList },
        );
        currentList = nextList;
      } else {
        this.emitter.addTriple(
          currentList,
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest",
          {
            type: "IRI",
            value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil",
          },
        );
      }
    }
    return bnode;
  }

  parseNamedClassOrNestedDescription() {
    if (this.stream.peek().type === TokenTypes.ID) {
      return this.getIRI(this.stream.consume().value);
    }
    if (this.stream.peek().type === TokenTypes.OPENPAR) {
      this.stream.consume();
      const desc = this.parseOr();
      this.stream.consume(TokenTypes.CLOSEPAR);
      return desc;
    }
    if (this.stream.peek().type === TokenTypes.OPENBRACE) {
      const inds = [];
      this.stream.consume(TokenTypes.OPENBRACE);
      inds.push(this.getIRI(this.stream.consume(TokenTypes.ID).value));
      while (this.stream.peek().type === TokenTypes.ID) {
        inds.push(this.getIRI(this.stream.consume(TokenTypes.ID).value));
      }
      this.stream.consume(TokenTypes.CLOSEBRACE);

      const bnode = this.generateBNode();
      this.emitter.addTriple(
        bnode,
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        { type: "IRI", value: "http://www.w3.org/2002/07/owl#Class" },
      );

      let currentList = this.generateBNode();
      this.emitter.addTriple(bnode, "http://www.w3.org/2002/07/owl#oneOf", {
        type: "BNODE",
        value: currentList,
      });
      for (let i = 0; i < inds.length; i++) {
        this.emitter.addTriple(
          currentList,
          "http://www.w3.org/1999/02/22-rdf-syntax-ns#first",
          { type: "IRI", value: inds[i] },
        );
        if (i < inds.length - 1) {
          const nextList = this.generateBNode();
          this.emitter.addTriple(
            currentList,
            "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest",
            { type: "BNODE", value: nextList },
          );
          currentList = nextList;
        } else {
          this.emitter.addTriple(
            currentList,
            "http://www.w3.org/1999/02/22-rdf-syntax-ns#rest",
            {
              type: "IRI",
              value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#nil",
            },
          );
        }
      }
      return bnode;
    }
    throw new Error("Expected named class or nested description");
  }

  parseLiteral() {
    // MISSING FEATURE: The Java DL Syntax Parser (DLSyntaxParser.jj) only supports integers and doubles.
    // It DOES NOT support standard string literals (e.g., "hello" or "hello"@en) or custom datatypes.
    // If we wish to support strings in the future, we need to:
    // 1. Add STRING_LITERAL to TokenTypes and handle quotes (") in the Lexer.
    // 2. Parse language tags starting with '@' immediately after the string.
    // 3. Return `{ type: "LITERAL", value: text, lang: languageTag }` or `{... datatype: customType}`.

    const token = this.stream.consume();
    if (token.type === TokenTypes.INT) {
      return {
        type: "LITERAL",
        value: token.value,
        datatype: "http://www.w3.org/2001/XMLSchema#integer",
      };
    } else if (token.type === TokenTypes.DOUBLE) {
      return {
        type: "LITERAL",
        value: token.value,
        datatype: "http://www.w3.org/2001/XMLSchema#double",
      };
    }
    throw new Error(`Parse error: expected INT or DOUBLE, got ${token.type}`);
  }
}

export function parseDLSyntax(text) {
  const lexer = new DLSyntaxLexer(text);
  const stream = new TokenStream(lexer);
  const parser = new DLSyntaxParser(stream);
  return parser.parse();
}

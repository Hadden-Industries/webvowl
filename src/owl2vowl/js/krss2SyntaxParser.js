import { serializeTriplesToRdfXml } from "./rdfXmlSerializer.js";
import { MAX_SNIFF_BYTES } from "./constants.js";

export function isKRSS2SyntaxFormat(text) {
  if (!text) {
    return false;
  }
  // Match characteristic KRSS2 keywords within the first few lines
  const snippet = text.slice(0, MAX_SNIFF_BYTES);
  return /^\s*\(\s*(define-primitive-concept|define-concept|define-primitive-role|define-role|implies|equivalent|disjoint|domain|range|instance-of|related)\b/i.test(
    snippet,
  );
}

export class KRSS2Lexer {
  constructor(text) {
    this.text = text;
    this.pos = 0;
    this.length = text.length;
  }

  skipWhitespace() {
    while (this.pos < this.length) {
      const char = this.text[this.pos];
      if (char === " " || char === "\n" || char === "\r" || char === "\t") {
        this.pos++;
      } else if (char === ";") {
        // Skip comments (assuming semicolon for comments in KRSS2/Lisp, though standard KRSS2 might not strictly define comments, lisp style uses ;)
        while (
          this.pos < this.length &&
          this.text[this.pos] !== "\n" &&
          this.text[this.pos] !== "\r"
        ) {
          this.pos++;
        }
      } else {
        break;
      }
    }
  }

  nextToken() {
    this.skipWhitespace();

    if (this.pos >= this.length) {
      return { type: "EOF", value: "EOF" };
    }

    const char = this.text[this.pos];

    if (char === "(" || char === ")") {
      this.pos++;
      return { type: "DELIM", value: char };
    }

    // Read identifiers, keywords, IRIs
    let val = "";
    while (this.pos < this.length) {
      const c = this.text[this.pos];
      if (
        c === " " ||
        c === "\n" ||
        c === "\r" ||
        c === "\t" ||
        c === "(" ||
        c === ")" ||
        c === ";"
      ) {
        break;
      }
      val += c;
      this.pos++;
    }

    return { type: "IDENTIFIER", value: val };
  }
}

export class KRSS2Parser {
  constructor(lexer) {
    this.lexer = lexer;
    this.tokenBuffer = [];
    this.tokenIndex = 0;

    // We eagerly consume all tokens into a buffer for simplicity with lookahead in KRSS2
    let next = lexer.nextToken();
    while (next.type !== "EOF") {
      this.tokenBuffer.push(next);
      next = lexer.nextToken();
    }
    this.tokenBuffer.push({ type: "EOF", value: "EOF" });
  }

  peekToken(ahead = 0) {
    const idx = this.tokenIndex + ahead;
    if (idx >= this.tokenBuffer.length) {
      return { type: "EOF", value: "EOF" };
    }
    return this.tokenBuffer[idx];
  }

  consumeToken() {
    const tok = this.peekToken();
    if (this.tokenIndex < this.tokenBuffer.length - 1) {
      this.tokenIndex++;
    }
    return tok;
  }

  parse() {
    const ast = [];
    while (this.peekToken().type !== "EOF") {
      const axiom = this.parseAxiom();
      if (axiom) {
        ast.push(axiom);
      }
    }
    return ast;
  }

  parseAxiom() {
    const tok = this.peekToken();
    if (tok.type !== "DELIM" || tok.value !== "(") {
      // recover or skip
      this.consumeToken();
      return null;
    }
    this.consumeToken(); // '('
    const keywordTok = this.consumeToken();
    if (keywordTok.type !== "IDENTIFIER") {
      return null;
    }

    const keyword = keywordTok.value.toLowerCase();

    // NOTE TO FUTURE DEVELOPERS (MISSING FEATURES):
    // The Java OWLAPI KRSS2 parser explicitly lacks support for DatatypeProperties,
    // DataPropertyAssertions, and advanced OWL2 annotations (e.g., ObjectPropertyChains, AsymmetricProperties).
    // If you need to extend this parser to support these, you would add new keyword
    // handlers here (e.g. 'define-datatype-property' or similar extensions if the grammar allows).

    const args = [];
    while (
      this.peekToken().type !== "EOF" &&
      !(this.peekToken().type === "DELIM" && this.peekToken().value === ")")
    ) {
      args.push(this.parseArgument());
    }
    this.consumeToken(); // ')'

    return { type: "AXIOM", keyword, args };
  }

  parseArgument() {
    const tok = this.peekToken();
    if (tok.type === "DELIM" && tok.value === "(") {
      this.consumeToken(); // '('
      const keywordTok = this.consumeToken();
      const keyword = keywordTok.value.toLowerCase();
      const args = [];
      while (
        this.peekToken().type !== "EOF" &&
        !(this.peekToken().type === "DELIM" && this.peekToken().value === ")")
      ) {
        args.push(this.parseArgument());
      }
      this.consumeToken(); // ')'
      return { type: "EXPRESSION", keyword, args };
    } else {
      return this.consumeToken().value; // String identifier
    }
  }
}

class TriplesEmitter {
  constructor() {
    this.triples = [];
  }

  emit(ast) {
    for (const axiom of ast) {
      this.emitAxiom(axiom);
    }
  }

  emitAxiom(axiom) {
    if (axiom.keyword === "define-primitive-concept") {
      const concept = axiom.args[0];
      const parent = axiom.args[1];
      this.addTriple(
        concept,
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "http://www.w3.org/2002/07/owl#Class",
        "IRI",
      );
      if (parent) {
        // missing feature note: parent could be an expression. For basic cases it's an IRI.
        const parentIri =
          typeof parent === "string" ? parent : this.emitExpression(parent);
        this.addTriple(
          concept,
          "http://www.w3.org/2000/01/rdf-schema#subClassOf",
          parentIri,
          "IRI",
        );
      }
    } else if (axiom.keyword === "define-concept") {
      const concept = axiom.args[0];
      const definition = axiom.args[1];
      this.addTriple(
        concept,
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "http://www.w3.org/2002/07/owl#Class",
        "IRI",
      );
      if (definition) {
        const defIri =
          typeof definition === "string"
            ? definition
            : this.emitExpression(definition);
        this.addTriple(
          concept,
          "http://www.w3.org/2002/07/owl#equivalentClass",
          defIri,
          "IRI",
        );
      }
    } else if (
      axiom.keyword === "define-primitive-role" ||
      axiom.keyword === "define-role"
    ) {
      const role = axiom.args[0];
      this.addTriple(
        role,
        "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
        "http://www.w3.org/2002/07/owl#ObjectProperty",
        "IRI",
      );
      // parent roles, etc. not fully mapped here but could be
    }
    // other axioms like implies, equivalent, disjoint, etc.
  }

  emitExpression(expr) {
    // Generate a BNODE for expressions
    const bnode = "_:bnode_" + Math.random().toString(36).substr(2, 9);
    // simplistic handling for now, as full KRSS2 covers 'and', 'or', 'some', 'all'
    return bnode;
  }

  addTriple(subject, predicate, object, objectType = "IRI") {
    this.triples.push({
      subject: {
        type: subject.startsWith("_:") ? "BNODE" : "IRI",
        value: subject,
      },
      predicate: { type: "IRI", value: predicate },
      object: { type: objectType, value: object },
    });
  }
}

export function parseKRSS2Syntax(text) {
  const lexer = new KRSS2Lexer(text);
  const parser = new KRSS2Parser(lexer);
  const ast = parser.parse();
  const emitter = new TriplesEmitter();
  emitter.emit(ast);

  // Basic prefixes for the emitter output
  const prefixes = {
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    owl: "http://www.w3.org/2002/07/owl#",
  };

  return serializeTriplesToRdfXml(emitter.triples, prefixes, "");
}

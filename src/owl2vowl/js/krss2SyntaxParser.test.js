import { parseKRSS2Syntax, isKRSS2SyntaxFormat, KRSS2Lexer } from './krss2SyntaxParser.js';

describe('KRSS2 Syntax Parser', () => {
  describe('isKRSS2SyntaxFormat', () => {
    it('should correctly identify KRSS2 syntax', () => {
      expect(isKRSS2SyntaxFormat('(define-primitive-concept A B)')).toBe(true);
      expect(isKRSS2SyntaxFormat('  \n  (define-concept C D)\n')).toBe(true);
      expect(isKRSS2SyntaxFormat('(define-primitive-role r)')).toBe(true);
    });

    it('should reject non-KRSS2 syntax', () => {
      expect(isKRSS2SyntaxFormat('Prefix: : <http://test.org/>')).toBe(false);
      expect(isKRSS2SyntaxFormat('<rdf:RDF>...</rdf:RDF>')).toBe(false);
      expect(isKRSS2SyntaxFormat('some random text')).toBe(false);
    });
  });

  describe('KRSS2Lexer', () => {
    it('should tokenize balanced parentheses and keywords', () => {
      const lexer = new KRSS2Lexer('(define-primitive-concept A B)');
      const tokens = [];
      let next = lexer.nextToken();
      while (next.type !== 'EOF') {
        tokens.push(next.value);
        next = lexer.nextToken();
      }
      expect(tokens).toEqual(['(', 'define-primitive-concept', 'A', 'B', ')']);
    });
  });

  describe('KRSS2Parser', () => {
    it('should parse define-primitive-concept and emit correct triples', () => {
      const text = '(define-primitive-concept A B)';
      const xml = parseKRSS2Syntax(text);
      expect(xml).toContain('<rdf:Description rdf:about="A">');
      expect(xml).toContain('<rdfs:subClassOf rdf:resource="B" />');
      expect(xml).toContain('<rdf:type rdf:resource="http://www.w3.org/2002/07/owl#Class" />');
    });

    it('should parse define-concept and emit correct triples', () => {
      const text = '(define-concept A B)';
      const xml = parseKRSS2Syntax(text);
      expect(xml).toContain('<owl:equivalentClass rdf:resource="B" />');
    });
  });
});

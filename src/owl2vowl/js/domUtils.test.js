import { DOMParser } from "@xmldom/xmldom";
import {
  getAttr,
  getAbout,
  findImmediateChildren,
  getElementsByLocalName,
} from "./domUtils.js";

const parseXML = (xmlString) => {
  return new DOMParser().parseFromString(xmlString, "application/xml");
};

describe("domUtils.js unit tests", () => {
  describe("getAttr", () => {
    test("retrieves namespaced attribute", () => {
      const doc = parseXML(
        '<root xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" rdf:about="http://example.org/node"/>',
      );
      const el = doc.documentElement;
      expect(
        getAttr(el, "about", "http://www.w3.org/1999/02/22-rdf-syntax-ns#"),
      ).toBe("http://example.org/node");
    });

    test("retrieves standard attribute with fallback", () => {
      const doc = parseXML('<root customAttr="value1"/>');
      const el = doc.documentElement;
      expect(getAttr(el, "customAttr")).toBe("value1");
    });

    test("retrieves prefixed attribute without namespace parameter", () => {
      const doc = parseXML(
        '<root xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" rdf:about="value2"/>',
      );
      const el = doc.documentElement;
      expect(getAttr(el, "about")).toBe("value2");
    });

    test("fallback matches localName on element attributes list", () => {
      // Create element with custom non-standard attributes list that needs fallback
      const doc = parseXML('<root xml:lang="en"/>');
      const el = doc.documentElement;
      expect(getAttr(el, "lang")).toBe("en");
    });

    test("returns null if attribute does not exist", () => {
      const doc = parseXML("<root/>");
      const el = doc.documentElement;
      expect(getAttr(el, "nonexistent")).toBeNull();
    });
  });

  describe("getAbout", () => {
    test("prefers rdf:about", () => {
      const doc = parseXML(`
        <rdf:Description 
          xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" 
          rdf:about="http://example.org/about" 
          rdf:ID="someId"
        />
      `);
      const el = doc.documentElement;
      expect(getAbout(el)).toBe("http://example.org/about");
    });

    test("falls back to rdf:ID and prefixes with # if needed", () => {
      const doc = parseXML(`
        <rdf:Description 
          xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" 
          rdf:ID="someId"
        />
      `);
      const el = doc.documentElement;
      expect(getAbout(el)).toBe("#someId");
    });

    test("falls back to rdf:ID and does not duplicate prefix if it starts with #", () => {
      const doc = parseXML(`
        <rdf:Description 
          xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" 
          rdf:ID="#someId"
        />
      `);
      const el = doc.documentElement;
      expect(getAbout(el)).toBe("#someId");
    });

    test("returns null if neither is present", () => {
      const doc = parseXML(
        '<rdf:Description xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" />',
      );
      const el = doc.documentElement;
      expect(getAbout(el)).toBeNull();
    });
  });

  describe("findImmediateChildren", () => {
    test("finds only immediate children by localName", () => {
      const doc = parseXML(`
        <parent>
          <child>1</child>
          <other>2</other>
          <child>3</child>
          <nested>
            <child>4</child>
          </nested>
        </parent>
      `);
      const el = doc.documentElement;
      const children = findImmediateChildren(el, "child");
      expect(children.length).toBe(2);
      expect(children[0].textContent).toBe("1");
      expect(children[1].textContent).toBe("3");
    });

    test("returns empty array if no children match localName", () => {
      const doc = parseXML("<parent><other/></parent>");
      const el = doc.documentElement;
      expect(findImmediateChildren(el, "child")).toEqual([]);
    });
  });

  describe("getElementsByLocalName", () => {
    test("recursively finds all matching descendants including parent itself", () => {
      const doc = parseXML(`
        <child>
          <child>1</child>
          <other>
            <child>2</child>
          </other>
        </child>
      `);
      const el = doc.documentElement;
      const matches = getElementsByLocalName(el, "child");
      expect(matches.length).toBe(3);
      expect(matches[0]).toBe(el);
      expect(matches[1].textContent).toBe("1");
      expect(matches[2].textContent).toBe("2");
    });

    test("returns empty array if none match in the whole tree", () => {
      const doc = parseXML("<parent><other><another/></other></parent>");
      const el = doc.documentElement;
      expect(getElementsByLocalName(el, "child")).toEqual([]);
    });
  });
});

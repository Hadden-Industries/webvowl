import { beforeEach, describe, expect, test } from "@jest/globals";
import prefixRepresentationModule from "./prefixRepresentationModule.js";

describe("prefixRepresentationModule", () => {
  let moduleInstance;
  let mockGraph;
  let prefixListMock;

  beforeEach(() => {
    prefixListMock = {
      owl: "http://www.w3.org/2002/07/owl#",
      rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
      rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      foaf: "http://xmlns.com/foaf/0.1/",
    };

    mockGraph = {
      options: () => ({
        prefixList: () => prefixListMock,
        getGeneralMetaObjectProperty: (prop) =>
          prop === "iri" ? "http://example.org/ontology#" : undefined,
      }),
    };

    moduleInstance = prefixRepresentationModule(mockGraph);
  });

  describe("validURL", () => {
    test("accepts traditional web URLs with standard TLDs", () => {
      expect(moduleInstance.validURL("http://example.com/item")).toBe(true);
      expect(
        moduleInstance.validURL("https://www.w3.org/2002/07/owl#Thing"),
      ).toBe(true);
    });

    test("accepts modern gTLDs, multi-part TLDs, and ccTLDs", () => {
      expect(
        moduleInstance.validURL("https://example.tech/ontology#Item"),
      ).toBe(true);
      expect(moduleInstance.validURL("https://schema.technology/term")).toBe(
        true,
      );
      expect(moduleInstance.validURL("https://agents.md/ontology#Agent")).toBe(
        true,
      );
      expect(
        moduleInstance.validURL("https://design.online/class#Person"),
      ).toBe(true);
      expect(moduleInstance.validURL("https://sub.domain.cloud/ns#Item")).toBe(
        true,
      );
    });

    test("accepts localhost, IP addresses, and custom ports", () => {
      expect(moduleInstance.validURL("http://localhost:8080/onto#Class")).toBe(
        true,
      );
      expect(moduleInstance.validURL("http://127.0.0.1:3000/ns#Prop")).toBe(
        true,
      );
      expect(moduleInstance.validURL("ftp://files.example.org/onto.owl")).toBe(
        true,
      );
    });

    test("rejects invalid URLs, plain strings, and prefixed QNames", () => {
      expect(moduleInstance.validURL("not-a-url")).toBe(false);
      expect(moduleInstance.validURL("owl:Thing")).toBe(false);
      expect(moduleInstance.validURL(":MyClass")).toBe(false);
      expect(moduleInstance.validURL("foaf:Person")).toBe(false);
      expect(moduleInstance.validURL("")).toBe(false);
      expect(moduleInstance.validURL(null)).toBe(false);
      expect(moduleInstance.validURL(undefined)).toBe(false);
    });
  });

  describe("isPrefixedRepresentation & formatForTTL", () => {
    test("identifies prefixed representations (CURIEs)", () => {
      expect(moduleInstance.isPrefixedRepresentation("owl:Thing")).toBe(true);
      expect(moduleInstance.isPrefixedRepresentation(":MyClass")).toBe(true);
      expect(moduleInstance.isPrefixedRepresentation("foaf:name")).toBe(true);
      expect(
        moduleInstance.isPrefixedRepresentation(
          "https://example.tech/ontology#Item",
        ),
      ).toBe(false);
    });

    test("formats un-prefixed absolute IRIs with angle brackets for Turtle", () => {
      expect(
        moduleInstance.formatForTTL("https://example.tech/ontology#Item"),
      ).toBe("<https://example.tech/ontology#Item>");
      expect(moduleInstance.formatForTTL("http://example.com/ns#Item")).toBe(
        "<http://example.com/ns#Item>",
      );
    });

    test("leaves prefixed QNames unbracketed for Turtle", () => {
      expect(moduleInstance.formatForTTL("owl:Thing")).toBe("owl:Thing");
      expect(moduleInstance.formatForTTL(":MyClass")).toBe(":MyClass");
    });
  });
});

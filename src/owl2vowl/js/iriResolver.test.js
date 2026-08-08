import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import { PerformanceIriResolver } from "./iriResolver.js";

describe("PerformanceIriResolver", () => {
  let resolver;
  const defaultBase = "http://example.org/ontology";

  beforeEach(() => {
    resolver = new PerformanceIriResolver(defaultBase);
  });

  describe("resolve", () => {
    test("returns activeBase when iri is empty or null", () => {
      expect(resolver.resolve("")).toBe(defaultBase);
      expect(resolver.resolve(null)).toBe(defaultBase);
    });

    test("leaves absolute IRIs untouched", () => {
      expect(resolver.resolve("http://another.org/test")).toBe(
        "http://another.org/test",
      );
      expect(resolver.resolve("https://example.com/schema#Prop")).toBe(
        "https://example.com/schema#Prop",
      );
    });

    test("resolves fragment IRIs starting with #", () => {
      // Base without hash
      expect(resolver.resolve("#Class1")).toBe(
        "http://example.org/ontology#Class1",
      );

      // Base with hash
      const hashResolver = new PerformanceIriResolver(
        "http://example.org/ontology#",
      );
      expect(hashResolver.resolve("#Class1")).toBe(
        "http://example.org/ontology#Class1",
      );
    });

    test("resolves relative IRIs with base endings", () => {
      // Base ending with slash
      const slashResolver = new PerformanceIriResolver(
        "http://example.org/ontology/",
      );
      expect(slashResolver.resolve("Class1")).toBe(
        "http://example.org/ontology/Class1",
      );

      // Base ending with hash
      const hashResolver = new PerformanceIriResolver(
        "http://example.org/ontology#",
      );
      expect(hashResolver.resolve("Class1")).toBe(
        "http://example.org/ontology#Class1",
      );

      // Base without ending
      expect(resolver.resolve("Class1")).toBe(
        "http://example.org/ontology#Class1",
      );
    });

    test("uses overridden baseIri when provided", () => {
      const customBase = "http://custom.com/";
      expect(resolver.resolve("Prop", customBase)).toBe(
        "http://custom.com/Prop",
      );
      expect(resolver.resolve("#Prop", customBase)).toBe(
        "http://custom.com/#Prop",
      ); // Wait, does customBase end with slash? yes. "#Prop" starts with #. activeBase = "http://custom.com/". activeBase.endsWith("#") is false. So activeBase + iri.substring(1) = "http://custom.com/#Prop". Yes!
    });
  });

  describe("getLocalName", () => {
    test("extracts local name from hash IRIs", () => {
      expect(resolver.getLocalName("http://example.org#ClassName")).toBe(
        "ClassName",
      );
    });

    test("extracts local name from slash IRIs", () => {
      expect(resolver.getLocalName("http://example.org/ClassName")).toBe(
        "ClassName",
      );
    });

    test("returns empty string or handles edge cases", () => {
      expect(resolver.getLocalName("")).toBe("");
      expect(resolver.getLocalName(null)).toBe("");
      expect(resolver.getLocalName("NoSeparator")).toBe("NoSeparator");
    });
  });

  describe("getBaseIri", () => {
    test("extracts base namespace from hash IRIs", () => {
      expect(resolver.getBaseIri("http://example.org#ClassName")).toBe(
        "http://example.org",
      );
    });

    test("extracts base namespace from slash IRIs", () => {
      expect(resolver.getBaseIri("http://example.org/ClassName")).toBe(
        "http://example.org",
      );
    });

    test("returns empty string or handles edge cases", () => {
      expect(resolver.getBaseIri("")).toBe("");
      expect(resolver.getBaseIri(null)).toBe("");
      expect(resolver.getBaseIri("NoSeparator")).toBe("NoSeparator");
    });
  });

  describe("Cache behavior", () => {
    test("subsequent calls are resolved from caches without recalculating", () => {
      const getSpy = jest.spyOn(Map.prototype, "get");
      const setSpy = jest.spyOn(Map.prototype, "set");

      try {
        const iri = "ClassName";

        // --- 1. Test resolve cache ---
        setSpy.mockClear();
        getSpy.mockClear();

        const firstResolve = resolver.resolve(iri);
        expect(firstResolve).toBe("http://example.org/ontology#ClassName");
        expect(setSpy).toHaveBeenCalled(); // Should set in cache

        const secondResolve = resolver.resolve(iri);
        expect(secondResolve).toBe("http://example.org/ontology#ClassName");

        // Find if the set call was invoked for our cacheKey during the second resolve
        // In reality, it should not be called again
        const setCallsCountAfterFirst = setSpy.mock.calls.length;
        resolver.resolve(iri);
        expect(setSpy.mock.calls.length).toBe(setCallsCountAfterFirst); // No new set calls

        // --- 2. Test getLocalName cache ---
        setSpy.mockClear();
        const firstLocal = resolver.getLocalName("http://example.org#Item");
        expect(firstLocal).toBe("Item");
        expect(setSpy).toHaveBeenCalled();

        const setCallsAfterLocalFirst = setSpy.mock.calls.length;
        const secondLocal = resolver.getLocalName("http://example.org#Item");
        expect(secondLocal).toBe("Item");
        expect(setSpy.mock.calls.length).toBe(setCallsAfterLocalFirst);

        // --- 3. Test getBaseIri cache ---
        setSpy.mockClear();
        const firstBase = resolver.getBaseIri("http://example.org#Item");
        expect(firstBase).toBe("http://example.org");
        expect(setSpy).toHaveBeenCalled();

        const setCallsAfterBaseFirst = setSpy.mock.calls.length;
        const secondBase = resolver.getBaseIri("http://example.org#Item");
        expect(secondBase).toBe("http://example.org");
        expect(setSpy.mock.calls.length).toBe(setCallsAfterBaseFirst);
      } finally {
        getSpy.mockRestore();
        setSpy.mockRestore();
      }
    });
  });
});

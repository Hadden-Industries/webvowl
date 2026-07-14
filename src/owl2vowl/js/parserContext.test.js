import { describe, test, expect, beforeEach } from "@jest/globals";
import { VowlParserContext } from "./parserContext.js";

describe("VowlParserContext", () => {
  let context;

  beforeEach(() => {
    context = new VowlParserContext();
  });

  test("Constructor initializes all collections correctly", () => {
    expect(context.classMap).toBeInstanceOf(Map);
    expect(context.classMap.size).toBe(0);

    expect(context.propertyMap).toBeInstanceOf(Map);
    expect(context.propertyMap.size).toBe(0);

    expect(Array.isArray(context.subclassRelations)).toBe(true);
    expect(context.subclassRelations.length).toBe(0);

    expect(Array.isArray(context.subpropertyRelations)).toBe(true);
    expect(context.subpropertyRelations.length).toBe(0);

    expect(Array.isArray(context.parsedRestrictions)).toBe(true);
    expect(context.parsedRestrictions.length).toBe(0);

    expect(Array.isArray(context.parsedCardinalities)).toBe(true);
    expect(context.parsedCardinalities.length).toBe(0);

    expect(Array.isArray(context.virtualDatatypes)).toBe(true);
    expect(context.virtualDatatypes.length).toBe(0);

    expect(Array.isArray(context.parsedIndividuals)).toBe(true);
    expect(context.parsedIndividuals.length).toBe(0);
  });

  test("nextId() returns incremental ID strings starting from '0'", () => {
    expect(context.nextId()).toBe("0");
    expect(context.nextId()).toBe("1");
    expect(context.nextId()).toBe("2");
    expect(context.nextId()).toBe("3");
  });

  test("#idCounter is private and not directly accessible", () => {
    expect(context.idCounter).toBeUndefined();
    expect(context["#idCounter"]).toBeUndefined();
    expect("idCounter" in context).toBe(false);
    expect("#idCounter" in context).toBe(false);
  });
});

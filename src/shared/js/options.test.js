import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import optionsFactory from "./options.js";

describe("options prefix and URL management", () => {
  let options;
  let mockWarningModule;

  beforeEach(() => {
    options = optionsFactory();
    mockWarningModule = {
      showWarning: jest.fn(),
    };
    options.warningModule(mockWarningModule);
  });

  describe("updatePrefix with modern URLs", () => {
    test("accepts new prefix with modern gTLD URL", () => {
      const result = options.updatePrefix(
        "oldEx",
        "newEx",
        "http://example.com/ns#",
        "https://example.tech/ns#",
      );

      expect(result).toBe(true);
      expect(options.prefixList()["newEx"]).toBe("https://example.tech/ns#");
      expect(mockWarningModule.showWarning).not.toHaveBeenCalled();
    });

    test("accepts updating URL for existing prefix with modern gTLD URL", () => {
      options.addPrefix("ex", "http://example.com/old#");

      const result = options.updatePrefix(
        "ex",
        "ex",
        "http://example.com/old#",
        "https://schema.technology/term#",
      );

      expect(result).toBe(true);
      expect(options.prefixList()["ex"]).toBe(
        "https://schema.technology/term#",
      );
      expect(mockWarningModule.showWarning).not.toHaveBeenCalled();
    });

    test("accepts localhost and custom port URLs", () => {
      const result = options.updatePrefix(
        "local",
        "local",
        "http://old.com",
        "http://localhost:8080/ontology#",
      );

      expect(result).toBe(true);
      expect(options.prefixList()["local"]).toBe(
        "http://localhost:8080/ontology#",
      );
    });

    test("rejects malformed URLs with a warning dialog", () => {
      const result = options.updatePrefix(
        "invalid",
        "invalid",
        "http://old.com",
        "not-a-valid-url",
      );

      expect(result).toBe(false);
      expect(mockWarningModule.showWarning).toHaveBeenCalled();
    });
  });

  describe("addOrUpdateGeneralObjectEntry with IRI property", () => {
    test("accepts ontology IRI with modern gTLD", () => {
      const result = options.addOrUpdateGeneralObjectEntry(
        "iri",
        "https://agents.md/ontology#Agent",
      );

      expect(result).toBe(true);
      expect(options.getGeneralMetaObjectProperty("iri")).toBe(
        "https://agents.md/ontology#Agent",
      );
      expect(mockWarningModule.showWarning).not.toHaveBeenCalled();
    });

    test("rejects invalid ontology IRI", () => {
      const result = options.addOrUpdateGeneralObjectEntry(
        "iri",
        "not a valid url",
      );

      expect(result).toBe(false);
      expect(mockWarningModule.showWarning).toHaveBeenCalled();
    });
  });
});

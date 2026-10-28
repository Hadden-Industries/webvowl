import { Tokenizer, TokenParser, TokenType } from "@streamparser/json";
import { OntologyCacheError } from "./ontologySourceIdentity.js";

const timestampFields = new Set([
  "admittedAt",
  "startedAt",
  "finishedAt",
  "acquiredAt",
  "checkedAt",
  "observedAt",
  "lastAttemptedAt",
  "lastSuccessfullyCheckedAt",
  "lastChangedAt",
  "freshUntil",
  "nextCheckAllowedAt",
  "withdrawnAt",
]);

/** The native tokenizer/parser owns JSON grammar; this boundary preserves duplicate/depth evidence. */
export function parseOntologyCacheJson(bytes) {
  if (
    !(bytes instanceof Uint8Array) ||
    (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
  ) {
    throw new OntologyCacheError();
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const tokenizer = new Tokenizer();
    const parser = new TokenParser({ paths: ["$"] });
    const frames = [];
    let result;
    parser.onValue = ({ value, stack }) => {
      if (stack.length === 0) {
        result = value;
      }
    };
    tokenizer.onToken = (entry) => {
      const { token, value } = entry;
      const frame = frames.at(-1);
      if (token === TokenType.STRING) {
        const isKey = frame?.expectKey;
        if (!value.isWellFormed()) {
          throw new OntologyCacheError();
        }
        if (frame?.expectKey) {
          if (frame.names.has(value)) {
            throw new OntologyCacheError();
          }
          frame.names.add(value);
          frame.key = value;
          frame.expectKey = false;
        }
        // Schema patterns cannot reject impossible calendar dates.
        if (
          !isKey &&
          timestampFields.has(frame?.key) &&
          new Date(value).toISOString() !== value
        ) {
          throw new OntologyCacheError();
        }
      }
      if (
        token === TokenType.NUMBER &&
        (!Number.isFinite(value) ||
          (Number.isInteger(value) && !Number.isSafeInteger(value)))
      ) {
        throw new OntologyCacheError();
      }
      if (token === TokenType.LEFT_BRACE || token === TokenType.LEFT_BRACKET) {
        if (frames.length >= 32) {
          throw new OntologyCacheError();
        }
        frames.push({
          object: token === TokenType.LEFT_BRACE,
          expectKey: token === TokenType.LEFT_BRACE,
          names: new Set(),
        });
      } else if (
        token === TokenType.RIGHT_BRACE ||
        token === TokenType.RIGHT_BRACKET
      ) {
        frames.pop();
      } else if (token === TokenType.COMMA && frame?.object) {
        frame.expectKey = true;
      }
      parser.write(entry);
    };
    tokenizer.write(text);
    tokenizer.end();
    return result;
  } catch (_error) {
    throw new OntologyCacheError();
  }
}

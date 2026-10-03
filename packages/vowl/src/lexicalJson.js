import { Tokenizer, TokenParser, TokenType } from "@streamparser/json";
import { at, fail, VowlError } from "./errors.js";
import { checkString } from "./snapshot.js";
import { categories } from "./profiles.js";

/** Fatal UTF-8, duplicate decoded keys and lexical bounds precede schema materialization. */
export function parseBytes(bytes, budget) {
  const chunkSize = 1024;
  const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  try {
    for (let i = 0; i < bytes.length; i += chunkSize) {
      budget.check();
      utf8.decode(bytes.subarray(i, i + chunkSize), { stream: true });
    }
    utf8.decode();
  } catch (error) {
    if (error instanceof VowlError) {
      throw error;
    }
    fail("JSON_INVALID_UTF8");
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    fail("JSON_BOM", "", { byteOffset: 0 });
  }
  const tokenizer = new Tokenizer({
    stringBufferSize: 1024,
    numberBufferSize: 1024,
    emitPartialTokens: true,
  });
  const parser = new TokenParser({ keepStack: true });
  const frames = [];
  let result;
  let produced = false;
  let offset = 0;
  let partialOffset = -1;
  let partialLength = 0;
  let partialBytes = 0;
  parser.onValue = ({ value, stack }) => {
    if (!stack.length) {
      result = value;
      produced = true;
    }
  };
  const onError = (error) => {
    if (error instanceof VowlError) {
      throw error;
    }
    fail("JSON_SYNTAX", undefined, { byteOffset: offset });
  };
  parser.onError = onError;
  tokenizer.onError = onError;
  tokenizer.onToken = (entry) => {
    budget.check();
    const { token, value, partial } = entry;
    offset = entry.offset;
    const frame = frames.at(-1);
    const keyToken =
      token === TokenType.STRING && frame?.object && frame.keyExpected;
    const pointer = frame
      ? at(
          frame.pointer,
          frame.object ? (keyToken ? value : frame.key) : frame.index,
        )
      : "";
    if (partial) {
      if (token === TokenType.STRING) {
        if (partialOffset !== offset) {
          partialOffset = offset;
          partialLength = 0;
          partialBytes = 0;
        }
        // A partial escaped surrogate pair can end after its first code unit.
        const end = /[\ud800-\udbff]$/.test(value)
          ? value.length - 1
          : value.length;
        partialBytes += checkString(
          value.slice(partialLength, end),
          undefined,
          budget,
          false,
        );
        partialLength = end;
        budget.bound("stringBytes", partialBytes);
        budget.bound(
          "totalStringBytes",
          (budget.counts.totalStringBytes ?? 0) + partialBytes,
        );
      }
      return;
    }
    if (token === TokenType.STRING) {
      checkString(value, pointer, budget);
      if (keyToken) {
        if (frame.names.has(value)) {
          fail("JSON_DUPLICATE_MEMBER", pointer, { byteOffset: offset });
        }
        frame.names.add(value);
      }
    }
    if (
      token === TokenType.NUMBER &&
      (!Number.isFinite(value) || Object.is(value, -0))
    ) {
      fail("NUMBER_INVALID", pointer, { byteOffset: offset });
    }
    const opens =
      token === TokenType.LEFT_BRACE || token === TokenType.LEFT_BRACKET;
    if (opens) {
      budget.bound("depth", frames.length + 1, pointer);
      const primary =
        frame &&
        !frame.object &&
        Object.keys(categories).some(
          (category) => frame.pointer === `/structural/${category}`,
        );
      budget.charge(primary ? "primaryRecords" : "embeddedValues", 1, pointer);
    }
    // The standards library validates grammar and owns object/value construction.
    // Duplicate names are rejected before this assignment boundary.
    parser.write(entry);
    if (keyToken) {
      frame.key = value;
      frame.keyExpected = false;
    }
    if (token === TokenType.COMMA && frame) {
      if (frame.object) {
        frame.keyExpected = true;
      } else {
        frame.index++;
      }
    }
    if (opens) {
      frames.push({
        pointer,
        object: token === TokenType.LEFT_BRACE,
        names: new Set(),
        keyExpected: true,
        key: undefined,
        index: 0,
      });
    }
    if (token === TokenType.RIGHT_BRACE || token === TokenType.RIGHT_BRACKET) {
      frames.pop();
    }
  };
  for (let i = 0; i < bytes.length; i += chunkSize) {
    budget.check();
    tokenizer.write(bytes.subarray(i, i + chunkSize));
  }
  tokenizer.end();
  if (!parser.isEnded) {
    parser.end();
  }
  if (!produced) {
    fail("JSON_SYNTAX", "", { byteOffset: bytes.length });
  }
  return result;
}

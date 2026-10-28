import { Tokenizer, TokenParser, TokenType } from "@streamparser/json";
import { at, fail, VowlError } from "./errors.js";
import { prohibitedScalar, utf8Length } from "./snapshot.js";
import { categories } from "./profiles.js";

const QUOTE = 0x22;
const BACKSLASH = 0x5c;
const MINUS = 0x2d;
// Decoded code points of the two-character escapes, keyed by their second byte.
const shortEscapes = new Map([
  [0x22, 0x22],
  [0x5c, 0x5c],
  [0x2f, 0x2f],
  [0x62, 0x08],
  [0x66, 0x0c],
  [0x6e, 0x0a],
  [0x72, 0x0d],
  [0x74, 0x09],
]);
const literals = new Map([
  [TokenType.TRUE, "true"],
  [TokenType.FALSE, "false"],
  [TokenType.NULL, "null"],
]);
const valueTokens = new Set([
  TokenType.LEFT_BRACE,
  TokenType.LEFT_BRACKET,
  TokenType.STRING,
  TokenType.NUMBER,
  TokenType.TRUE,
  TokenType.FALSE,
  TokenType.NULL,
]);
const notPrintableAscii = /[^ -~]/;
// Stage-3 failures at one position are reported in this order.
const GRAMMAR = 0;
const UNICODE = 2;
const NUMBER = 3;
const LIMIT = 4;

const isDigit = (byte) => byte >= 0x30 && byte <= 0x39;
const isHex = (byte) =>
  isDigit(byte) ||
  (byte >= 0x41 && byte <= 0x46) ||
  (byte >= 0x61 && byte <= 0x66);
const isWhitespace = (byte) =>
  byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d;

/** The offset just past the number at `start`, or of the first byte that cannot continue it. */
function numberEnd(bytes, start) {
  let i = start;
  if (bytes[i] === MINUS) {
    i++;
  }
  if (bytes[i] === 0x30) {
    i++;
  } else {
    if (!isDigit(bytes[i])) {
      return i;
    }
    while (isDigit(bytes[i])) {
      i++;
    }
  }
  if (bytes[i] === 0x2e) {
    i++;
    if (!isDigit(bytes[i])) {
      return i;
    }
    while (isDigit(bytes[i])) {
      i++;
    }
  }
  if (bytes[i] === 0x45 || bytes[i] === 0x65) {
    i++;
    if (bytes[i] === 0x2b || bytes[i] === MINUS) {
      i++;
    }
    if (!isDigit(bytes[i])) {
      return i;
    }
    while (isDigit(bytes[i])) {
      i++;
    }
  }
  return i;
}

/** The offset just past a complete token, found again from the input bytes. */
function tokenEnd(bytes, token, start, budget) {
  if (token === TokenType.STRING) {
    let i = start + 1;
    while (bytes[i] !== QUOTE) {
      budget.poll();
      i += bytes[i] === BACKSLASH ? 2 : 1;
    }
    return i + 1;
  }
  if (token === TokenType.NUMBER) {
    return numberEnd(bytes, start);
  }
  return start + (literals.get(token)?.length ?? 1);
}

/** Fail the string limit that `bytes`, the string's size so far, has crossed. */
function exceedStringLimit(budget, bytes, total, pointer) {
  if (bytes > budget.limits.stringBytes) {
    budget.bound("stringBytes", bytes, pointer);
  }
  budget.bound("totalStringBytes", total + bytes, pointer);
}

/**
 * Admit decoded text in order, checking each code point for Unicode validity
 * and then against both string limits, so the first failure is the earliest.
 */
function admitText(text, pointer, budget, prior = 0, charge = true) {
  const total = budget.counts.totalStringBytes ?? 0;
  // Both limits count the same bytes, so the smaller allowance is crossed first.
  const allowance = Math.min(
    budget.limits.stringBytes,
    budget.limits.totalStringBytes - total,
  );
  let bytes = prior;
  if (!notPrintableAscii.test(text)) {
    // Printable ASCII is one byte per character and never prohibited.
    if (bytes + text.length > allowance) {
      exceedStringLimit(budget, allowance + 1, total, pointer);
    }
    bytes += text.length;
  } else {
    let nextCheck = 1024;
    for (let index = 0; index < text.length; index++) {
      if (index >= nextCheck) {
        budget.check();
        nextCheck = index + 1024;
      }
      // The checks of prohibitedScalar and utf8Length, inlined in this hot loop.
      const scalar = text.codePointAt(index);
      if (
        (scalar >= 0xd800 && scalar <= 0xdfff) ||
        (scalar >= 0xfdd0 && scalar <= 0xfdef) ||
        scalar % 65536 >= 65534
      ) {
        fail("UNICODE_INVALID", pointer);
      }
      bytes +=
        scalar < 0x80 ? 1 : scalar < 0x800 ? 2 : scalar < 0x10000 ? 3 : 4;
      if (scalar > 0xffff) {
        index++;
      }
      if (bytes > allowance) {
        exceedStringLimit(budget, bytes, total, pointer);
      }
    }
  }
  if (charge) {
    budget.charge("totalStringBytes", bytes - prior, pointer);
  }
  return bytes - prior;
}

/**
 * The earliest failure in a string the tokenizer rejected, scanning its bytes
 * so that each failure is measured at its stage-3 position.
 */
function stringFailure(bytes, start, budget) {
  const total = budget.counts.totalStringBytes ?? 0;
  let length = 0;
  let high;
  const admit = (scalar, position) => {
    if (prohibitedScalar(scalar)) {
      return { rank: UNICODE, position };
    }
    length += utf8Length(scalar);
    if (length > budget.limits.stringBytes) {
      return { rank: LIMIT, position, limit: "stringBytes", actual: length };
    }
    if (total + length > budget.limits.totalStringBytes) {
      return {
        rank: LIMIT,
        position,
        limit: "totalStringBytes",
        actual: total + length,
      };
    }
    return undefined;
  };
  let i = start + 1;
  for (;;) {
    budget.poll();
    const byte = bytes[i];
    const unicodeEscape =
      byte === BACKSLASH &&
      bytes[i + 1] === 0x75 &&
      isHex(bytes[i + 2]) &&
      isHex(bytes[i + 3]) &&
      isHex(bytes[i + 4]) &&
      isHex(bytes[i + 5]);
    if (unicodeEscape) {
      const unit = Number.parseInt(
        String.fromCharCode(
          bytes[i + 2],
          bytes[i + 3],
          bytes[i + 4],
          bytes[i + 5],
        ),
        16,
      );
      const position = i + 5;
      i += 6;
      if (high !== undefined && unit >= 0xdc00 && unit <= 0xdfff) {
        const failure = admit(
          0x10000 + (high.unit - 0xd800) * 0x400 + (unit - 0xdc00),
          position,
        );
        high = undefined;
        if (failure) {
          return failure;
        }
        continue;
      }
      if (high !== undefined) {
        return { rank: UNICODE, position: high.position };
      }
      if (unit >= 0xd800 && unit <= 0xdbff) {
        high = { unit, position };
        continue;
      }
      const failure = admit(unit, position);
      if (failure) {
        return failure;
      }
      continue;
    }
    // A high surrogate that no low-surrogate escape follows is lone.
    if (high !== undefined) {
      return { rank: UNICODE, position: high.position };
    }
    if (byte === undefined || byte < 0x20 || byte === QUOTE) {
      return { rank: GRAMMAR, position: i };
    }
    if (byte === BACKSLASH) {
      const escaped = shortEscapes.get(bytes[i + 1]);
      if (escaped === undefined) {
        let position = i + 1;
        if (bytes[position] === 0x75) {
          position++;
          while (position < i + 6 && isHex(bytes[position])) {
            position++;
          }
        }
        return { rank: GRAMMAR, position };
      }
      const failure = admit(escaped, i + 1);
      if (failure) {
        return failure;
      }
      i += 2;
      continue;
    }
    // The input is valid UTF-8, so a lead byte fixes the sequence length and
    // its payload, and each continuation byte adds six bits.
    const size = byte < 0x80 ? 1 : byte < 0xe0 ? 2 : byte < 0xf0 ? 3 : 4;
    let scalar = byte - [0, 0, 0xc0, 0xe0, 0xf0][size];
    for (let k = 1; k < size; k++) {
      scalar = scalar * 64 + (bytes[i + k] - 0x80);
    }
    const failure = admit(scalar, i + size - 1);
    if (failure) {
      return failure;
    }
    i += size;
  }
}

/**
 * Fatal UTF-8 and byte-order-mark checks precede the token stream; within it,
 * the stage-3 failure with the smallest position is reported, grammar first at
 * a tie, before schema materialization.
 */
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
    budget.reportHostLimit(error);
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
  // The grammar's expectation for the next token, which is checked at the
  // token's first byte, before any of its content or limits.
  let expect = "value";
  let lastToken;
  let lastOffset;
  // An inadmissible number fails at the byte after it, where grammar wins a tie.
  let pendingNumber;
  parser.onValue = ({ value, stack }) => {
    if (!stack.length) {
      result = value;
      produced = true;
    }
  };
  const allows = (token) => {
    switch (expect) {
      case "value":
        return valueTokens.has(token);
      case "value-or-close":
        return valueTokens.has(token) || token === TokenType.RIGHT_BRACKET;
      case "name":
        return token === TokenType.STRING;
      case "name-or-close":
        return token === TokenType.STRING || token === TokenType.RIGHT_BRACE;
      case "colon":
        return token === TokenType.COLON;
      case "comma-or-close":
        return (
          token === TokenType.COMMA ||
          token ===
            (frames.at(-1).object
              ? TokenType.RIGHT_BRACE
              : TokenType.RIGHT_BRACKET)
        );
      default:
        return false;
    }
  };
  const failNumber = () =>
    fail("NUMBER_INVALID", pendingNumber.pointer, {
      byteOffset: pendingNumber.offset,
    });
  const admitPosition = (token, position) => {
    if (pendingNumber && pendingNumber.end < position) {
      failNumber();
    }
    if (!allows(token)) {
      fail("JSON_SYNTAX", undefined, { byteOffset: position });
    }
    if (pendingNumber) {
      failNumber();
    }
  };
  // The tokenizer rejects the token after the last complete one; find the
  // earliest failure there, including an inadmissible number just before it.
  const locateFailure = () => {
    let start =
      lastToken === undefined
        ? 0
        : tokenEnd(bytes, lastToken, lastOffset, budget);
    while (isWhitespace(bytes[start])) {
      start++;
    }
    const byte = bytes[start];
    const token =
      byte === QUOTE
        ? TokenType.STRING
        : byte === MINUS || isDigit(byte)
          ? TokenType.NUMBER
          : byte === 0x74
            ? TokenType.TRUE
            : byte === 0x66
              ? TokenType.FALSE
              : byte === 0x6e
                ? TokenType.NULL
                : undefined;
    let failure = { rank: GRAMMAR, position: start };
    if (token === TokenType.STRING && allows(token)) {
      failure = stringFailure(bytes, start, budget);
    } else if (token === TokenType.NUMBER && allows(token)) {
      failure.position = numberEnd(bytes, start);
    } else if (token !== undefined && allows(token)) {
      const word = literals.get(token);
      let i = 1;
      while (i < word.length && bytes[start + i] === word.charCodeAt(i)) {
        i++;
      }
      failure.position = start + i;
    }
    if (
      pendingNumber &&
      (pendingNumber.end < failure.position ||
        (pendingNumber.end === failure.position && failure.rank > NUMBER))
    ) {
      failNumber();
    }
    const frame = frames.at(-1);
    const pointer =
      expect === "name" || expect === "name-or-close"
        ? undefined
        : frame
          ? at(frame.pointer, frame.object ? frame.key : frame.index)
          : "";
    if (failure.rank === UNICODE) {
      fail("UNICODE_INVALID", pointer);
    }
    if (failure.rank === LIMIT) {
      budget.bound(failure.limit, failure.actual, pointer);
    }
    fail("JSON_SYNTAX", undefined, { byteOffset: failure.position });
  };
  parser.onError = (error) => {
    if (error instanceof VowlError) {
      throw error;
    }
    fail("JSON_SYNTAX", undefined, { byteOffset: offset });
  };
  tokenizer.onError = (error) => {
    if (error instanceof VowlError) {
      throw error;
    }
    locateFailure();
  };
  tokenizer.onToken = (entry) => {
    budget.check();
    const { token, value, partial } = entry;
    offset = entry.offset;
    const frame = frames.at(-1);
    const name =
      token === TokenType.STRING &&
      (expect === "name" || expect === "name-or-close");
    const pointer = frame
      ? at(
          frame.pointer,
          frame.object ? (name ? value : frame.key) : frame.index,
        )
      : "";
    const continuing = token === TokenType.STRING && offset === partialOffset;
    if (partial) {
      if (token === TokenType.STRING) {
        if (!continuing) {
          admitPosition(token, offset);
          partialOffset = offset;
          partialLength = 0;
          partialBytes = 0;
        }
        // A partial escaped surrogate pair can end after its first code unit.
        const end = /[\ud800-\udbff]$/.test(value)
          ? value.length - 1
          : value.length;
        partialBytes += admitText(
          value.slice(partialLength, end),
          undefined,
          budget,
          partialBytes,
          false,
        );
        partialLength = end;
      }
      return;
    }
    if (!continuing) {
      admitPosition(token, offset);
    }
    if (token === TokenType.STRING) {
      admitText(value, pointer, budget);
      if (name) {
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
      pendingNumber = { pointer, offset, end: numberEnd(bytes, offset) };
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
    // The standards library owns object/value construction; misplaced tokens
    // and duplicate names are rejected before this assignment boundary.
    parser.write(entry);
    if (name) {
      frame.key = value;
    }
    if (token === TokenType.COMMA && !frame.object) {
      frame.index++;
    }
    if (opens) {
      frames.push({
        pointer,
        object: token === TokenType.LEFT_BRACE,
        names: new Set(),
        key: undefined,
        index: 0,
      });
    }
    if (token === TokenType.RIGHT_BRACE || token === TokenType.RIGHT_BRACKET) {
      frames.pop();
    }
    if (token === TokenType.LEFT_BRACE) {
      expect = "name-or-close";
    } else if (token === TokenType.LEFT_BRACKET) {
      expect = "value-or-close";
    } else if (token === TokenType.COLON) {
      expect = "value";
    } else if (token === TokenType.COMMA) {
      expect = frames.at(-1).object ? "name" : "value";
    } else if (name) {
      expect = "colon";
    } else {
      expect = frames.length ? "comma-or-close" : "end";
    }
    lastToken = token;
    lastOffset = offset;
  };
  for (let i = 0; i < bytes.length; i += chunkSize) {
    budget.check();
    tokenizer.write(bytes.subarray(i, i + chunkSize));
  }
  tokenizer.end();
  // Truncation ties with a number that ends the input, and grammar wins.
  if (pendingNumber && (expect === "end" || pendingNumber.end < bytes.length)) {
    failNumber();
  }
  if (expect !== "end") {
    fail("JSON_SYNTAX", "", { byteOffset: bytes.length });
  }
  if (!parser.isEnded) {
    parser.end();
  }
  if (!produced) {
    fail("JSON_SYNTAX", "", { byteOffset: bytes.length });
  }
  return result;
}

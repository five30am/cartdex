/**
 * ClrMamePro textual DAT parser.
 *
 * ClrMamePro format uses a recursive-descent structure where each block opens
 * with a keyword followed by parentheses:
 *
 *   clrmamepro (
 *     name "Super Nintendo Entertainment System"
 *     description "Super Nintendo Entertainment System"
 *     version "20240101-000000"
 *     author "no-intro"
 *     header "No-Intro_NES.xml"
 *   )
 *   game (
 *     name "1942 (Japan)"
 *     description "1942 (Japan)"
 *     rom ( name "1942 (Japan).nes" size 40960 crc b19ed489 sha1 abc... )
 *   )
 *
 * We implement a hand-rolled tokeniser + parser rather than regex soup because
 * ClrMamePro strings can contain nested parentheses (e.g. "(Japan)") which
 * breaks pattern-based approaches.
 */

export interface ClrmameHeader {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  /** Skipper XML filename from the `header` field. */
  skipper_ref?: string;
}

export interface ClrmameRom {
  name: string;
  size?: number;
  crc32?: string;
  md5?: string;
  sha1?: string;
  /** DAT status flag — "baddump", "nodump", or absent (good). */
  status?: string;
}

export interface ClrmameGame {
  name: string;
  description?: string;
  cloneof?: string;
  romof?: string;
  serial?: string;
  region?: string;
  roms: ClrmameRom[];
}

export interface ParsedClrmaneDat {
  header: ClrmameHeader;
  games: ClrmameGame[];
}

// ---------------------------------------------------------------------------
// Tokeniser
// ---------------------------------------------------------------------------

type Token =
  | { kind: "word"; value: string }
  | { kind: "string"; value: string }
  | { kind: "lparen" }
  | { kind: "rparen" };

function tokenise(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Skip whitespace
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      i++;
      continue;
    }

    // Line comment — # to end of line
    if (ch === "#") {
      while (i < input.length && input[i] !== "\n") i++;
      continue;
    }

    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
      continue;
    }

    if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
      continue;
    }

    // Quoted string — may contain escaped quotes (\")
    if (ch === '"') {
      i++; // skip opening quote
      let str = "";
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < input.length && input[i + 1] === '"') {
          str += '"';
          i += 2;
        } else {
          str += input[i];
          i++;
        }
      }
      i++; // skip closing quote
      tokens.push({ kind: "string", value: str });
      continue;
    }

    // Bare word (unquoted token — typically a keyword, hex value, or number)
    let word = "";
    while (
      i < input.length &&
      input[i] !== " " &&
      input[i] !== "\t" &&
      input[i] !== "\r" &&
      input[i] !== "\n" &&
      input[i] !== "(" &&
      input[i] !== ")" &&
      input[i] !== '"' &&
      input[i] !== "#"
    ) {
      word += input[i];
      i++;
    }
    if (word) {
      tokens.push({ kind: "word", value: word });
    }
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class TokenStream {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  consume(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new Error("Unexpected end of token stream");
    this.pos++;
    return t;
  }

  expectWord(): string {
    const t = this.consume();
    if (t.kind !== "word") throw new Error(`Expected word, got ${t.kind}`);
    return t.value;
  }

  expectLParen(): void {
    const t = this.consume();
    if (t.kind !== "lparen") throw new Error(`Expected '(', got ${t.kind}`);
  }

  expectRParen(): void {
    const t = this.consume();
    if (t.kind !== "rparen") throw new Error(`Expected ')', got ${t.kind}`);
  }

  expectStringOrWord(): string {
    const t = this.consume();
    if (t.kind === "string" || t.kind === "word") return t.value;
    throw new Error(`Expected string or word, got ${t.kind}`);
  }

  done(): boolean {
    return this.pos >= this.tokens.length;
  }
}

/**
 * Parse the key/value pairs inside a block — stops at the matching ')'.
 * Returns a flat key→value map plus a `roms` array for nested rom blocks.
 */
function parseBlock(stream: TokenStream): {
  fields: Map<string, string>;
  roms: ClrmameRom[];
} {
  const fields = new Map<string, string>();
  const roms: ClrmameRom[] = [];

  while (!stream.done()) {
    const next = stream.peek();
    if (!next) break;
    if (next.kind === "rparen") {
      stream.consume(); // consume the ')'
      break;
    }
    if (next.kind !== "word") {
      // Skip unexpected tokens defensively
      stream.consume();
      continue;
    }

    const key = stream.expectWord().toLowerCase();

    // Nested block (e.g. `rom ( ... )`)
    const afterKey = stream.peek();
    if (afterKey?.kind === "lparen") {
      stream.expectLParen();
      const nested = parseBlock(stream);
      if (key === "rom") {
        roms.push(blockToRom(nested.fields));
      }
      // Other nested blocks (disk, sample) are ignored in v1
      continue;
    }

    // Bare value — could be string or word
    const value = stream.expectStringOrWord();
    fields.set(key, value);
  }

  return { fields, roms };
}

function blockToRom(fields: Map<string, string>): ClrmameRom {
  return {
    name: fields.get("name") ?? "",
    size: fields.has("size") ? parseInt(fields.get("size")!, 10) : undefined,
    crc32: fields.get("crc")?.toLowerCase() ?? fields.get("crc32")?.toLowerCase(),
    md5: fields.get("md5")?.toLowerCase(),
    sha1: fields.get("sha1")?.toLowerCase(),
    status: fields.get("status"),
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Parse ClrMamePro textual DAT content.
 * Throws if the content cannot be parsed or is missing a valid header block.
 */
export function parseClrmaneDat(content: string): ParsedClrmaneDat {
  const tokens = tokenise(content);
  const stream = new TokenStream(tokens);

  let header: ClrmameHeader | null = null;
  const games: ClrmameGame[] = [];

  while (!stream.done()) {
    const next = stream.peek();
    if (!next || next.kind !== "word") {
      stream.consume();
      continue;
    }

    const keyword = stream.expectWord().toLowerCase();
    stream.expectLParen();
    const { fields, roms } = parseBlock(stream);

    if (keyword === "clrmamepro") {
      const name = fields.get("name") ?? "Unknown";
      header = {
        name,
        description: fields.get("description"),
        version: fields.get("version"),
        author: fields.get("author"),
        skipper_ref: fields.get("header"),
      };
      continue;
    }

    if (keyword === "game" || keyword === "machine") {
      const name = fields.get("name");
      if (!name) continue;

      games.push({
        name,
        description: fields.get("description"),
        cloneof: fields.get("cloneof"),
        romof: fields.get("romof"),
        serial: fields.get("serial"),
        region: fields.get("region"),
        roms,
      });
      continue;
    }

    // Unknown top-level blocks (dir, resource, header variants) — skip
  }

  if (!header) {
    throw new Error(
      "Invalid ClrMamePro DAT: missing clrmamepro header block"
    );
  }

  return { header, games };
}

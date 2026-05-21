/**
 * Centralized API error vocabulary for CartDex route handlers.
 *
 * Pattern: define HTTP status + machine-readable code + human message once.
 * Call `apiError(ApiErrorCode.GAME_NOT_FOUND)` at the call site — no magic
 * strings, no inline status codes scattered across route files.
 *
 * Usage:
 *   import { apiError, ApiErrorCode } from "@/lib/api-error";
 *   return apiError(ApiErrorCode.GAME_NOT_FOUND);
 *
 * For errors that need dynamic message content (e.g., validation details),
 * use `apiErrorWithDetail`:
 *   return apiErrorWithDetail(ApiErrorCode.INVALID_INPUT, "ids must be a non-empty array");
 *
 * NOTE — `code` field in responses: exposing machine-readable error codes is
 * acceptable for this single-user homelab tool. This pattern MUST NOT be
 * adopted verbatim in multi-tenant or public-facing contexts where enumerable
 * error codes can aid attacker reconnaissance.
 */

import { NextResponse } from "next/server";

export const ApiErrorCode = {
  // 400 Bad Request
  INVALID_ID: "INVALID_ID",
  INVALID_INPUT: "INVALID_INPUT",
  INVALID_JSON: "INVALID_JSON",
  CONFIRM_REQUIRED: "CONFIRM_REQUIRED",
  INVALID_ACTION: "INVALID_ACTION",
  PATH_TRAVERSAL: "PATH_TRAVERSAL",

  // 401 Unauthorized
  UNAUTHORIZED: "UNAUTHORIZED",

  // 404 Not Found
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  SYSTEM_NOT_FOUND: "SYSTEM_NOT_FOUND",
  COLLECTION_NOT_FOUND: "COLLECTION_NOT_FOUND",
  FRANCHISE_NOT_FOUND: "FRANCHISE_NOT_FOUND",
  TRASH_RECORD_NOT_FOUND: "TRASH_RECORD_NOT_FOUND",
  FILE_NOT_IN_TRASH: "FILE_NOT_IN_TRASH",

  // 409 Conflict
  GAME_NOT_IN_TRASH: "GAME_NOT_IN_TRASH",

  // 422 Unprocessable Entity
  COLLECTION_EMPTY: "COLLECTION_EMPTY",

  // 500 Internal Server Error
  INTERNAL_ERROR: "INTERNAL_ERROR",

  // 503 Service Unavailable
  FS_READ_ONLY: "FS_READ_ONLY",

  // DAT library (Ticket 2)
  DAT_NOT_FOUND: "DAT_NOT_FOUND",
  DAT_DUPLICATE: "DAT_DUPLICATE",
  DAT_PARSE_ERROR: "DAT_PARSE_ERROR",
  DAT_FORMAT_UNSUPPORTED: "DAT_FORMAT_UNSUPPORTED",
  DAT_TOO_LARGE: "DAT_TOO_LARGE",
  DAT_RATE_LIMITED: "DAT_RATE_LIMITED",

  // DAT match engine (Ticket 4)
  DAT_MATCH_BUSY: "DAT_MATCH_BUSY",

  // DAT auto-fetch (Ticket 8)
  DAT_FETCH_UNKNOWN_PROVIDER: "DAT_FETCH_UNKNOWN_PROVIDER",
  DAT_FETCH_PROVIDER_ERROR: "DAT_FETCH_PROVIDER_ERROR",
  DAT_FETCH_NETWORK_ERROR: "DAT_FETCH_NETWORK_ERROR",

  // DAT wantlist export (Ticket 7)
  DAT_WANTLIST_BAD_FORMAT: "DAT_WANTLIST_BAD_FORMAT",
} as const;

export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

interface ApiErrorDef {
  status: number;
  code: ApiErrorCode;
  message: string;
}

const API_ERRORS: Record<ApiErrorCode, ApiErrorDef> = {
  // 400
  [ApiErrorCode.INVALID_ID]: {
    status: 400,
    code: ApiErrorCode.INVALID_ID,
    message: "Invalid ID — must be a positive integer",
  },
  [ApiErrorCode.INVALID_INPUT]: {
    status: 400,
    code: ApiErrorCode.INVALID_INPUT,
    message: "Invalid input",
  },
  [ApiErrorCode.INVALID_JSON]: {
    status: 400,
    code: ApiErrorCode.INVALID_JSON,
    message: "Invalid JSON in request body",
  },
  [ApiErrorCode.CONFIRM_REQUIRED]: {
    status: 400,
    code: ApiErrorCode.CONFIRM_REQUIRED,
    message: "confirm: true required in request body to prevent accidental deletes",
  },
  [ApiErrorCode.INVALID_ACTION]: {
    status: 400,
    code: ApiErrorCode.INVALID_ACTION,
    message: "Invalid action",
  },
  [ApiErrorCode.PATH_TRAVERSAL]: {
    status: 400,
    code: ApiErrorCode.PATH_TRAVERSAL,
    message: "Destination path escapes trash directory",
  },

  // 401
  [ApiErrorCode.UNAUTHORIZED]: {
    status: 401,
    code: ApiErrorCode.UNAUTHORIZED,
    message: "Unauthorized — valid X-Api-Token header required for mutation endpoints",
  },

  // 404
  [ApiErrorCode.GAME_NOT_FOUND]: {
    status: 404,
    code: ApiErrorCode.GAME_NOT_FOUND,
    message: "Game not found",
  },
  [ApiErrorCode.SYSTEM_NOT_FOUND]: {
    status: 404,
    code: ApiErrorCode.SYSTEM_NOT_FOUND,
    message: "System not found",
  },
  [ApiErrorCode.COLLECTION_NOT_FOUND]: {
    status: 404,
    code: ApiErrorCode.COLLECTION_NOT_FOUND,
    message: "Collection not found",
  },
  [ApiErrorCode.FRANCHISE_NOT_FOUND]: {
    status: 404,
    code: ApiErrorCode.FRANCHISE_NOT_FOUND,
    message: "Franchise not found",
  },
  [ApiErrorCode.TRASH_RECORD_NOT_FOUND]: {
    status: 404,
    code: ApiErrorCode.TRASH_RECORD_NOT_FOUND,
    message: "No trash record found for this game — cannot determine restore path",
  },
  [ApiErrorCode.FILE_NOT_IN_TRASH]: {
    status: 404,
    code: ApiErrorCode.FILE_NOT_IN_TRASH,
    message: "File not found in trash directory — may have been manually deleted",
  },

  // 409
  [ApiErrorCode.GAME_NOT_IN_TRASH]: {
    status: 409,
    code: ApiErrorCode.GAME_NOT_IN_TRASH,
    message: "Game must be in trash (hidden_reason='trashed') before permanent deletion",
  },

  // 422
  [ApiErrorCode.COLLECTION_EMPTY]: {
    status: 422,
    code: ApiErrorCode.COLLECTION_EMPTY,
    message: "Collection is empty — add games before exporting",
  },

  // 500
  [ApiErrorCode.INTERNAL_ERROR]: {
    status: 500,
    code: ApiErrorCode.INTERNAL_ERROR,
    message: "Internal server error",
  },

  // 503
  [ApiErrorCode.FS_READ_ONLY]: {
    status: 503,
    code: ApiErrorCode.FS_READ_ONLY,
    message: "ROM directory is not writable — check container mount (needs :rw)",
  },

  // DAT library
  [ApiErrorCode.DAT_NOT_FOUND]: {
    status: 404,
    code: ApiErrorCode.DAT_NOT_FOUND,
    message: "DAT not found",
  },
  [ApiErrorCode.DAT_DUPLICATE]: {
    status: 409,
    code: ApiErrorCode.DAT_DUPLICATE,
    message: "This DAT file has already been imported (duplicate file hash)",
  },
  [ApiErrorCode.DAT_PARSE_ERROR]: {
    status: 422,
    code: ApiErrorCode.DAT_PARSE_ERROR,
    message: "DAT file could not be parsed",
  },
  [ApiErrorCode.DAT_FORMAT_UNSUPPORTED]: {
    status: 422,
    code: ApiErrorCode.DAT_FORMAT_UNSUPPORTED,
    message: "Unsupported DAT format",
  },
  [ApiErrorCode.DAT_TOO_LARGE]: {
    status: 413,
    code: ApiErrorCode.DAT_TOO_LARGE,
    message: "DAT file exceeds 50 MB upload limit",
  },
  [ApiErrorCode.DAT_RATE_LIMITED]: {
    status: 429,
    code: ApiErrorCode.DAT_RATE_LIMITED,
    message: "Too many DAT uploads — please wait before retrying",
  },

  // DAT match engine
  [ApiErrorCode.DAT_MATCH_BUSY]: {
    status: 409,
    code: ApiErrorCode.DAT_MATCH_BUSY,
    message: "A match pass is already running — wait for it to complete before starting another",
  },

  // DAT auto-fetch (Ticket 8)
  [ApiErrorCode.DAT_FETCH_UNKNOWN_PROVIDER]: {
    status: 400,
    code: ApiErrorCode.DAT_FETCH_UNKNOWN_PROVIDER,
    message: "Unknown DAT provider ID",
  },
  [ApiErrorCode.DAT_FETCH_PROVIDER_ERROR]: {
    status: 422,
    code: ApiErrorCode.DAT_FETCH_PROVIDER_ERROR,
    message: "DAT provider could not satisfy the request",
  },
  [ApiErrorCode.DAT_FETCH_NETWORK_ERROR]: {
    status: 502,
    code: ApiErrorCode.DAT_FETCH_NETWORK_ERROR,
    message: "Network error fetching DAT from remote provider",
  },

  // DAT wantlist export (Ticket 7)
  [ApiErrorCode.DAT_WANTLIST_BAD_FORMAT]: {
    status: 400,
    code: ApiErrorCode.DAT_WANTLIST_BAD_FORMAT,
    message: "format parameter must be one of: csv, md, fixdat",
  },
};

/**
 * Returns a NextResponse with the registered status code and error payload.
 * Response shape: { error: string, code: string }
 * The `code` field is machine-readable for future client-side error handling.
 */
export function apiError(errorCode: ApiErrorCode): NextResponse {
  const def = API_ERRORS[errorCode];
  return NextResponse.json(
    { error: def.message, code: def.code },
    { status: def.status }
  );
}

/**
 * Like apiError(), but overrides the human-readable message with a dynamic
 * string (e.g. "Invalid setting keys: screenscraper_foo").
 * The status and code still come from the registered definition.
 */
export function apiErrorWithDetail(
  errorCode: ApiErrorCode,
  detail: string
): NextResponse {
  const def = API_ERRORS[errorCode];
  return NextResponse.json(
    { error: detail, code: def.code },
    { status: def.status }
  );
}

/**
 * Converts an unknown catch value to a 500 Internal Server Error response.
 * Use in catch blocks as the final fallback.
 *
 * err.message is intentionally NOT forwarded to the HTTP response — it may
 * contain filesystem paths, Drizzle/SQLite internals, or OS error strings.
 * The full error is logged server-side for debugging.
 */
export function apiErrorFromUnknown(err: unknown): NextResponse {
  console.error("[apiErrorFromUnknown]", err);
  return NextResponse.json(
    { error: "Internal server error", code: ApiErrorCode.INTERNAL_ERROR },
    { status: 500 }
  );
}

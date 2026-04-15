/**
 * In-memory per-IP rate limiter for upload endpoints.
 *
 * LAN-only tool — no distributed state needed. Simple fixed-window style:
 * track a request count per IP per window. The Map is bounded by the max number
 * of concurrent clients (effectively 1 for a homelab) so there's no cleanup
 * budget concern.
 *
 * Usage:
 *   const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 5 });
 *   if (!limiter.check(ip)) return rateLimitedResponse();
 */

interface BucketEntry {
  count: number;
  windowStart: number;
}

interface RateLimiterOptions {
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Max requests allowed within the window. */
  maxRequests: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, BucketEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.maxRequests = options.maxRequests;
  }

  /**
   * Returns true if the request is allowed, false if rate-limited.
   * Increments the counter on every allowed call.
   */
  check(ip: string): boolean {
    const now = Date.now();
    const entry = this.buckets.get(ip);

    if (!entry || now - entry.windowStart >= this.windowMs) {
      // New window
      this.buckets.set(ip, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }
}

/**
 * Extract the client IP from a Next.js request.
 *
 * Prefers `x-real-ip` because that's set by our single trusted reverse proxy
 * (Nginx Proxy Manager) to the actual client IP, and unlike X-Forwarded-For
 * it is not spoofable by the client — any value sent in the request is
 * overwritten by NPM. X-Forwarded-For is accepted as a chain but we ignore
 * all hops except the one closest to the server (the last entry), which
 * came from the trusted proxy.
 *
 * Without a trusted-proxy allowlist, trusting the first X-Forwarded-For
 * value lets any HTTP client rotate IPs at will and bypass rate limiting.
 */
export function getClientIp(req: Request): string {
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    // Take the LAST hop — the one closest to our server, set by our proxy.
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "unknown";
}

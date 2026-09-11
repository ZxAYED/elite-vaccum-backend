/**
 * Known frontend origins (local dev + deployed), trusted in every environment.
 * Shared by the HTTP CORS policy (main.ts) and every Socket.IO gateway so a
 * WebSocket handshake is never left wide open (origin: '*') while still
 * accepting credentials - browsers reject that combination anyway, and it's
 * needlessly permissive even where they don't.
 */
export function getAllowedOrigins(): string[] {
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'https://elite-vaccum-frontend.vercel.app',
    ...(process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.trim()] : []),
  ];
}

/**
 * Origin-checking callback compatible with both Express `cors()` and
 * Socket.IO's `cors.origin` option.
 */
export function corsOriginCheck(
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) {
  if (!origin) return callback(null, true);
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = allowedOrigins.some((allowed) => origin.startsWith(allowed));
  if (isAllowed) {
    callback(null, true);
  } else {
    callback(new Error(`CORS origin '${origin}' not allowed by policy`));
  }
}

import { Transform } from 'class-transformer';

/**
 * Safely parses a JSON string or returns the value if already parsed.
 */
export function safeJsonParse<T = any>(value: any, defaultValue?: T): T {
  if (value === undefined || value === null || value === '') {
    return defaultValue as T;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value as T;
    }
  }
  return value as T;
}

/**
 * Class-transformer decorator to parse stringified JSON field in DTOs (useful for multipart form-data).
 */
export function TransformJsonField() {
  return Transform(({ value }) => safeJsonParse(value));
}

/**
 * Extracts payload object when payload may be passed as stringified JSON in `body.data` or as root fields.
 */
export function extractMultipartJsonPayload<T = Record<string, any>>(
  body: any,
): T {
  if (!body) return {} as T;
  if (typeof body.data === 'string') {
    try {
      const parsed = JSON.parse(body.data);
      const { data: _, ...rest } = body;
      return { ...parsed, ...rest } as T;
    } catch {
      // Return as is if parsing fails
    }
  }
  return body as T;
}

import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Normalizes product name into an uppercase SKU prefix token.
 * E.g., "Elite Vacuum Cleaner Pro" -> "ELITE-VACUUM-CLEANER"
 */
export function formatSkuBase(name: string): string {
  const words = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '')
    .split(/[\s-]+/)
    .filter(Boolean);

  if (words.length === 0) return 'PROD';

  const prefix = words.slice(0, 3).join('-').slice(0, 20);
  return prefix || 'PROD';
}

/**
 * Generates an unambiguous random alphanumeric string.
 */
export function generateRandomCode(length = 4): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Synchronous candidate SKU generator.
 */
export function generateCandidateSku(
  productName: string,
  prefix = 'SKU',
): string {
  const base = formatSkuBase(productName);
  const randomSuffix = generateRandomCode(4);
  return `${prefix}-${base}-${randomSuffix}`;
}

/**
 * Guaranteed unique SKU generator checking against database collisions.
 */
export async function generateUniqueProductSku(
  prisma: PrismaService,
  productName: string,
  prefix = 'SKU',
  maxAttempts = 10,
): Promise<string> {
  const base = formatSkuBase(productName);
  for (let i = 0; i < maxAttempts; i++) {
    const randomSuffix = generateRandomCode(4);
    const candidateSku = `${prefix}-${base}-${randomSuffix}`;
    const existing = await prisma.product.findUnique({
      where: { sku: candidateSku },
      select: { id: true },
    });
    if (!existing) {
      return candidateSku;
    }
  }
  return `${prefix}-${base}-${Date.now().toString(36).toUpperCase()}`;
}

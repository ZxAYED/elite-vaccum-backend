/**
 * Standardized Business ID Generator utility.
 * Formats: <PREFIX>-YYYYMMDD-XXXXX (e.g. ORD-20260822-54912, INV-20260822-10823)
 */
export type BusinessIdPrefix = 'ORD' | 'INV' | 'SRV' | 'PAY' | 'RET' | string;

export async function generateBusinessId(
  prefix: BusinessIdPrefix,
  checkExists: (candidateId: string) => Promise<boolean>,
): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  
  for (let i = 0; i < 10; i++) {
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const candidate = `${prefix}-${dateStr}-${randomSuffix}`;
    const exists = await checkExists(candidate);
    if (!exists) return candidate;
  }

  // Fallback with timestamp slice
  return `${prefix}-${dateStr}-${Date.now().toString().slice(-6)}`;
}

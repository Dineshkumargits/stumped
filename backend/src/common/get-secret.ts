import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Securely resolves the JWT secret following the multi-tiered fallback strategy:
 * 1. Environment variable (production)
 * 2. Local file (development)
 * 3. Ephemeral random generation (last resort, with warning)
 *
 * MUST NOT hardcode secrets or use literal fallback values.
 */
export function getJwtSecret(): string {
  // Tier 1: Environment variable
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }

  // Tier 2: Local file
  const secretFilePath = path.resolve(process.cwd(), 'jwt_secret.txt');
  try {
    if (fs.existsSync(secretFilePath)) {
      const fileSecret = fs.readFileSync(secretFilePath, 'utf-8').trim();
      if (fileSecret.length >= 32) {
        return fileSecret;
      }
    }
  } catch {
    // File read failed, fall through to generation
  }

  // Tier 3: Generate ephemeral secret with warning
  console.warn(
    '[SECURITY WARNING] Generating ephemeral JWT secret. ' +
    'Sessions will not persist across server restarts. ' +
    'Set JWT_SECRET environment variable for production use.',
  );
  return crypto.randomBytes(32).toString('hex');
}

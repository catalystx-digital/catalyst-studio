import { scrypt as scryptCallback, randomBytes, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keyLength: KEY_LENGTH,
};

export type PasswordParams = typeof SCRYPT_PARAMS & {
  algorithm: 'scrypt';
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function scrypt(password: string, salt: string, keyLength: number, options: { N: number; r: number; p: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Buffer.from(derivedKey));
    });
  });
}

export async function hashPassword(password: string): Promise<{
  passwordHash: string;
  passwordSalt: string;
  passwordParams: PasswordParams;
}> {
  const passwordSalt = randomBytes(16).toString('base64url');
  const derived = await scrypt(password, passwordSalt, KEY_LENGTH, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });

  return {
    passwordHash: derived.toString('base64url'),
    passwordSalt,
    passwordParams: { ...SCRYPT_PARAMS, algorithm: 'scrypt' },
  };
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
  passwordSalt: string,
  params: Partial<PasswordParams> | null | undefined,
): Promise<boolean> {
  const keyLength = params?.keyLength ?? KEY_LENGTH;
  const derived = await scrypt(password, passwordSalt, keyLength, {
    N: params?.N ?? SCRYPT_PARAMS.N,
    r: params?.r ?? SCRYPT_PARAMS.r,
    p: params?.p ?? SCRYPT_PARAMS.p,
  });
  const expected = Buffer.from(passwordHash, 'base64url');

  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}

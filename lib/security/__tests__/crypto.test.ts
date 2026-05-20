import { decrypt, encrypt, resetCryptoState, DecryptionFailedError } from "../crypto";

const TEST_KEY = Buffer.alloc(32, 21).toString("base64");

function setDefaultEnv(): void {
  process.env.STUDIO_ENCRYPTION_MODE = "enabled";
  process.env.STUDIO_ENCRYPTION_KEY_ID = "test-key";
  process.env.STUDIO_ENCRYPTION_KEY = TEST_KEY;
}

describe("crypto", () => {
  beforeEach(() => {
    setDefaultEnv();
    resetCryptoState();
  });

  afterEach(() => {
    delete process.env.STUDIO_ENCRYPTION_MODE;
    delete process.env.STUDIO_ENCRYPTION_KEY_ID;
    delete process.env.STUDIO_ENCRYPTION_KEY;
    resetCryptoState();
  });

  it("round-trips encryption and decryption", () => {
    const plaintext = "super-secret-value";

    const encrypted = encrypt(plaintext);

    expect(encrypted.isEncrypted).toBe(true);
    expect(encrypted.ciphertext.equals(Buffer.from(plaintext))).toBe(false);

    const decrypted = decrypt({
      ciphertext: encrypted.ciphertext,
      keyId: encrypted.keyId,
      algorithm: encrypted.algorithm,
    });

    expect(decrypted.toString("utf8")).toBe(plaintext);
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encrypt("super-secret-value");
    const tampered = Buffer.from(encrypted.ciphertext);
    tampered[5] = tampered[5] ^ 0xff;

    expect(() =>
      decrypt({
        ciphertext: tampered,
        keyId: encrypted.keyId,
        algorithm: encrypted.algorithm,
      })
    ).toThrow(DecryptionFailedError);
  });
});

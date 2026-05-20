import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

export function loadPlaywrightEnv() {
  const envFiles: Array<{ file: string; override: boolean }> = [
    { file: '.env', override: false },
    { file: '.env.local', override: true },
  ];

  for (const { file, override } of envFiles) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath, override });
    }
  }
}

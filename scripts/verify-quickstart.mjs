import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const databasePort = process.env.CATALYST_STUDIO_DB_PORT || '5432';
const databaseUrl = `postgresql://postgres:postgres@localhost:${databasePort}/catalyst_studio`;
const appUrl = 'http://127.0.0.1:3100';
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  NEXT_PUBLIC_APP_URL: appUrl,
  AUTH_SECRET: process.env.AUTH_SECRET || 'quickstart-smoke-test-secret',
  STUDIO_DISABLE_WORKFLOW_PLUGIN: 'true',
  SKIP_DB_SETUP: 'true',
  PORT: '3100',
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const resolved = resolveSpawn(command, args);
    const child = spawn(resolved.command, resolved.args, {
      stdio: options.stdio ?? 'inherit',
      env,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
      }
    });
  });
}

function start(command, args, options = {}) {
  const resolved = resolveSpawn(command, args);
  return spawn(resolved.command, resolved.args, {
    stdio: options.stdio ?? 'pipe',
    env,
    ...options,
  });
}

function resolveSpawn(command, args) {
  if (process.platform === 'win32' && (command === 'npm' || command === 'npx')) {
    return { command: 'cmd.exe', args: ['/d', '/s', '/c', command, ...args] };
  }

  return { command: resolveCommand(command), args };
}

function resolveCommand(command) {
  if (process.platform !== 'win32') {
    return command;
  }

  if (command === 'npm' || command === 'npx') {
    return `${command}.cmd`;
  }

  return command;
}

async function assertDockerAvailable() {
  try {
    await run('docker', ['--version'], { stdio: 'pipe' });
    await run('docker', ['compose', 'version'], { stdio: 'pipe' });
    return;
  } catch {
    throw new Error('Docker with Compose v2 is required to verify the quickstart, but docker is not available.');
  }
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const ready = await new Promise((resolve) => {
      const child = spawn(
        resolveCommand('docker'),
        ['compose', 'exec', '-T', 'postgres', 'pg_isready', '-U', 'postgres', '-d', 'catalyst_studio'],
        { stdio: 'pipe', env },
      );
      child.on('error', () => resolve(false));
      child.on('exit', (code) => resolve(code === 0));
    });

    if (ready) {
      return;
    }

    await delay(2000);
  }

  throw new Error('PostgreSQL did not become healthy through docker compose.');
}

async function waitForApp(child) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`dev server exited early with ${child.exitCode}`);
    }

    try {
      const response = await fetch(`${appUrl}/sign-in`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until Next.js is ready.
    }

    await delay(2000);
  }

  throw new Error(`App did not become ready at ${appUrl}`);
}

async function verifySeededLogin() {
  const response = await fetch(`${appUrl}/api/auth/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'seed@example.com', password: 'SeedUser!234' }),
  });

  if (!response.ok) {
    throw new Error(`Seeded sign-in failed with HTTP ${response.status}: ${await response.text()}`);
  }

  const cookie = response.headers.get('set-cookie');
  if (!cookie?.includes('cs_session=')) {
    throw new Error('Seeded sign-in did not return a cs_session cookie.');
  }

  const page = await fetch(`${appUrl}/studio/site-builder?websiteId=test-website`, {
    headers: { cookie },
    redirect: 'manual',
  });

  if (page.status !== 200) {
    throw new Error(`Site builder route smoke check failed with HTTP ${page.status}.`);
  }

  const html = await page.text();
  if (!html.includes('Site Builder')) {
    throw new Error('Site builder route did not render the expected page.');
  }
}

async function main() {
  console.log('Verifying Docker quickstart path...');
  await assertDockerAvailable();
  let server = null;
  try {
    await run('docker', ['compose', 'up', '-d', 'postgres']);
    await waitForPostgres();
    await run('npm', ['run', 'db:migrate:deploy']);
    await run('npm', ['run', 'db:seed']);

    server = start('npm', ['run', 'dev']);
    await waitForApp(server);
    await verifySeededLogin();
    console.log('Quickstart smoke test passed.');
  } finally {
    if (server && server.exitCode === null) {
      server.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
    }
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

import { spawn } from 'node:child_process';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const isWindows = process.platform === 'win32';
const databaseHost = process.env.CATALYST_STUDIO_DB_HOST || '127.0.0.1';
const databasePort = process.env.CATALYST_STUDIO_DB_PORT || '5432';
const databaseUrl = `postgresql://postgres:postgres@${databaseHost}:${databasePort}/catalyst_studio`;
const appPort = process.env.CATALYST_STUDIO_APP_PORT || '3100';
const appUrl = `http://127.0.0.1:${appPort}`;
const defaultCommandTimeoutMs = Number(process.env.CATALYST_STUDIO_QUICKSTART_COMMAND_TIMEOUT_MS || 300000);
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  DIRECT_URL: databaseUrl,
  NEXT_PUBLIC_APP_URL: appUrl,
  AUTH_SECRET: process.env.AUTH_SECRET || 'quickstart-smoke-test-secret',
  STUDIO_DISABLE_WORKFLOW_PLUGIN: 'true',
  SKIP_DB_SETUP: 'true',
  PORT: appPort,
};

let activeServer = null;
let activeCommand = null;
let composeStarted = false;
let hadExistingComposePostgres = false;
let cleanupPromise = null;

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      allowFailure = false,
      killOnTimeout = true,
      stdio = 'inherit',
      timeoutMs = defaultCommandTimeoutMs,
      track = true,
      ...spawnOptions
    } = options;
    const resolved = resolveSpawn(command, args);
    const child = spawn(resolved.command, resolved.args, {
      detached: !isWindows,
      stdio,
      env,
      ...spawnOptions,
    });
    const label = `${command} ${args.join(' ')}`;
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let timeout = null;
    let killTimeout = null;

    if (track) {
      activeCommand = child;
    }

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
    }

    function finish(callback, value) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      clearTimeout(killTimeout);

      if (activeCommand === child) {
        activeCommand = null;
      }

      callback(value);
    }

    if (timeoutMs > 0) {
      timeout = setTimeout(() => {
        timedOut = true;

        if (killOnTimeout) {
          stopProcessTree(child).catch(() => undefined);
        }

        killTimeout = setTimeout(() => {
          finish(reject, new Error(`${label} timed out after ${timeoutMs}ms and did not exit.`));
        }, 15000);
      }, timeoutMs);
    }

    child.on('error', (error) => finish(reject, error));
    child.on('exit', (code, signal) => {
      if (timedOut) {
        finish(reject, new Error(`${label} timed out after ${timeoutMs}ms.`));
        return;
      }

      if (code === 0 || allowFailure) {
        finish(resolve, { code, signal, stdout, stderr });
      } else {
        finish(reject, new Error(`${label} exited with ${code}`));
      }
    });
  });
}

function start(command, args, options = {}) {
  const { stdio = 'inherit', ...spawnOptions } = options;
  const resolved = resolveSpawn(command, args);
  return spawn(resolved.command, resolved.args, {
    detached: !isWindows,
    stdio,
    env,
    ...spawnOptions,
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

function waitForExit(child, timeoutMs) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.off('close', onClose);
      reject(new Error(`Process ${child.pid} did not exit within ${timeoutMs}ms`));
    }, timeoutMs);

    function onClose() {
      clearTimeout(timeout);
      resolve();
    }

    child.once('close', onClose);
  });
}

async function stopProcessTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (isWindows) {
    await run('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      allowFailure: true,
      killOnTimeout: false,
      stdio: 'pipe',
      timeoutMs: 30000,
      track: false,
    });
    await waitForExit(child, 5000).catch(() => undefined);
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      return;
    }
  }

  try {
    await waitForExit(child, 8000);
    return;
  } catch {
    // Escalate below.
  }

  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      return;
    }
  }

  await waitForExit(child, 5000).catch(() => undefined);
}

async function cleanup() {
  if (cleanupPromise) {
    return cleanupPromise;
  }

  cleanupPromise = (async () => {
    await stopProcessTree(activeCommand);
    await stopProcessTree(activeServer);

    if (composeStarted && !hadExistingComposePostgres) {
      await run('docker', ['compose', 'down', '--remove-orphans'], {
        allowFailure: true,
        timeoutMs: 60000,
        track: false,
      });
    }
  })();

  return cleanupPromise;
}

function installShutdownHandlers() {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      cleanup()
        .catch((error) => {
          console.error(error.stack || error.message);
        })
        .finally(() => {
          process.exit(signal === 'SIGINT' ? 130 : 143);
        });
    });
  }

  process.once('uncaughtException', (error) => {
    console.error(error.stack || error.message);
    cleanup().finally(() => process.exit(1));
  });

  process.once('unhandledRejection', (reason) => {
    console.error(reason instanceof Error ? reason.stack || reason.message : reason);
    cleanup().finally(() => process.exit(1));
  });
}

async function assertDockerAvailable() {
  try {
    await run('docker', ['--version'], { stdio: 'pipe', timeoutMs: 30000 });
    await run('docker', ['compose', 'version'], { stdio: 'pipe', timeoutMs: 30000 });
    return;
  } catch {
    throw new Error('Docker with Compose v2 is required to verify the quickstart, but docker is not available.');
  }
}

async function assertPortAvailable(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use. Stop the existing process or set CATALYST_STUDIO_APP_PORT.`));
        return;
      }

      reject(error);
    });

    server.once('listening', () => {
      server.close(resolve);
    });

    server.listen(Number(port), '127.0.0.1');
  });
}

async function hasExistingComposePostgres() {
  const result = await run('docker', ['compose', 'ps', '-a', '-q', 'postgres'], {
    allowFailure: true,
    stdio: 'pipe',
    timeoutMs: 30000,
  });

  return result.stdout.trim().length > 0;
}

async function waitForPostgres() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const result = await run('docker', ['compose', 'exec', '-T', 'postgres', 'pg_isready', '-U', 'postgres', '-d', 'catalyst_studio'], {
      allowFailure: true,
      stdio: 'pipe',
      timeoutMs: 30000,
    });

    if (result.code === 0) {
      return;
    }

    await delay(2000);
  }

  throw new Error('PostgreSQL did not become healthy through docker compose.');
}

async function waitForApp(child) {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`dev server exited early with code ${child.exitCode} and signal ${child.signalCode}`);
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
  installShutdownHandlers();
  await assertPortAvailable(appPort);
  await assertDockerAvailable();
  try {
    hadExistingComposePostgres = await hasExistingComposePostgres();
    await run('docker', ['compose', 'up', '-d', 'postgres'], { timeoutMs: 120000 });
    composeStarted = true;
    await waitForPostgres();
    await run('npm', ['run', 'db:migrate:deploy'], { timeoutMs: 120000 });
    await run('npm', ['run', 'db:seed'], { timeoutMs: 120000 });

    activeServer = start('npm', ['run', 'dev']);
    await waitForApp(activeServer);
    await verifySeededLogin();
    console.log('Quickstart smoke test passed.');
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

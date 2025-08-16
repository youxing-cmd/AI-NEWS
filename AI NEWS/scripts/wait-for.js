/**
 * 简易等待脚本：等待 Postgres 与 Redis 可连接
 * 支持从环境变量解析：DATABASE_URL, REDIS_URL
 */
const net = require('net');
const { URL } = require('url');

function parseHostPort(urlStr, defHost, defPort) {
  if (!urlStr) return { host: defHost, port: defPort };
  try {
    const u = new URL(urlStr);
    const host = u.hostname || defHost;
    const port = Number(u.port || defPort);
    return { host, port };
  } catch {
    return { host: defHost, port: defPort };
  }
}

function waitPort({ host, port, name }, timeoutMs = 60000, intervalMs = 1500) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const sock = net.createConnection({ host, port });
      let done = false;
      sock.on('connect', () => {
        done = true;
        sock.end();
        console.log(`[wait-for] ${name} ${host}:${port} is up`);
        resolve();
      });
      sock.on('error', () => {
        if (done) return;
        sock.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`[wait-for] timeout waiting for ${name} ${host}:${port}`));
        } else {
          console.log(`[wait-for] waiting ${name} ${host}:${port} ...`);
          setTimeout(tryConnect, intervalMs);
        }
      });
    };
    tryConnect();
  });
}

(async () => {
  const { host: pgHost, port: pgPort } = parseHostPort(process.env.DATABASE_URL, 'db', 5432);
  const { host: rHost, port: rPort } = parseHostPort(process.env.REDIS_URL, 'redis', 6379);

  try {
    await waitPort({ host: pgHost, port: pgPort, name: 'Postgres' });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  try {
    await waitPort({ host: rHost, port: rPort, name: 'Redis' });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
})();
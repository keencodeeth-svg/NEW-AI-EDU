import net from "node:net";

function isRetryablePortError(error) {
  return error?.code === "EADDRINUSE" || error?.code === "EACCES";
}

function listenOnce({ port, host }) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();

    server.once("error", (error) => {
      server.close(() => reject(error));
    });

    server.listen({ port, host }, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to resolve API test runtime port.")));
        return;
      }
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

export async function resolveApiTestPort(options = {}) {
  const host = options.host ?? "127.0.0.1";
  const preferredPort = Number(options.preferredPort ?? 3210);
  const explicitPort = options.explicitPort === true;
  const isRemote = options.isRemote === true;

  if (isRemote) {
    return preferredPort;
  }

  if (preferredPort === 0) {
    return listenOnce({ port: 0, host });
  }

  try {
    return await listenOnce({ port: preferredPort, host });
  } catch (error) {
    if (!isRetryablePortError(error)) {
      throw error;
    }
    if (explicitPort) {
      throw new Error(
        `API_TEST_PORT=${preferredPort} is already in use on ${host}. Stop the conflicting process or choose a different API_TEST_PORT.`
      );
    }
    return listenOnce({ port: 0, host });
  }
}

import { open } from "node:fs/promises";
import net from "node:net";

const TRANSPORT = {
  NETWORK: "network",
  USB: "usb",
};

const DEFAULT_PORT = 9100;

const REFUSED_FILE_NAMES = new Set([
  "requirements.txt",
  "cmakelists.txt",
  "readme.sh",
]);

const HOST_LABEL = /^(?:[a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/i;

export async function sendBytes(input, io = {}) {
  const openFile = io.openFile ?? open;
  const connect = io.connect ?? connectTcp;

  if (input?.transport === TRANSPORT.USB) {
    refuseUsbPath(input.path);
    await writeUsb(openFile, input.path, readBytes(input.bytes));
    return;
  }

  if (input?.transport === TRANSPORT.NETWORK) {
    const host = refuseUnlessHost(input.host);
    const port = refuseUnlessPort(input.port);
    await writeTcp(connect, host, port, readBytes(input.bytes));
    return;
  }

  throw new Error('Refused transport: expected "network" or "usb"');
}

function connectTcp(options) {
  return net.connect(options);
}

function refuseUsbPath(filePath) {
  if (typeof filePath !== "string" || filePath.trim() === "") {
    throw new Error("Refused USB path: path is required");
  }

  const name = fileName(filePath).toLowerCase();
  const markdown = name.endsWith(".md") || name.endsWith(".mdx");

  if (REFUSED_FILE_NAMES.has(name) || markdown) {
    throw new Error(`Refused USB path: ${filePath}`);
  }
}

function fileName(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  const slash = normalized.lastIndexOf("/");

  if (slash === -1) {
    return normalized;
  }

  return normalized.slice(slash + 1);
}

function refuseUnlessHost(host) {
  if (typeof host !== "string" || !isHost(host)) {
    throw new Error("Refused host: expected a hostname or IPv4");
  }

  return host;
}

function isHost(host) {
  if (host.length === 0 || host.length > 253) {
    return false;
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    return isIpv4(host);
  }

  return host.split(".").every((label) => HOST_LABEL.test(label));
}

function isIpv4(host) {
  return host.split(".").every((part) => {
    if (!/^(?:0|[1-9]\d{0,2})$/.test(part)) {
      return false;
    }

    return Number(part) <= 255;
  });
}

function refuseUnlessPort(port) {
  if (port === undefined) {
    return DEFAULT_PORT;
  }

  if (isPortNumber(port)) {
    return port;
  }

  if (typeof port === "string" && /^[1-9]\d{0,4}$/.test(port)) {
    const value = Number(port);
    if (value <= 65535) {
      return value;
    }
  }

  throw new Error("Refused port: expected a numeric port");
}

function isPortNumber(port) {
  return (
    typeof port === "number" &&
    Number.isInteger(port) &&
    port >= 1 &&
    port <= 65535
  );
}

function readBytes(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error("Refused bytes: expected a Uint8Array");
  }

  return bytes;
}

async function writeUsb(openFile, filePath, bytes) {
  const handle = await openFile(filePath, "w");

  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
}

function writeTcp(connect, host, port, bytes) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (error) => {
      if (settled) {
        return;
      }

      settled = true;

      if (error) {
        reject(error);
        return;
      }

      resolve();
    };

    const socket = connect({ host, port });

    socket.once("error", (error) => {
      socket.destroy();
      finish(error instanceof Error ? error : new Error("socket failed"));
    });

    socket.once("connect", () => {
      socket.end(bytes, () => {
        finish();
      });
    });
  });
}

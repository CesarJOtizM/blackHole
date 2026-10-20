import { EventEmitter } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";

import { sendBytes } from "#send-bytes";

const TRANSPORT = {
  NETWORK: "network",
  USB: "usb",
} as const;

const DEFAULT_PORT = 9100;

const SAMPLE_BYTES = Uint8Array.of(
  0x1b,
  0x40,
  0x54,
  0x1b,
  0x70,
  0x00,
  0x19,
  0xfa,
);

interface TcpEndpoint {
  host: string;
  port: number;
}

type OpenFile = (filePath: string, flags: string) => Promise<unknown>;

type Connect = (options: TcpEndpoint) => ByteSocket;

interface ByteSocket {
  destroy: () => void;
  end: (data: Uint8Array, callback?: () => void) => void;
  once: (event: string, listener: (error?: Error) => void) => void;
}

interface TransportIo {
  connect: Connect;
  openFile: OpenFile;
}

it("given requirements.txt, when sendBytes runs, then it refuses before fs.open, spawns nothing, and leaves the report unchanged", async () => {
  await expectRefusedUsbFile("requirements.txt");
});

it("given CMakeLists.txt, when sendBytes runs, then it refuses before fs.open, spawns nothing, and leaves the report unchanged", async () => {
  await expectRefusedUsbFile("CMakeLists.txt");
});

it("given a markdown path, when sendBytes runs, then it refuses before fs.open, spawns nothing, and leaves the report unchanged", async () => {
  await expectRefusedUsbFile("notes.md");
});

it("given an mdx path, when sendBytes runs, then it refuses before fs.open, spawns nothing, and leaves the report unchanged", async () => {
  await expectRefusedUsbFile("guide.mdx");
});

it("given README.sh, when sendBytes runs, then it refuses before fs.open, spawns nothing, and leaves the report unchanged", async () => {
  await expectRefusedUsbFile("README.sh");
});

it("given a host that is not a hostname or IPv4, when sendBytes runs, then it refuses before connect and leaves the report unchanged", async () => {
  const reportBefore = readReport();
  const hosts = [
    "not a host",
    "http://10.0.0.5",
    "256.1.1.1",
    "::1",
    "",
    "printer:9100",
  ];

  for (const host of hosts) {
    const io = recordingIo();

    await expect(
      sendBytes(
        {
          transport: TRANSPORT.NETWORK,
          host,
          port: DEFAULT_PORT,
          bytes: SAMPLE_BYTES,
        },
        io,
      ),
    ).rejects.toThrow(/refused host/i);

    expect(io.connect).not.toHaveBeenCalled();
    expect(io.openFile).not.toHaveBeenCalled();
  }

  await expect(
    sendBytes({
      transport: TRANSPORT.NETWORK,
      host: "not a host",
      port: DEFAULT_PORT,
      bytes: SAMPLE_BYTES,
    }),
  ).rejects.toThrow(/refused host/i);

  expect(readReport()).toEqual(reportBefore);
  expect(moduleSource()).not.toContain("child_process");
});

it("given a non-numeric port, when sendBytes runs, then it refuses before connect and leaves the report unchanged", async () => {
  const reportBefore = readReport();
  const ports = ["9100abc", "abc", "", 9100.5, Number.NaN, null];

  for (const port of ports) {
    const io = recordingIo();

    await expect(
      sendBytes(
        {
          transport: TRANSPORT.NETWORK,
          host: "127.0.0.1",
          port,
          bytes: SAMPLE_BYTES,
        },
        io,
      ),
    ).rejects.toThrow(/refused port/i);

    expect(io.connect).not.toHaveBeenCalled();
    expect(io.openFile).not.toHaveBeenCalled();
  }

  expect(readReport()).toEqual(reportBefore);
  expect(moduleSource()).not.toContain("child_process");
});

it("given a hostname and no port, when sendBytes runs, then it connects on port 9100", async () => {
  const connect = vi.fn<Connect>(() => acceptingSocket());
  const openFile = vi.fn<OpenFile>();

  await sendBytes(
    {
      transport: TRANSPORT.NETWORK,
      host: "printer.local",
      bytes: SAMPLE_BYTES,
    },
    { connect, openFile },
  );

  expect(openFile).not.toHaveBeenCalled();
  expect(connect).toHaveBeenCalledTimes(1);
  expect(connect.mock.calls[0]?.[0]).toEqual({
    host: "printer.local",
    port: DEFAULT_PORT,
  });
});

it("given an allowed usb path, when sendBytes runs, then the file contains the same bytes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "escpos-"));
  const usbPath = path.join(directory, "ticket.bin");

  try {
    await sendBytes({
      transport: TRANSPORT.USB,
      path: usbPath,
      bytes: SAMPLE_BYTES,
    });

    expect(readFileSync(usbPath)).toEqual(Buffer.from(SAMPLE_BYTES));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("given a local ipv4 port, when sendBytes runs, then the socket receives the same bytes", async () => {
  const server = net.createServer();
  const received = new Promise<Buffer>((resolve, reject) => {
    server.once("connection", (socket) => {
      const chunks: Buffer[] = [];
      socket.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });
      socket.on("error", reject);
      socket.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });

  const address = server.address();
  if (!isAddress(address)) {
    throw new Error("expected a tcp port");
  }

  try {
    await sendBytes({
      transport: TRANSPORT.NETWORK,
      host: "127.0.0.1",
      port: address.port,
      bytes: SAMPLE_BYTES,
    });

    expect(await received).toEqual(Buffer.from(SAMPLE_BYTES));
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

async function expectRefusedUsbFile(fileName: string): Promise<void> {
  const directory = await mkdtemp(path.join(tmpdir(), "escpos-"));
  const usbPath = path.join(directory, fileName);
  const reportBefore = readReport();
  const io = recordingIo();

  try {
    await expect(
      sendBytes(
        {
          transport: TRANSPORT.USB,
          path: usbPath,
          bytes: SAMPLE_BYTES,
        },
        io,
      ),
    ).rejects.toThrow(/refused/i);

    await expect(
      sendBytes({
        transport: TRANSPORT.USB,
        path: usbPath,
        bytes: SAMPLE_BYTES,
      }),
    ).rejects.toThrow(/refused/i);

    expect(io.openFile).not.toHaveBeenCalled();
    expect(io.connect).not.toHaveBeenCalled();
    expect(existsSync(usbPath)).toBe(false);
    expect(readReport()).toEqual(reportBefore);
    expect(moduleSource()).not.toContain("child_process");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function recordingIo(): TransportIo & {
  connect: ReturnType<typeof vi.fn<Connect>>;
  openFile: ReturnType<typeof vi.fn<OpenFile>>;
} {
  return {
    openFile: vi.fn<OpenFile>(() => {
      throw new Error("fs.open was called");
    }),
    connect: vi.fn<Connect>(() => {
      throw new Error("net.connect was called");
    }),
  };
}

function acceptingSocket(): ByteSocket {
  const emitter = new EventEmitter();
  const socket: ByteSocket = {
    destroy: () => undefined,
    end: (_data, callback) => {
      callback?.();
    },
    once: (event, listener) => {
      emitter.once(event, listener);
    },
  };

  queueMicrotask(() => {
    emitter.emit("connect");
  });

  return socket;
}

function readReport(): Buffer {
  return readFileSync(fileURLToPath(import.meta.resolve("#report-example")));
}

function moduleSource(): string {
  return readFileSync(
    fileURLToPath(import.meta.resolve("#send-bytes")),
    "utf8",
  );
}

function isAddress(
  address: string | AddressInfo | null,
): address is AddressInfo {
  return address !== null && typeof address !== "string";
}

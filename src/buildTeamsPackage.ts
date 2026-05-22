import fs from "fs";
import path from "path";
import zlib from "zlib";
import dotenv from "dotenv";

dotenv.config();

const outputDir = path.resolve("dist", "teams-app");
const packagePath = path.join(outputDir, "SprintOpsTeamsAgent.zip");

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function assertGuid(name: string, value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    throw new Error(`${name} must be a GUID. Received: ${value}`);
  }
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function roundedRect(
  x: number,
  y: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number
) {
  const cx =
    x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const cy =
    y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
  return (
    x >= left &&
    x <= right &&
    y >= top &&
    y <= bottom &&
    (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
  );
}

function createPng(
  width: number,
  height: number,
  pixel: (x: number, y: number) => [number, number, number, number]
) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
      offset += 4;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createColorIcon() {
  return createPng(192, 192, (x, y) => {
    const nx = (x / 192) * 32;
    const ny = (y / 192) * 32;
    const card = roundedRect(nx, ny, 7, 6, 25, 24, 3);
    const topLine = roundedRect(nx, ny, 10, 10, 22, 12, 1);
    const midLine = roundedRect(nx, ny, 10, 15, 19, 17, 1);
    const dot = (nx - 22) ** 2 + (ny - 16) ** 2 <= 2.2 ** 2;

    if (card && (topLine || midLine || dot)) return [98, 100, 167, 255];
    if (card) return [255, 255, 255, 255];
    return [70, 78, 184, 255];
  });
}

function createOutlineIcon() {
  return createPng(32, 32, (x, y) => {
    const outer = roundedRect(x, y, 6, 5, 26, 25, 3);
    const inner = roundedRect(x, y, 9, 8, 23, 22, 2);
    const lineOne = roundedRect(x, y, 11, 11, 21, 13, 1);
    const lineTwo = roundedRect(x, y, 11, 16, 18, 18, 1);
    const dot = (x - 22) ** 2 + (y - 17) ** 2 <= 2 ** 2;

    if ((outer && !inner) || lineOne || lineTwo || dot) {
      return [255, 255, 255, 255];
    }

    return [255, 255, 255, 0];
  });
}

function zipDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980);
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function createZip(entries: Array<{ name: string; data: Buffer }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { dosDate, dosTime } = zipDateTime();

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf-8");
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, name, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);

    centralParts.push(central, name);
    offset += local.length + name.length + entry.data.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const localDir = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(localDir.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localDir, centralDir, end]);
}

function manifest(appId: string, botId: string) {
  return {
    $schema: "https://developer.microsoft.com/en-us/json-schemas/teams/v1.17/MicrosoftTeams.schema.json",
    manifestVersion: "1.17",
    version: "1.0.0",
    id: appId,
    packageName: "com.codelicious.sprintops",
    developer: {
      name: "Codelicious",
      websiteUrl: "https://example.com",
      privacyUrl: "https://example.com/privacy",
      termsOfUseUrl: "https://example.com/terms",
    },
    icons: {
      color: "color.png",
      outline: "outline.png",
    },
    name: {
      short: "SprintOps",
      full: "SprintOps Teams Agent",
    },
    description: {
      short: "Posts Azure DevOps due-today notifications.",
      full: "SprintOps posts Azure DevOps work items due today and not in QA as Teams cards in group chats, channels, or personal chats.",
    },
    accentColor: "#464EB8",
    bots: [
      {
        botId,
        scopes: ["personal", "groupChat", "team"],
        isNotificationOnly: false,
        supportsFiles: false,
        commandLists: [
          {
            scopes: ["personal", "groupChat", "team"],
            commands: [
              {
                title: "subscribe",
                description: "Save this conversation for proactive due-today posts",
              },
              {
                title: "due today",
                description: "Show Azure DevOps tickets due today and not in QA",
              },
              {
                title: "post due today",
                description: "Post the due-today Teams card in this conversation",
              },
            ],
          },
        ],
      },
    ],
    permissions: ["identity"],
    validDomains: [],
  };
}

async function main() {
  const botId = requiredEnv("MICROSOFT_APP_ID");
  const appId = process.env.TEAMS_APP_ID?.trim() || botId;
  assertGuid("MICROSOFT_APP_ID", botId);
  assertGuid("TEAMS_APP_ID", appId);

  fs.mkdirSync(outputDir, { recursive: true });

  const entries = [
    {
      name: "manifest.json",
      data: Buffer.from(JSON.stringify(manifest(appId, botId), null, 2), "utf-8"),
    },
    { name: "color.png", data: createColorIcon() },
    { name: "outline.png", data: createOutlineIcon() },
  ];

  fs.writeFileSync(packagePath, createZip(entries));
  for (const entry of entries) {
    fs.writeFileSync(path.join(outputDir, entry.name), entry.data);
  }

  console.log(`Teams app package created: ${packagePath}`);
  console.log("Upload this zip in Microsoft Teams to install the bot in a group chat.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

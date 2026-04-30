#!/usr/bin/env node
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function usage() {
  return [
    "usage:",
    "  node scripts/drive-upload.mjs ensure-folder --parent <folder-id> --name <folder-name>",
    "  node scripts/drive-upload.mjs upload --file <path> --parent <folder-id> --mime <mime-type> [--name <drive-name>]",
  ].join("\n");
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command) {
    throw new Error(usage());
  }
  const args = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}\n${usage()}`);
    }
    args[arg.slice(2)] = rest[++i];
  }
  return args;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function readSettingsEnv() {
  const [tracked, local] = await Promise.all([
    readJsonIfExists(path.join(ROOT, ".claude", "settings.json")),
    readJsonIfExists(path.join(ROOT, ".claude", "settings.local.json")),
  ]);
  const merged = {};
  for (const source of [process.env, tracked.env ?? {}, local.env ?? {}]) {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === "string" && value.includes("<")) {
        continue;
      }
      merged[key] = value;
    }
  }
  return merged;
}

function parseServiceAccount(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || trimmed.includes("<")) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_B64 is missing or still a placeholder");
  }
  if (trimmed.startsWith("{")) {
    return JSON.parse(trimmed);
  }
  const decoded = Buffer.from(trimmed.replace(/\s+/g, ""), "base64").toString("utf8");
  return JSON.parse(decoded);
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), serviceAccount.private_key);
  const assertion = `${unsigned}.${base64url(signature)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${json.error_description || json.error || ""}`);
  }
  return json.access_token;
}

async function driveFetch(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Drive API failed: ${res.status} ${await res.text()}`);
  }
  return res;
}

function escapeDriveQuery(value) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function ensureFolder(token, parentId, name) {
  if (!parentId || !name) {
    throw new Error("ensure-folder requires --parent and --name");
  }
  const q = [
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    `'${escapeDriveQuery(parentId)}' in parents`,
    `name = '${escapeDriveQuery(name)}'`,
  ].join(" and ");
  const searchUrl = new URL("https://www.googleapis.com/drive/v3/files");
  searchUrl.searchParams.set("q", q);
  searchUrl.searchParams.set("fields", "files(id,name,webViewLink)");
  searchUrl.searchParams.set("supportsAllDrives", "true");
  searchUrl.searchParams.set("includeItemsFromAllDrives", "true");
  const search = await (await driveFetch(token, searchUrl)).json();
  if (search.files?.[0]) {
    return { ...search.files[0], created: false };
  }

  const createUrl = new URL("https://www.googleapis.com/drive/v3/files");
  createUrl.searchParams.set("fields", "id,name,webViewLink");
  createUrl.searchParams.set("supportsAllDrives", "true");
  const created = await (
    await driveFetch(token, createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        name,
        parents: [parentId],
        mimeType: "application/vnd.google-apps.folder",
      }),
    })
  ).json();
  return { ...created, created: true };
}

async function uploadFile(token, filePath, parentId, mimeType, driveName) {
  if (!filePath || !parentId || !mimeType) {
    throw new Error("upload requires --file, --parent, and --mime");
  }
  const absoluteFile = path.resolve(filePath);
  const body = await readFile(absoluteFile);
  const name = driveName || path.basename(absoluteFile);
  const initUrl = new URL("https://www.googleapis.com/upload/drive/v3/files");
  initUrl.searchParams.set("uploadType", "resumable");
  initUrl.searchParams.set("supportsAllDrives", "true");
  initUrl.searchParams.set("fields", "id,name,size,webViewLink");

  const init = await driveFetch(token, initUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(body.length),
    },
    body: JSON.stringify({ name, parents: [parentId], mimeType }),
  });
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) {
    throw new Error("Drive resumable upload did not return a Location header");
  }

  const uploaded = await (
    await driveFetch(token, uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(body.length),
      },
      body,
    })
  ).json();
  return uploaded;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = await readSettingsEnv();
  const serviceAccount = parseServiceAccount(
    env.GOOGLE_SERVICE_ACCOUNT_JSON_B64 || env.GOOGLE_SERVICE_ACCOUNT_JSON,
  );
  const token = await getAccessToken(serviceAccount);

  if (args.command === "ensure-folder") {
    console.log(JSON.stringify(await ensureFolder(token, args.parent, args.name), null, 2));
    return;
  }
  if (args.command === "upload") {
    console.log(JSON.stringify(await uploadFile(token, args.file, args.parent, args.mime, args.name), null, 2));
    return;
  }
  throw new Error(`Unknown command: ${args.command}\n${usage()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

// Storage abstraction: uses local filesystem by default,
// falls back to Forge storage proxy if BUILT_IN_FORGE_API_URL is set.

import { ENV } from "./_core/env";
import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

function useForge(): boolean {
  return !!(ENV.forgeApiUrl && ENV.forgeApiKey);
}

// ─── Local filesystem storage ─────────────────────────────────────────────────

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function localPut(
  relKey: string,
  data: Buffer | Uint8Array | string
): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  const filePath = path.join(UPLOADS_DIR, key);
  ensureDir(filePath);
  fs.writeFileSync(filePath, typeof data === "string" ? data : Buffer.from(data));
  return { key, url: `/uploads/${key}` };
}

async function localGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const key = relKey.replace(/^\/+/, "");
  return { key, url: `/uploads/${key}` };
}

// ─── Forge proxy storage ──────────────────────────────────────────────────────

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

async function forgePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
  const apiKey = ENV.forgeApiKey;
  const key = normalizeKey(relKey);

  const uploadUrl = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  uploadUrl.searchParams.set("path", key);

  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, key.split("/").pop() ?? "file");

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: buildAuthHeaders(apiKey),
    body: form,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

async function forgeGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  const baseUrl = ENV.forgeApiUrl.replace(/\/+$/, "");
  const apiKey = ENV.forgeApiKey;
  const key = normalizeKey(relKey);

  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", key);
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  const url = (await response.json()).url;
  return { key, url };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (useForge()) {
    return forgePut(relKey, data, contentType);
  }
  return localPut(relKey, data);
}

export async function storageGet(
  relKey: string
): Promise<{ key: string; url: string }> {
  if (useForge()) {
    return forgeGet(relKey);
  }
  return localGet(relKey);
}

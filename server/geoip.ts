import type { Request } from "express";

const cache = new Map<string, string | null>();

const PRIVATE_IP_REGEX =
  /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|fe80:)/;

export function extractIp(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  let ip: string | undefined;

  if (typeof forwarded === "string") {
    ip = forwarded.split(",")[0].trim();
  } else {
    ip = req.socket?.remoteAddress;
  }

  if (!ip) return null;

  // Strip IPv4-mapped IPv6 prefix
  ip = ip.replace(/^::ffff:/, "");

  // Can't geolocate private/localhost IPs
  if (PRIVATE_IP_REGEX.test(ip)) return null;

  return ip;
}

export async function getCountryFromIp(ip: string): Promise<string | null> {
  if (cache.has(ip)) return cache.get(ip) ?? null;

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,countryCode`
    );
    const data = (await res.json()) as {
      status: string;
      countryCode?: string;
    };

    const country =
      data.status === "success" && data.countryCode ? data.countryCode : null;

    cache.set(ip, country);
    return country;
  } catch {
    // Don't block auth on geolocation failure
    return null;
  }
}

import { lookup } from "node:dns/promises";
import net from "node:net";

function isPrivateIpv4(ip) {
  if (ip === "127.0.0.1") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  const match = ip.match(/^172\.(\d+)\./);
  if (match) {
    const second = Number(match[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

function isPrivateIpv6(ip) {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.replace("::ffff:", "");
    return isPrivateIpv4(mapped);
  }
  return false;
}

function isPrivateIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) return isPrivateIpv6(ip);
  return false;
}

function isBlockedHostname(hostname) {
  const lower = String(hostname || "").toLowerCase();
  if (!lower) return true;
  if (lower === "localhost" || lower.endsWith(".localhost")) return true;
  if (lower.endsWith(".local")) return true;
  return false;
}

async function resolveHostname(hostname) {
  try {
    const result = await lookup(hostname);
    return result && result.address ? result.address : null;
  } catch (err) {
    return null;
  }
}

export async function isSafeUrl(rawUrl) {
  if (!rawUrl) return false;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    return false;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) return false;
  if (isBlockedHostname(parsed.hostname)) return false;

  if (net.isIP(parsed.hostname)) {
    return !isPrivateIp(parsed.hostname);
  }

  const resolved = await resolveHostname(parsed.hostname);
  if (!resolved) return false;
  if (isPrivateIp(resolved)) return false;
  return true;
}

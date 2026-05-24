const crypto = require("crypto");

const parseClientIp = (req) => {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const realIp = String(req.headers["x-real-ip"] || "").trim();
  return forwarded || realIp || req.ip || req.socket?.remoteAddress || "";
};

const parseBrowser = (userAgent = "") => {
  const ua = String(userAgent).toLowerCase();
  if (ua.includes("edg/")) return "Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("chrome/")) return "Chrome";
  if (ua.includes("safari/") && !ua.includes("chrome/")) return "Safari";
  if (ua.includes("firefox/")) return "Firefox";
  return "Unknown Browser";
};

const parsePlatform = (userAgent = "") => {
  const ua = String(userAgent).toLowerCase();
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os")) return "macOS";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "iOS";
  if (ua.includes("linux")) return "Linux";
  return "Unknown OS";
};

const buildDeviceHash = ({ userAgent, acceptLanguage, secChUa, secChUaPlatform, ipAddress }) => {
  const base = [
    String(userAgent || ""),
    String(acceptLanguage || ""),
    String(secChUa || ""),
    String(secChUaPlatform || ""),
    String(ipAddress || ""),
  ].join("|");

  return crypto.createHash("sha256").update(base).digest("hex");
};

const getRequestMetadata = (req) => {
  const userAgent = String(req.headers["user-agent"] || "");
  const acceptLanguage = String(req.headers["accept-language"] || "");
  const secChUa = String(req.headers["sec-ch-ua"] || "");
  const secChUaPlatform = String(req.headers["sec-ch-ua-platform"] || "");
  const ipAddress = parseClientIp(req);
  const browser = parseBrowser(userAgent);
  const platform = parsePlatform(userAgent);

  return {
    ipAddress,
    userAgent,
    deviceHash: buildDeviceHash({
      userAgent,
      acceptLanguage,
      secChUa,
      secChUaPlatform,
      ipAddress,
    }),
    deviceLabel: `${browser} on ${platform}`,
    browser,
    platform,
  };
};

module.exports = {
  getRequestMetadata,
};

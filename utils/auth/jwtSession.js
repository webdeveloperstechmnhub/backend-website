const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const DEFAULT_EXPIRY = "7d";

const generateSessionIdentifiers = () => {
  const sessionId = `sess_${crypto.randomUUID().replace(/-/g, "")}`;
  const jti = `jti_${crypto.randomUUID().replace(/-/g, "")}`;
  return { sessionId, jti };
};

const signSessionJwt = ({ claims, sessionId, jti, expiresIn = DEFAULT_EXPIRY }) => {
  const payload = {
    ...claims,
    session_id: sessionId,
    sessionId,
    jti,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

const verifySessionJwt = (token) => jwt.verify(token, process.env.JWT_SECRET);

const extractBearerToken = (req) => {
  const authHeader = String(req.headers.authorization || "");
  const [, token] = authHeader.split(" ");
  return token || "";
};

module.exports = {
  generateSessionIdentifiers,
  signSessionJwt,
  verifySessionJwt,
  extractBearerToken,
};

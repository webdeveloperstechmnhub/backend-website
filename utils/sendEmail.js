const nodemailer = require("nodemailer");
const { Resend } = require("resend");

const RESEND_FROM = process.env.RESEND_FROM || "Zonex 2026 <noreply@techmnhub.com>";
const SMTP_FROM = process.env.SMTP_FROM || RESEND_FROM;
const EMAIL_PROVIDER = String(process.env.EMAIL_PROVIDER || "auto").toLowerCase();
const MAIL_CONNECT_TIMEOUT_MS = Number(process.env.MAIL_CONNECT_TIMEOUT_MS || 15000);
const MAIL_GREETING_TIMEOUT_MS = Number(process.env.MAIL_GREETING_TIMEOUT_MS || 10000);
const MAIL_SOCKET_TIMEOUT_MS = Number(process.env.MAIL_SOCKET_TIMEOUT_MS || 20000);

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const getTransportTimeoutOptions = () => ({
  connectionTimeout: MAIL_CONNECT_TIMEOUT_MS,
  greetingTimeout: MAIL_GREETING_TIMEOUT_MS,
  socketTimeout: MAIL_SOCKET_TIMEOUT_MS,
});

const toSmtpAttachments = (attachments = []) => {
  return attachments.map((file) => ({
    filename: file.filename,
    content: file.content,
    contentType: file.contentType,
    cid: file.contentId,
    encoding: typeof file.content === "string" ? "base64" : undefined,
  }));
};

const getSmtpTransporter = () => {
  const user = process.env.BREVO_EMAIL || process.env.SMTP_USER || process.env.EMAIL;
  const pass = process.env.BREVO_PASSWORD || process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error("SMTP credentials not configured");
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: { user, pass },
    ...getTransportTimeoutOptions(),
  });
};

const getGmailTransporter = () => {
  const email = process.env.EMAIL;
  const password = process.env.EMAIL_PASS;

  if (!email || !password) {
    throw new Error("Gmail credentials (EMAIL, EMAIL_PASS) not configured");
  }

  const host = process.env.GMAIL_SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.GMAIL_SMTP_PORT || 465);
  const secure = String(process.env.GMAIL_SMTP_SECURE || (port === 465 ? "true" : "false")) === "true";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: email,
      pass: password,
    },
    ...getTransportTimeoutOptions(),
  });
};

const sendWithResend = async ({ to, subject, html, attachments }) => {
  if (!resend) {
    throw new Error("RESEND_API_KEY missing");
  }

  const payload = {
    from: RESEND_FROM,
    to,
    subject,
    html,
    attachments: attachments.length > 0 ? attachments : undefined,
  };

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    throw new Error(error.message || "Unknown Resend error");
  }

  return data;
};

const sendWithSmtp = async ({ to, subject, html, attachments }) => {
  const transporter = getSmtpTransporter();

  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html,
    attachments: toSmtpAttachments(attachments),
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
};

const sendWithGmail = async ({ to, subject, html, attachments }) => {
  const transporter = getGmailTransporter();

  const info = await transporter.sendMail({
    from: process.env.EMAIL,
    to,
    subject,
    html,
    attachments: toSmtpAttachments(attachments),
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
};

const getProviderOrder = (mode) => {
  if (["auto", "resend", "gmail", "smtp"].includes(mode)) {
    return ["resend", "gmail", "smtp"];
  }

  throw new Error(`Unsupported EMAIL_PROVIDER: ${mode}. Use auto, resend, smtp, or gmail.`);
};

const providerSenders = {
  resend: sendWithResend,
  gmail: sendWithGmail,
  smtp: sendWithSmtp,
};

const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  console.log(`📤 Sending email to ${to} with subject: ${subject}`);
  console.log(`📨 Email provider mode: ${EMAIL_PROVIDER}`);
  if (attachments.length > 0) {
    console.log(
      `📎 Attaching ${attachments.length} file(s):`,
      attachments.map((a) => ({ filename: a.filename, type: a.contentType })),
    );
  }

  const providersToTry = getProviderOrder(EMAIL_PROVIDER);
  let lastErr;

  for (let index = 0; index < providersToTry.length; index += 1) {
    const provider = providersToTry[index];
    const sendWithProvider = providerSenders[provider];
    const isFallback = index > 0;
    const nextProvider = providersToTry[index + 1];

    try {
      const result = await sendWithProvider({ to, subject, html, attachments });
      console.log(
        `✅ Email sent via ${provider.toUpperCase()}${isFallback ? " fallback" : ""}:`,
        result,
      );
      return {
        provider,
        data: result,
        fallbackFrom: isFallback ? providersToTry[0] : undefined,
      };
    } catch (err) {
      lastErr = err;

      if (nextProvider) {
        console.error(
          `❌ ${provider.toUpperCase()} failed, trying ${nextProvider.toUpperCase()}:`,
          err.message || err,
        );
      } else {
        console.error(`❌ ${provider.toUpperCase()} failed:`, err.message || err);
      }
    }
  }

  throw new Error(
    `Email delivery failed. Tried providers: ${providersToTry.join(", ")}. Last error: ${
      (lastErr && lastErr.message) || lastErr || "Unknown error"
    }`,
  );
};

module.exports = sendEmail;

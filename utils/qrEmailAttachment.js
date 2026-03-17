const buildQrEmailAttachment = (qrDataUrl, filename = "zonex-ticket-qr.png") => {
  if (!qrDataUrl || typeof qrDataUrl !== "string") {
    return null;
  }

  const [header, base64Content] = qrDataUrl.split(",");
  if (!header || !base64Content || !header.includes(";base64")) {
    return null;
  }

  const mimeMatch = header.match(/^data:(.*);base64$/);

  return {
    filename,
    content: base64Content,
    contentType: mimeMatch ? mimeMatch[1] : "image/png",
    contentId: "ticket-qr",
  };
};

module.exports = buildQrEmailAttachment;

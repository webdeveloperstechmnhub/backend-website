const QRCode = require("qrcode");

const generateQR = async (text) => {
  return await QRCode.toDataURL(text);
};

module.exports = generateQR;

const SECRET_OFFSET = 940102;

function encodeId(apiId) {
  const shifted = parseInt(apiId, 10) + SECRET_OFFSET;
  return shifted.toString(36);
}

function decodeId(encoded) {
  const shifted = parseInt(encoded, 36);
  return shifted - SECRET_OFFSET;
}

module.exports = { encodeId, decodeId };
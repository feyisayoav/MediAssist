const fs = require("fs");
const url = process.env.GATEWAY_URL || "";
fs.writeFileSync(
  "js/config.js",
  `window.APP_CONFIG = { gatewayUrl: ${JSON.stringify(url)} };\n`
);
console.log("gatewayUrl =", url || "(same-origin)");

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "www");
if (!output.startsWith(root + path.sep)) throw new Error("unsafe_output_path");

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });

for (const filename of ["index.html", "app.js", "styles.css", "manifest.webmanifest", "sw.js", "privacy.html"]) {
  await fs.copyFile(path.join(root, filename), path.join(output, filename));
}
await fs.cp(path.join(root, "assets"), path.join(output, "assets"), { recursive: true });

const apiOrigin = String(process.env.PORA_DOM_API_ORIGIN || "").trim().replace(/\/$/, "");
if (apiOrigin && !apiOrigin.startsWith("https://") && !apiOrigin.startsWith("http://10.0.2.2:")) {
  throw new Error("PORA_DOM_API_ORIGIN must use HTTPS (or Android emulator 10.0.2.2 for local development)");
}
const familyEnabled = process.env.PORA_DOM_FAMILY_ENABLED == null
  ? Boolean(apiOrigin)
  : /^(1|true|yes)$/i.test(process.env.PORA_DOM_FAMILY_ENABLED);
const supportEmail = String(process.env.PORA_DOM_SUPPORT_EMAIL || "").trim();
const monetizationApiOrigin = String(process.env.PORA_DOM_MONETIZATION_API_ORIGIN || "").trim().replace(/\/$/, "");
if (monetizationApiOrigin && !monetizationApiOrigin.startsWith("https://") && !monetizationApiOrigin.startsWith("http://10.0.2.2:")) {
  throw new Error("PORA_DOM_MONETIZATION_API_ORIGIN must use HTTPS (or Android emulator 10.0.2.2 for local development)");
}
await fs.writeFile(
  path.join(output, "runtime-config.js"),
  `window.PORA_DOM_WEB_VERSION = "25";\nwindow.PORA_DOM_API_ORIGIN = ${JSON.stringify(apiOrigin)};\nwindow.PORA_DOM_FAMILY_ENABLED = ${JSON.stringify(familyEnabled)};\nwindow.PORA_DOM_SUPPORT_EMAIL = ${JSON.stringify(supportEmail)};\nwindow.PORA_DOM_MONETIZATION_API_ORIGIN = ${JSON.stringify(monetizationApiOrigin)};\n`,
  "utf8"
);
console.log(`Web bundle ready: ${output}${apiOrigin ? ` -> ${apiOrigin}` : " (offline backend mode)"}; family sync ${familyEnabled ? "enabled" : "disabled"}`);

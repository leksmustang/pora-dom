const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const gradle = read("android/app/build.gradle");
const activity = read("android/app/src/main/java/ru/poradom/app/MainActivity.java");
const app = read("app.js");

for (const adapter of ["mobileads-mytarget", "mobileads-mintegral", "mobileads-unityads"]) {
  assert.match(gradle, new RegExp(adapter), `Missing mediation adapter: ${adapter}`);
}
assert.match(activity, /pora-ad-status/, "Native mediation must report availability to the web layer");
assert.match(app, /category=sponsor-banner/, "Independent direct-sponsor fallback must be configured");
assert.match(app, /\/impression\?placement=dashboard_banner/, "Sponsor impressions must be attributed");
assert.match(app, /\/go\?placement=dashboard_banner/, "Sponsor clicks must use the tracked redirect");

console.log("AD MEDIATION OK: VK, Mintegral, Unity adapters plus tracked direct-sponsor fallback");

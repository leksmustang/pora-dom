const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("C:/Users/Leks/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const webRoot = path.join(root, "www");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

execFileSync(process.execPath, [path.join(root, "scripts", "build-web.mjs")], {
  cwd: root,
  env: { ...process.env, PORA_DOM_FAMILY_ENABLED: "false", PORA_DOM_API_ORIGIN: "", PORA_DOM_SUPPORT_EMAIL: "" },
  stdio: "inherit"
});

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = path.resolve(webRoot, relative);
  if (!target.startsWith(webRoot) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "Content-Type": types[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(target).pipe(response);
});

(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await page.addInitScript(() => {
      window.__notificationRequests = 0;
      window.Capacitor = {
        Plugins: {
          Reminder: {
            checkPermissions: async () => ({ notifications: "prompt" }),
            requestPermissions: async () => {
              window.__notificationRequests += 1;
              return { notifications: "granted" };
            },
            syncReminders: async () => ({})
          }
        }
      };
    });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__notificationRequests === 1);
    const notificationState = await page.evaluate(() => JSON.parse(localStorage.getItem("pora-dom-state-v1")));
    assert.equal(notificationState.notificationPermissionAsked, true, "Native permission should be requested on first launch");
    assert.equal(notificationState.notificationsEnabled, true, "Granted permission should enable reminders immediately");
    await page.getByRole("button", { name: "Настроить мой дом" }).click();
    await page.getByRole("button", { name: "Создать домашний план" }).click();
    await page.getByRole("heading", { name: "Дом просит внимания" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Семья" }).count(), 0, "Family navigation must be hidden without a production API");
    assert.equal(await page.locator(".bottom-nav .nav-item").count(), 3, "Local release must have three primary navigation items");
    await page.getByRole("button", { name: "Настройки" }).click();
    await page.getByText(/Версия 1\.0\.1/).waitFor();
    assert.equal(errors.length, 0, `Release web bundle has page errors: ${errors.join("; ")}`);
    console.log("RELEASE WEB OK: local-only config, onboarding, three-item navigation, settings 1.0.1");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

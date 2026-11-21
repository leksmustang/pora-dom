// Produces RuStore-ready 9:16 promotional screenshots from the actual web UI.
// No store artwork is baked into the app or substituted for its interface.
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require("C:/Users/Leks/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "store", "visuals-v16");
const webRoot = path.join(root, "www");
const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml" };

execFileSync(process.execPath, [path.join(root, "scripts", "build-web.mjs")], {
  cwd: root,
  env: { ...process.env, PORA_DOM_FAMILY_ENABLED: "false", PORA_DOM_API_ORIGIN: "", PORA_DOM_MONETIZATION_API_ORIGIN: "" },
  stdio: "inherit"
});
fs.mkdirSync(out, { recursive: true });

const server = http.createServer((request, response) => {
  const relative = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname).replace(/^\/+/, "") || "index.html";
  const target = path.resolve(webRoot, relative);
  if (!target.startsWith(webRoot + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "Content-Type": mime[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(target).pipe(response);
});

const cards = [
  {
    id: "01-today", tab: "Сегодня", label: "ДЕЛА НА СЕГОДНЯ", title: "Домашние дела —\nпо порядку", subtitle: "Сроки, напоминания и ближайшие задачи на одном экране.",
    background: "#123f3a", ink: "#ffffff", secondary: "#c6ded7", accent: "#f16f55"
  },
  {
    id: "02-home", tab: "Дом", label: "КОМНАТЫ И ТЕХНИКА", title: "У каждого дела\nсвоё место", subtitle: "Комнаты можно назвать так, как привыкли дома.",
    background: "#f5f0e6", ink: "#17312e", secondary: "#546c66", accent: "#cb6b4f"
  },
  {
    id: "03-devices", tab: "Дом", label: "УХОД ЗА ТЕХНИКОЙ", title: "Пора заменить\nфильтр?", subtitle: "Добавьте устройство и следите за сроками обслуживания.",
    background: "#e9eee9", ink: "#17312e", secondary: "#546c66", accent: "#d37957", devices: true
  },
  {
    id: "04-checklists", tab: "Чек-листы", label: "ГОТОВЫЙ СТАРТ", title: "Не начинайте\nс пустого списка", subtitle: "Выберите готовые дела и настройте их под себя.",
    background: "#ece3e1", ink: "#42383d", secondary: "#796c71", accent: "#9a637a"
  }
];

function posterHtml(card, screenData) {
  const lines = card.title.split("\n").map(line => `<span>${line}</span>`).join("");
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{width:1080px;height:1920px;margin:0;overflow:hidden}
    body{font-family:Inter,"Segoe UI",Arial,sans-serif;background:${card.background};color:${card.ink}}
    .frame{position:relative;width:1080px;height:1920px;padding:74px 76px;overflow:hidden}
    .rail{position:absolute;right:66px;top:70px;bottom:70px;width:1px;background:${card.ink};opacity:.16}
    .rail::before,.rail::after{position:absolute;right:-5px;width:11px;height:11px;border-radius:50%;background:${card.accent};content:""}.rail::before{top:15px}.rail::after{bottom:15px}
    .top{display:flex;justify-content:space-between;align-items:center;padding-right:54px;font-size:23px;font-weight:800;letter-spacing:.15em}
    .brand{display:flex;gap:15px;align-items:center}.brand-mark{display:grid;width:38px;height:38px;place-items:center;border:2px solid currentColor;border-radius:11px;font-size:25px;letter-spacing:0;line-height:1}
    .number{font-size:21px;opacity:.66;letter-spacing:.04em}
    .copy{position:relative;z-index:2;margin-top:94px;padding-right:100px}
    .label{margin-bottom:24px;color:${card.accent};font-size:25px;font-weight:900;letter-spacing:.16em}
    h1{margin:0;font-size:85px;line-height:1.06;font-weight:850;letter-spacing:-.055em}h1 span{display:block}
    p{max-width:760px;margin:31px 0 0;color:${card.secondary};font-size:30px;line-height:1.36;font-weight:550}
    .phone{position:absolute;z-index:1;left:210px;top:600px;width:660px;padding:16px;border:3px solid ${card.ink};border-radius:59px;background:#fff;box-shadow:0 35px 75px rgba(12,35,30,.21);transform:rotate(-2deg)}
    .phone img{display:block;width:100%;border-radius:43px}.phone::after{position:absolute;left:50%;top:11px;width:93px;height:8px;border-radius:8px;background:#889f9a;content:"";transform:translateX(-50%)}
  </style></head><body><div class="frame"><div class="rail"></div><div class="top"><div class="brand"><span class="brand-mark">⌂</span><span>ПОРА: ДОМ</span></div><span class="number">${cards.indexOf(card) + 1} / ${cards.length}</span></div><div class="copy"><div class="label">${card.label}</div><h1>${lines}</h1><p>${card.subtitle}</p></div><div class="phone"><img src="data:image/png;base64,${screenData}" alt="Реальный экран приложения"></div></div></body></html>`;
}

(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ headless: true, executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
    const page = await browser.newPage({ viewport: { width: 390, height: 790 }, deviceScaleFactor: 2, serviceWorkers: "block" });
    await page.addInitScript(() => {
      window.Capacitor = { isNativePlatform: () => true, Plugins: { Reminder: {
        checkPermissions: async () => ({ notifications: "granted" }),
        syncReminders: async () => ({})
      } } };
    });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Настроить мой дом" }).click();
    await page.getByRole("button", { name: "Создать домашний план" }).click();
    await page.getByRole("heading", { name: "Дом просит внимания" }).waitFor();
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("pora-dom-state-v1"));
      state.devices = [
        { id: "showcase-filter", type: "water-filter", model: "Аквафор", room: "Кухня", installedAt: new Date().toISOString() },
        { id: "showcase-washer", type: "washer", model: "Bosch", room: "Ванная", installedAt: new Date().toISOString() },
        { id: "showcase-robot", type: "robot-vacuum", model: "Roborock", room: "Гостиная", installedAt: new Date().toISOString() },
        { id: "showcase-air", type: "air-purifier", model: "Philips", room: "Спальня", installedAt: new Date().toISOString() },
        { id: "showcase-aircon", type: "conditioner", model: "Haier", room: "Гостиная", installedAt: new Date().toISOString() },
        { id: "showcase-coffee", type: "coffee-machine", model: "DeLonghi", room: "Кухня", installedAt: new Date().toISOString() }
      ];
      state.tasks.find(task => task.presetId === "water-filter").deviceId = "showcase-filter";
      state.tasks.find(task => task.presetId === "washer").deviceId = "showcase-washer";
      const nextDate = days => new Date(Date.now() + days * 86400000).toISOString();
      state.tasks.push({ id: "showcase-robot-task", title: "Заменить фильтр робота-пылесоса", action: "Заменить", room: "Гостиная", icon: "filter", dueDate: nextDate(12), intervalDays: 90, leadDays: 7, deviceId: "showcase-robot", history: [], note: "", assigneeId: "me", assignee: "Вы" });
      state.tasks.push({ id: "showcase-air-task", title: "Заменить фильтр очистителя воздуха", action: "Заменить", room: "Спальня", icon: "filter", dueDate: nextDate(40), intervalDays: 180, leadDays: 21, deviceId: "showcase-air", history: [], note: "", assigneeId: "me", assignee: "Вы" });
      state.tasks.push({ id: "showcase-aircon-task", title: "Почистить фильтр кондиционера", action: "Почистить", room: "Гостиная", icon: "filter", dueDate: nextDate(22), intervalDays: 60, leadDays: 7, deviceId: "showcase-aircon", history: [], note: "", assigneeId: "me", assignee: "Вы" });
      state.tasks.push({ id: "showcase-coffee-task", title: "Очистить кофемашину от накипи", action: "Почистить", room: "Кухня", icon: "appliance", dueDate: nextDate(26), intervalDays: 60, leadDays: 7, deviceId: "showcase-coffee", history: [], note: "", assigneeId: "me", assignee: "Вы" });
      localStorage.setItem("pora-dom-state-v1", JSON.stringify(state));
    });
    await page.reload({ waitUntil: "networkidle" });
    const poster = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    for (const card of cards) {
      await page.getByRole("button", { name: card.tab, exact: true }).click();
      await page.evaluate(() => window.scrollTo(0, 0));
      if (card.devices) await page.evaluate(() => window.scrollTo(0, document.querySelector(".devices-head").offsetTop - 60));
      await page.waitForTimeout(120);
      const screenPath = path.join(out, `${card.id}-screen.png`);
      await page.screenshot({ path: screenPath });
      await poster.setContent(posterHtml(card, fs.readFileSync(screenPath).toString("base64")));
      await poster.screenshot({ path: path.join(out, `${card.id}-rustore.png`) });
    }
    if (errors.length) throw new Error(`Page errors: ${errors.join("; ")}`);
    console.log(`Created ${cards.length} store cards in ${out}`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

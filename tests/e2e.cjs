const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("C:/Users/Leks/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const root = path.resolve(__dirname, "..");
let server;
let browser;

(async () => {
  const { createAppServer } = await import(pathToFileURL(path.join(root, "backend", "server.mjs")).href);
  server = createAppServer({
    databasePath: ":memory:",
    offers: [{
      id: "e2e-water-filter",
      partnerName: "Тестовый магазин",
      title: "Картридж для фильтра воды",
      description: "Подходит для проверки CPA-экрана",
      priceLabel: "от 990 ₽",
      category: "water-filter",
      targetUrl: "https://shop.example/filter",
      subIdParam: "subid"
    }, {
      id: "e2e-dashboard-sponsor",
      partnerName: "Тестовый спонсор",
      title: "Полезные товары для дома",
      description: "Проверка резервного рекламного места",
      priceLabel: "Реклама",
      category: "sponsor-banner",
      targetUrl: "https://sponsor.example/home",
      subIdParam: "click_id"
    }]
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: "block" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}`);
  await page.evaluate(() => localStorage.setItem("pora-native-banner-visible", "1"));
  await page.reload();
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("native-banner-visible")), true, "Native banner layout should survive a WebView reload");
  await page.evaluate(() => {
    localStorage.removeItem("pora-native-banner-visible");
    document.documentElement.classList.remove("native-banner-visible");
  });
  await page.getByRole("button", { name: "Настроить мой дом" }).click();
  await page.getByRole("button", { name: "Создать домашний план" }).click();
  await page.getByRole("heading", { name: "Дом просит внимания" }).waitFor();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("pora-ad-status", { detail: { visible: false, provider: "fallback" } })));
  await page.locator(".sponsor-strip").waitFor();
  assert.match(await page.locator(".sponsor-strip a").getAttribute("href"), /e2e-dashboard-sponsor\/go\?placement=dashboard_banner$/, "Fallback sponsor must use the tracked redirect");
  assert.equal(await page.locator(".sponsor-label").textContent(), "Реклама · Тестовый спонсор", "Direct placement must be visibly labeled as advertising");
  await page.getByRole("button", { name: "Дом", exact: true }).click();
  await page.getByRole("heading", { name: "Ваш дом" }).waitFor();
  await page.evaluate(() => {
    localStorage.setItem("pora-pending-reminder", "1");
    // Simulate a marker left by an older installed build as well.
    localStorage.setItem("pora-pending-task-id", "task-filter");
    window.dispatchEvent(new CustomEvent("pora-reminder-open"));
  });
  await page.getByRole("heading", { name: "Дом просит внимания" }).waitFor();
  assert.equal(await page.locator("#modal-layer").evaluate(layer => layer.hidden), true, "Reminder tap should open Today without the task editor");
  assert.equal(await page.locator(".task-list .task-card").count(), 3, "Reminder tap should show the current urgent task list");
  assert.equal(await page.evaluate(() => localStorage.getItem("pora-pending-reminder")), null, "Handled reminder should clear its generic pending marker");
  assert.equal(await page.evaluate(() => localStorage.getItem("pora-pending-task-id")), null, "Handled reminder should clear its pending marker");
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scrollWidth <= dimensions.width, "Mobile layout should not scroll horizontally");
  const nativeBannerLayout = await page.evaluate(() => {
    const root = document.documentElement;
    const nav = document.querySelector(".bottom-nav");
    const item = document.querySelector(".nav-item");
    root.style.setProperty("--safe-area-inset-bottom", "24px");
    root.classList.remove("native-banner-visible");
    const reservedNavHeight = nav.getBoundingClientRect().height;
    const itemHeightBefore = item.getBoundingClientRect().height;
    root.classList.add("native-banner-visible");
    const compactNavHeight = nav.getBoundingClientRect().height;
    const itemHeightAfter = item.getBoundingClientRect().height;
    root.classList.remove("native-banner-visible");
    root.style.removeProperty("--safe-area-inset-bottom");
    return { reservedNavHeight, compactNavHeight, itemHeightBefore, itemHeightAfter };
  });
  assert.equal(nativeBannerLayout.reservedNavHeight - nativeBannerLayout.compactNavHeight, 24, "Native banner should remove only the duplicated bottom inset");
  assert.equal(nativeBannerLayout.itemHeightBefore, nativeBannerLayout.itemHeightAfter, "Navigation button size should stay unchanged");
  await page.screenshot({ path: path.join(root, "artifacts", "mobile-dashboard.png"), fullPage: true });
  await page.getByRole("button", { name: /Просроченные дела:/ }).click();
  await page.getByRole("heading", { name: "Просроченные дела" }).waitFor();
  assert.equal(await page.locator("#modal-content .task-card").count(), 1, "Overdue summary should open only overdue tasks");
  await page.locator("#modal-content").getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("button", { name: /Дела на сегодня:/ }).click();
  await page.getByRole("heading", { name: "Дела на сегодня" }).waitFor();
  assert.equal(await page.locator("#modal-content .task-card").count(), 1, "Today summary should open only today's tasks");
  await page.locator("#modal-content").getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("button", { name: /Дела на ближайшие 7 дней:/ }).click();
  await page.getByRole("heading", { name: "Дела на ближайшие 7 дней" }).waitFor();
  assert.equal(await page.locator("#modal-content .task-card").count(), 1, "Week summary should open only the next seven days");
  await page.locator("#modal-content").getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("button", { name: /Все задачи:/ }).click();
  await page.getByRole("heading", { name: "Все задачи" }).waitFor();
  assert.equal(await page.locator("#modal-content .task-card").count(), 5, "All tasks button should open the complete task list");
  await page.locator("#modal-content").getByRole("button", { name: "Закрыть" }).click();
  const before = await page.locator(".task-card").count();
  assert.ok(before >= 1, "Expected urgent tasks on the dashboard");
  await page.locator('[data-action="complete"]').first().click();
  await page.getByText(/Следующий срок/).waitFor();
  await page.getByRole("button", { name: "Чек-листы" }).click();
  await page.getByRole("heading", { name: "Готовые чек-листы" }).waitFor();
  const safetyPack = page.locator(".checklist-card", { hasText: "Безопасный дом" });
  await safetyPack.getByRole("button", { name: /Управлять/ }).click();
  await page.locator("#modal-content").getByRole("heading", { name: "Безопасный дом" }).waitFor();
  assert.equal(await page.locator("#modal-content .task-card").count(), 2, "Manage pack should open its added tasks");
  await page.locator("#modal-content").getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("button", { name: "Удалить Заменить кухонную губку" }).click();
  await page.getByRole("heading", { name: "Удалить задачу?" }).waitFor();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await page.getByRole("button", { name: "Удалить Заменить кухонную губку" }).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await page.getByText("Дело удалено", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Добавить Заменить кухонную губку", exact: true }).click();
  await page.getByText("Процедура добавлена", { exact: true }).waitFor();
  await page.locator(".fab").click();
  await page.locator("#task-title").fill("Проверить аптечку");
  await page.locator('#task-form button[type="submit"]').click();
  await page.getByText("Дело добавлено").waitFor();
  await page.getByRole("button", { name: "Сегодня" }).click();
  await page.getByText("Проверить аптечку", { exact: true }).click();
  await page.locator("#task-interval").fill("45");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByText("Изменения сохранены").waitFor();
  await page.getByRole("button", { name: "Дом", exact: true }).click();
  await page.getByRole("button", { name: "Переименовать Кухня" }).click();
  await page.locator("#room-name").fill("Кухня-гостиная");
  await page.getByRole("button", { name: "Сохранить название" }).click();
  await page.getByText("Название помещения изменено").waitFor();
  await page.getByRole("button", { name: "+ Устройство" }).click();
  await page.locator("#device-type").selectOption("robot-vacuum");
  await page.locator("#device-model").selectOption("Roborock");
  await page.locator("#device-name").fill("Робот на кухне");
  await page.locator("#device-room").selectOption("Кухня-гостиная");
  assert.equal(await page.locator('input[name="procedures"]:checked').count(), 3, "Robot vacuum should suggest three procedures");
  await page.locator('#device-form button[type="submit"]').click();
  await page.getByText("Устройство добавлено — дела запланированы").waitFor();
  await page.getByText("Робот на кухне", { exact: true }).waitFor();
  await page.getByText("Робот на кухне", { exact: true }).click();
  assert.equal(await page.locator("#modal-content .task-card").count(), 3, "Device profile should show its three linked procedures");
  await page.locator("#modal-content").getByRole("button", { name: "Закрыть" }).click();
  await page.waitForTimeout(2800);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(root, "artifacts", "mobile-devices.png"), fullPage: true });
  await page.getByRole("button", { name: "Настройки" }).click();
  await page.getByRole("button", { name: "Нежный" }).click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "soft", "Soft theme should apply immediately");
  await page.getByText("Уведомления о делах").waitFor();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(root, "artifacts", "mobile-settings-soft.png") });
  const sheetHandle = page.getByRole("button", { name: "Скрыть окно" });
  const handleBox = await sheetHandle.boundingBox();
  assert.ok(handleBox, "Sheet handle should be visible");
  assert.ok(handleBox.y >= 0 && handleBox.y + handleBox.height <= 844, `Sheet handle should be inside the viewport: ${JSON.stringify(handleBox)}`);
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2 + 130, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const sheetDismissState = await page.evaluate(() => ({
    hidden: document.querySelector("#modal-layer").hidden,
    transform: document.querySelector("#modal-content").style.transform,
    classes: document.querySelector("#modal-content").className
  }));
  assert.equal(sheetDismissState.hidden, true, `Swipe should dismiss sheet: ${JSON.stringify(sheetDismissState)}`);
  await page.getByRole("button", { name: "Сегодня", exact: true }).click();
  await page.getByText("Заменить фильтр воды", { exact: true }).click();
  await page.getByRole("button", { name: "Где купить", exact: true }).click();
  await page.getByText("Реклама · Тестовый магазин", { exact: true }).waitFor();
  const partnerHref = await page.locator('.partner-offer').getAttribute("href");
  assert.equal(partnerHref, "/api/v1/offers/e2e-water-filter/go?placement=task_details", "CPA card should use the tracked server redirect");
  await page.getByRole("button", { name: /Найти обычные магазины рядом/ }).waitFor();
  await page.screenshot({ path: path.join(root, "artifacts", "mobile-cpa-offers.png") });
  await page.locator("#modal-content").getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("button", { name: "Семья" }).click();
  await page.getByRole("button", { name: "Создать общий дом" }).click();
  await page.locator("#family-name").fill("Дом для E2E");
  await page.locator("#family-owner-name").fill("Лена");
  await page.getByRole("button", { name: "Создать и синхронизировать" }).click();
  await page.getByText("Общий дом создан и синхронизирован").waitFor();
  await page.getByText("Синхронизировано").waitFor();
  await page.getByRole("button", { name: "+ Пригласить" }).click();
  const inviteCode = await page.locator(".invite-card strong").textContent();
  assert.ok(inviteCode, "Expected invite code");

  const memberContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const memberPage = await memberContext.newPage();
  const memberErrors = [];
  memberPage.on("pageerror", error => memberErrors.push(error.message));
  await memberPage.goto(`http://127.0.0.1:${port}/?invite=${encodeURIComponent(inviteCode)}`);
  await memberPage.locator("#family-member-name").fill("Алексей");
  await memberPage.getByRole("button", { name: "Подключиться", exact: true }).click();
  await memberPage.getByText("Вы подключились к общему дому").waitFor();
  await memberPage.getByText("Лена", { exact: true }).waitFor();
  assert.equal(await memberPage.locator(".member-row").count(), 2, "Joined home should show both family members");
  await page.locator("#modal-content").getByRole("button", { name: "Закрыть" }).click();
  await page.getByRole("button", { name: /Синхронизировать/ }).click();
  await page.getByText("Дом синхронизирован").waitFor();
  assert.equal(await page.locator(".member-row").count(), 2, "Owner should receive the joined member");

  await page.getByRole("button", { name: "Сегодня", exact: true }).click();
  await page.getByText("Заменить фильтр воды", { exact: true }).click();
  await page.locator("#task-assignee").selectOption({ label: "Алексей" });
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByText("Изменения сохранены").waitFor();
  await page.waitForTimeout(900);

  await memberPage.getByRole("button", { name: /Синхронизировать/ }).click();
  await memberPage.getByText("Дом синхронизирован").waitFor();
  await memberPage.getByRole("button", { name: "Дом", exact: true }).click();
  await memberPage.getByText("Робот на кухне", { exact: true }).waitFor();
  await memberPage.getByRole("button", { name: "Сегодня", exact: true }).click();
  const assignedCard = memberPage.locator('.task-card', { hasText: "Заменить фильтр воды" });
  await assignedCard.getByText("Алексей", { exact: true }).waitFor();
  await assignedCard.locator('[data-action="complete"]').click();
  await memberPage.getByText(/Следующий срок/).waitFor();
  await memberPage.getByRole("button", { name: "Семья" }).click();
  await memberPage.getByRole("button", { name: /Синхронизировать/ }).click();
  await memberPage.getByText("Все изменения сохранены").waitFor();

  await page.getByRole("button", { name: "Семья" }).click();
  await page.getByRole("button", { name: /Синхронизировать/ }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("pora-dom-state-v1")).activity.some(item => item.actorName === "Алексей"));
  await page.getByText("Алексей · выполнено", { exact: true }).waitFor();
  await page.waitForTimeout(2800);
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(root, "artifacts", "mobile-family-sync.png") });
  assert.deepEqual(memberErrors, [], `Member browser errors: ${memberErrors.join("; ")}`);
  await memberContext.close();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("pora-dom-state-v1")));
  assert.ok(saved.tasks.some(task => task.title === "Проверить аптечку" && task.intervalDays === 45), "Edited custom task should persist");
  assert.ok(saved.rooms.includes("Кухня-гостиная"), "Renamed room should persist");
  assert.ok(saved.tasks.filter(task => task.title.includes("фильтр воды"))[0].room === "Кухня-гостиная", "Room tasks should move with renamed room");
  assert.ok(saved.devices.some(device => device.name === "Робот на кухне" && device.model === "Roborock"), "Selected device should persist");
  assert.equal(saved.tasks.filter(task => task.deviceId === saved.devices[0].id).length, 3, "Device should create linked maintenance tasks");
  assert.equal(saved.theme, "soft", "Selected theme should persist");
  assert.deepEqual(errors, [], `Browser errors: ${errors.join("; ")}`);
  await page.screenshot({ path: path.join(root, "artifacts", "mobile-today-after-actions.png"), fullPage: true });
  await browser.close();
  server.close();
  console.log("E2E OK: onboarding, tasks, devices, themes, CPA offer UI, family join, assignment, completion activity, sync");
})().catch(async error => {
  console.error(error);
  await browser?.close().catch(() => {});
  server?.close();
  process.exitCode = 1;
});

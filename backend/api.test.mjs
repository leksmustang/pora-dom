import assert from "node:assert/strict";
import { createAppServer } from "./server.mjs";

const server = createAppServer({
  databasePath: ":memory:",
  offers: [{
    id: "water-filter-test",
    partnerName: "Тестовый магазин",
    title: "Картридж для фильтра",
    description: "Тестовое CPA-предложение",
    priceLabel: "от 990 ₽",
    category: "water-filter",
    brand: "Аквафор",
    targetUrl: "https://shop.example/product?utm_source=poradom",
    subIdParam: "subid",
    priority: 10
  }, {
    id: "dashboard-sponsor-test",
    partnerName: "Тестовый спонсор",
    title: "Расходники для дома",
    description: "Прямая рекламная карточка",
    priceLabel: "Предложение",
    category: "sponsor-banner",
    targetUrl: "https://sponsor.example/home",
    subIdParam: "click_id",
    priority: 20
  }]
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  return { status: response.status, body: await response.json() };
}

try {
  const health = await api("/api/health");
  assert.equal(health.status, 200);

  const owner = await api("/api/v1/session", { method: "POST", body: JSON.stringify({ displayName: "Хозяин" }) });
  const member = await api("/api/v1/session", { method: "POST", body: JSON.stringify({ displayName: "Участник" }) });
  assert.equal(owner.status, 201);

  const auth = { Authorization: `Bearer ${owner.body.token}` };
  const created = await api("/api/v1/homes", { method: "POST", headers: auth, body: JSON.stringify({ name: "Квартира", snapshot: { rooms: ["Кухня"], tasks: [] } }) });
  assert.equal(created.status, 201);
  assert.equal(created.body.version, 1);
  assert.equal(created.body.currentRole, "owner");
  assert.equal(created.body.members.length, 1);

  const updated = await api(`/api/v1/homes/${created.body.id}/snapshot`, { method: "PUT", headers: auth, body: JSON.stringify({ version: 1, snapshot: { rooms: ["Кухня", "Ванная"], tasks: [] } }) });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.version, 2);

  const conflict = await api(`/api/v1/homes/${created.body.id}/snapshot`, { method: "PUT", headers: auth, body: JSON.stringify({ version: 1, snapshot: {} }) });
  assert.equal(conflict.status, 409);

  const invite = await api(`/api/v1/homes/${created.body.id}/invites`, { method: "POST", headers: auth, body: "{}" });
  assert.equal(invite.status, 201);
  const joined = await api(`/api/v1/invites/${invite.body.code}/join`, { method: "POST", headers: { Authorization: `Bearer ${member.body.token}` }, body: "{}" });
  assert.equal(joined.status, 200);
  assert.equal(joined.body.id, created.body.id);
  assert.equal(joined.body.currentRole, "member");
  assert.equal(joined.body.members.length, 2);

  const refreshed = await api(`/api/v1/homes/${created.body.id}`, { headers: auth });
  assert.equal(refreshed.body.members.length, 2);

  const nearby = await api("/api/v1/stores/nearby?lat=55.75&lon=37.62&q=%D1%84%D0%B8%D0%BB%D1%8C%D1%82%D1%80%D1%8B");
  assert.equal(nearby.status, 200);
  assert.equal(nearby.body.locationStored, false);

  const offers = await api("/api/v1/offers?category=water-filter&brand=%D0%90%D0%BA%D0%B2%D0%B0%D1%84%D0%BE%D1%80");
  assert.equal(offers.status, 200);
  assert.equal(offers.body.items.length, 1);
  assert.equal(offers.body.items[0].id, "water-filter-test");
  assert.equal(offers.body.personalDataShared, false);

  const click = await fetch(`${base}/api/v1/offers/water-filter-test/go?placement=task_details`, { redirect: "manual" });
  assert.equal(click.status, 302);
  const redirect = new URL(click.headers.get("location"));
  assert.equal(redirect.hostname, "shop.example");
  assert.equal(redirect.searchParams.get("utm_source"), "poradom");
  assert.match(redirect.searchParams.get("subid"), /^[0-9a-f-]{36}$/);

  const sponsors = await api("/api/v1/offers?category=sponsor-banner");
  assert.equal(sponsors.status, 200);
  assert.equal(sponsors.body.items[0].id, "dashboard-sponsor-test");
  const impression = await api("/api/v1/offers/dashboard-sponsor-test/impression?placement=dashboard_banner", { method: "POST", body: "{}" });
  assert.equal(impression.status, 201);
  assert.match(impression.body.impressionId, /^[0-9a-f-]{36}$/);
  const sponsorClick = await fetch(`${base}/api/v1/offers/dashboard-sponsor-test/go?placement=dashboard_banner`, { redirect: "manual" });
  assert.equal(sponsorClick.status, 302);
  assert.match(new URL(sponsorClick.headers.get("location")).searchParams.get("click_id"), /^[0-9a-f-]{36}$/);

  console.log("API OK: auth, home, sync conflict, invite, join, nearby lookup, CPA clicks, sponsor impressions and attribution");
} finally {
  await new Promise(resolve => server.close(resolve));
}

# Monetization v2: mediation + direct sponsors + CPA

The app has one unobtrusive banner surface but no longer depends on one source of demand. It supports:

1. native mobile mediation: Yandex demand plus VK Ads, Mintegral and Unity Ads adapters;
2. a separately hosted direct-sponsor fallback with impression and click attribution;
3. contextual CPA offers shown only after the user taps `Где купить`.

There are no fullscreen ads or paid reminder actions. A network failure never blocks onboarding, reminders, task completion or navigation.

## Native mediation

The Android build contains these adapters. Placement IDs and reporting tokens stay in the advertising-network cabinets and are never committed to source control:

- Yandex Mobile Ads `8.6.0`;
- VK Ads adapter `5.51.2.2`;
- Mintegral adapter `17.1.81.1`;
- Unity Ads adapter `4.20.0.1`.

The existing banner request does not change. After external placements are connected in the mediation cabinet, eligible networks compete for the same impression. Until then, the official Yandex demo demand remains the only source in test builds.

The app explicitly removes location, phone-state and legacy external-storage permissions that third-party manifests might try to merge. Inspect the final merged APK after every adapter update.

## Direct sponsor fallback

If the native request fails or is disabled, the web layer may request a labeled sponsor placement from the independent monetization API. Configure its HTTPS origin at build time:

```powershell
.\scripts\build-release.ps1 `
  -SupportEmail "support@example.ru" `
  -YandexAdUnitId "R-M-0000000-1" `
  -MonetizationApiOrigin "https://api.poradom.ru"
```

Direct sponsor inventory uses the same `CPA_OFFERS_JSON` input with `category: "sponsor-banner"`. The backend records a random impression ID and a separate click ID without receiving rooms, tasks, notes, addresses or coordinates.

```json
{
  "id": "sponsor-home-store-november",
  "partnerName": "Магазин для дома",
  "title": "Расходники для домашней техники",
  "description": "Рекламное предложение партнёра",
  "priceLabel": "Подробнее",
  "category": "sponsor-banner",
  "targetUrl": "https://partner.example/?utm_source=poradom",
  "subIdParam": "click_id",
  "priority": 50,
  "active": true
}
```

Multiple active sponsor offers rotate once per app session. Every placement is visibly labeled `Реклама · <партнёр>`.

## CPA flow

`GET /api/v1/offers?category=water-filter&brand=Аквафор` returns active matching offers without exposing destination URLs. A click goes through `GET /api/v1/offers/:id/go`, which:

1. creates a random `click_id` on the server;
2. stores the offer, placement and timestamp without personal or household data;
3. appends the ID to the advertiser URL using the configured `subIdParam`;
4. redirects the user to the store.

The CPA network uses that sub-ID to attribute a later order. Sale and commission postbacks are a later stage.

Supported purchase categories are `water-filter`, `robot-vacuum`, `air-purifier`, `conditioner`, `washer`, `coffee-machine`, `safety-sensor`, `household`, and `all`. An empty `brand` matches any brand.

Do not activate an offer until its advertiser has approved mobile-app traffic, the destination is final, and the required advertising label and legal details are known. Only HTTPS destinations are accepted.

## Test and production boundary

The production IDs must never be used for development clicks or impressions. Before a store build:

1. approve the application and banner placement in every enabled network;
2. connect external placements in the mediation cabinet;
3. configure the sponsor API or intentionally leave it disabled;
4. verify the merged manifest, privacy declaration and a physical-device build.

Compiled adapters alone do not produce third-party ads without approved accounts and placement IDs.

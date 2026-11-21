const STORAGE_KEY = "pora-dom-state-v1";
const CLOUD_KEY = "pora-dom-cloud-v1";
const DAY = 86_400_000;
const API_ORIGIN = String(window.PORA_DOM_API_ORIGIN || "").replace(/\/$/, "");
const FAMILY_SYNC_ENABLED = window.PORA_DOM_FAMILY_ENABLED !== false;
const SUPPORT_EMAIL = String(window.PORA_DOM_SUPPORT_EMAIL || "").trim();
const MONETIZATION_API_ORIGIN = String(window.PORA_DOM_MONETIZATION_API_ORIGIN || API_ORIGIN || "").replace(/\/$/, "");
const apiUrl = path => `${API_ORIGIN}${path}`;
const monetizationUrl = path => `${MONETIZATION_API_ORIGIN}${path}`;
const MONETIZATION_AVAILABLE = Boolean(MONETIZATION_API_ORIGIN) || (!window.Capacitor?.isNativePlatform?.() && location.protocol.startsWith("http"));
let sheetDismissTimer = null;
let sheetGestureCleanup = null;
let nativeAdVisible = false;
let sponsorBanner = null;
let sponsorRequestFinished = false;
const sponsorImpressions = new Set();

try {
  if (localStorage.getItem("pora-native-banner-visible") === "1") {
    nativeAdVisible = true;
    document.documentElement.classList.add("native-banner-visible");
  }
} catch {}

const iconPaths = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V21h14V10.5"/><path d="M9 21v-6h6v6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  rooms: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="m3 6 1 1 2-2M3 12h3M3 18h3"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3h4v.08a1.7 1.7 0 0 0 1.06 1.52 1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 21 10h.08v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  sparkles: '<path d="m12 3-1.3 3.7L7 8l3.7 1.3L12 13l1.3-3.7L17 8l-3.7-1.3Z"/><path d="m5 14-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8Z"/><path d="m19 13-.8 2.2L16 16l2.2.8L19 19l.8-2.2L22 16l-2.2-.8Z"/>',
  droplet: '<path d="M12 2.7S5 10.2 5 15a7 7 0 0 0 14 0c0-4.8-7-12.3-7-12.3Z"/>',
  brush: '<path d="m9 11 8-8 4 4-8 8"/><path d="M5 13c-2 2-2 5-2 8 3 0 6 0 8-2 1.5-1.5 1.5-4 0-5.5S6.5 11.5 5 13Z"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8Z"/>',
  battery: '<rect x="3" y="6" width="17" height="12" rx="2"/><path d="M20 10h2v4h-2M7 12h6M10 9v6"/>',
  appliance: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h.01M11 6h.01"/><circle cx="12" cy="14" r="4"/>',
  bath: '<path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3Z"/><path d="M7 12V6a3 3 0 0 1 6 0"/>',
  kitchen: '<path d="M4 3v18M20 3v18M4 9h16M10 9v12"/><circle cx="7" cy="6" r="1"/><path d="M13 13h4"/>',
  bedroom: '<path d="M3 19v-8h18v8M3 16h18M6 11V7h5a3 3 0 0 1 3 3v1"/>',
  robot: '<rect x="4" y="7" width="16" height="12" rx="5"/><path d="M9 7V4h6v3M8 12h.01M16 12h.01M8 16h8"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'
  ,bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>'
  ,palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.6-1.4-.4-.4-.6-.9-.6-1.4 0-1.1.9-2 2-2h2.1a5.1 5.1 0 0 0 5.1-5.1C22 5.6 17.5 2 12 2Z"/>'
  ,map: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>'
};

function icon(name, label = "") {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${label ? `aria-label="${label}"` : 'aria-hidden="true"'}>${iconPaths[name] || iconPaths.home}</svg>`;
}

// Small room drawings give the home cards their own visual identity while
// navigation and action icons remain simple and familiar.
const roomArtwork = {
  kitchen: '<path d="M8 47h64v8H8z" fill="var(--brand)"/><path d="M14 55h8v16h-8zm44 0h8v16h-8z" fill="var(--brand-2)"/><path d="M25 30h30v17H25z" fill="var(--surface)" stroke="var(--brand)" stroke-width="3"/><path d="M30 30v-8c0-8 12-8 12 0v3" fill="none" stroke="var(--brand)" stroke-width="4" stroke-linecap="round"/><path d="M37 25h10" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/><path d="M33 36h14" stroke="var(--brand-2)" stroke-width="3" stroke-linecap="round"/>',
  bath: '<path d="M12 39h56v14c0 8-6 14-14 14H26c-8 0-14-6-14-14V39Z" fill="var(--surface)" stroke="var(--brand)" stroke-width="3"/><path d="M17 67v5m46-5v5M22 39V22c0-10 16-10 16 0" fill="none" stroke="var(--brand)" stroke-width="4" stroke-linecap="round"/><path d="M33 24h12" stroke="var(--accent)" stroke-width="4" stroke-linecap="round"/><circle cx="54" cy="30" r="5" fill="var(--accent-soft)"/>',
  bedroom: '<path d="M9 43h62v20H9z" fill="var(--surface)" stroke="var(--brand)" stroke-width="3"/><path d="M14 31h22a8 8 0 0 1 8 8v4H14V31Z" fill="var(--accent-soft)" stroke="var(--brand)" stroke-width="3"/><path d="M44 35h20a7 7 0 0 1 7 7v1H44v-8Z" fill="var(--surface-soft)" stroke="var(--brand)" stroke-width="3"/><path d="M9 63v8m62-8v8" stroke="var(--brand)" stroke-width="4" stroke-linecap="round"/>',
  home: '<path d="M10 38 40 14l30 24v31H10V38Z" fill="var(--surface)" stroke="var(--brand)" stroke-width="3" stroke-linejoin="round"/><path d="M29 69V44h22v25" fill="var(--accent-soft)" stroke="var(--brand)" stroke-width="3"/><circle cx="45" cy="57" r="2" fill="var(--accent)"/><path d="M7 39 40 12l33 27" fill="none" stroke="var(--brand)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
};
function roomIllustration(name) {
  return `<svg viewBox="0 0 80 80" fill="none" aria-hidden="true">${roomArtwork[name] || roomArtwork.home}</svg>`;
}

const objectArtwork = {
  sponge: '<rect x="12" y="26" width="56" height="31" rx="8" fill="var(--warning-soft)" stroke="var(--warning)" stroke-width="3"/><circle cx="27" cy="38" r="3" fill="var(--warning)"/><circle cx="46" cy="46" r="4" fill="var(--warning)"/><circle cx="56" cy="35" r="2" fill="var(--warning)"/><path d="M12 48c12 0 16 8 28 8s16-8 28-8" stroke="var(--warning)" stroke-width="3"/>',
  'water-filter': '<path d="M27 18h26v44c0 7-6 10-13 10s-13-3-13-10V18Z" fill="var(--surface)" stroke="var(--brand)" stroke-width="3"/><path d="M27 29h26M31 38h18M31 44h18" stroke="var(--brand-2)" stroke-width="3"/><path d="M33 18v-7h14v7" fill="var(--accent-soft)" stroke="var(--brand)" stroke-width="3"/><path d="M34 56c3-5 5-8 6-8s3 3 6 8a6 6 0 0 1-12 0Z" fill="var(--accent)"/>',
  linen: '<path d="M11 37h58v27H11V37Z" fill="var(--surface)" stroke="var(--brand)" stroke-width="3"/><path d="M14 37V23h24c7 0 11 4 11 10v4" fill="var(--accent-soft)" stroke="var(--brand)" stroke-width="3"/><path d="M49 28h14c4 0 6 3 6 9H49v-9Z" fill="var(--surface-soft)" stroke="var(--brand)" stroke-width="3"/><path d="M12 51h56" stroke="var(--brand-2)" stroke-width="3"/>',
  washer: '<rect x="20" y="10" width="40" height="61" rx="6" fill="var(--surface)" stroke="var(--brand)" stroke-width="3"/><path d="M20 25h40" stroke="var(--brand)" stroke-width="3"/><circle cx="40" cy="48" r="15" fill="var(--surface-soft)" stroke="var(--brand)" stroke-width="3"/><path d="M31 49c4-4 8-4 12 0s7 4 10 0" stroke="var(--accent)" stroke-width="3"/><circle cx="28" cy="18" r="2" fill="var(--accent)"/><path d="M36 18h12" stroke="var(--brand-2)" stroke-width="3"/>',
  detector: '<rect x="16" y="27" width="48" height="34" rx="10" fill="var(--surface)" stroke="var(--brand)" stroke-width="3"/><circle cx="40" cy="44" r="9" fill="var(--accent-soft)" stroke="var(--brand)" stroke-width="3"/><circle cx="40" cy="44" r="3" fill="var(--accent)"/><path d="M25 23c8-6 22-6 30 0" stroke="var(--brand-2)" stroke-width="3" stroke-linecap="round"/>',
  'robot-vacuum': '<circle cx="40" cy="42" r="26" fill="var(--surface)" stroke="var(--brand)" stroke-width="3"/><path d="M24 33h32M26 50h28" stroke="var(--brand-2)" stroke-width="3"/><circle cx="31" cy="42" r="3" fill="var(--accent)"/><circle cx="49" cy="42" r="3" fill="var(--accent)"/><path d="M19 62 13 68m48-6 6 6" stroke="var(--brand)" stroke-width="3" stroke-linecap="round"/>',
  'air-purifier': '<rect x="22" y="9" width="36" height="62" rx="7" fill="var(--surface)" stroke="var(--brand)" stroke-width="3"/><path d="M28 31h24M28 39h24M28 47h24M28 55h24" stroke="var(--brand-2)" stroke-width="3" stroke-linecap="round"/><circle cx="40" cy="20" r="4" fill="var(--accent)"/>'
};
function objectIllustration(name, fallback) {
  return objectArtwork[name]
    ? `<svg class="object-artwork" viewBox="0 0 80 80" fill="none" aria-hidden="true">${objectArtwork[name]}</svg>`
    : icon(fallback || name);
}

const presets = [
  { id: "water-filter", title: "Заменить фильтр воды", room: "Кухня", action: "Заменить", intervalDays: 90, leadDays: 7, icon: "droplet" },
  { id: "sponge", title: "Заменить кухонную губку", room: "Кухня", action: "Заменить", intervalDays: 10, leadDays: 1, icon: "sparkles" },
  { id: "hood", title: "Почистить фильтр вытяжки", room: "Кухня", action: "Почистить", intervalDays: 30, leadDays: 3, icon: "filter" },
  { id: "coffee", title: "Очистить кофемашину", room: "Кухня", action: "Почистить", intervalDays: 45, leadDays: 3, icon: "appliance" },
  { id: "toothbrush", title: "Заменить зубные щётки", room: "Ванная", action: "Заменить", intervalDays: 90, leadDays: 7, icon: "brush" },
  { id: "washer", title: "Почистить стиральную машину", room: "Ванная", action: "Почистить", intervalDays: 30, leadDays: 3, icon: "appliance" },
  { id: "towels", title: "Заменить полотенца", room: "Ванная", action: "Заменить", intervalDays: 7, leadDays: 0, icon: "bath" },
  { id: "linen", title: "Сменить постельное бельё", room: "Спальня", action: "Заменить", intervalDays: 10, leadDays: 1, icon: "bedroom" },
  { id: "detector", title: "Проверить батарейки датчика", room: "Прихожая", action: "Проверить", intervalDays: 180, leadDays: 14, icon: "battery" },
  { id: "air-filter", title: "Почистить фильтр кондиционера", room: "Гостиная", action: "Почистить", intervalDays: 60, leadDays: 7, icon: "filter" }
];

const checklistPacks = [
  { id: "weekly", name: "Еженедельный порядок", caption: "Быстрый круг по квартире", items: ["sponge", "towels", "linen"] },
  { id: "appliances", name: "Уход за техникой", caption: "Фильтры и профилактика", items: ["hood", "coffee", "washer", "air-filter"] },
  { id: "safety", name: "Безопасный дом", caption: "То, что легко забыть", items: ["water-filter", "detector"] }
];

const deviceCatalog = [
  {
    id: "water-filter", title: "Фильтр воды", icon: "droplet",
    models: ["Аквафор", "Барьер", "Гейзер", "Atoll", "Другая модель"],
    procedures: [
      { id: "cartridge", title: "Заменить картриджи фильтра воды", action: "Заменить", intervalDays: 180, leadDays: 14, icon: "filter" }
    ]
  },
  {
    id: "robot-vacuum", title: "Робот-пылесос", icon: "robot",
    models: ["Xiaomi", "Roborock", "Dreame", "iRobot", "Другая модель"],
    procedures: [
      { id: "filter", title: "Заменить фильтр робота-пылесоса", action: "Заменить", intervalDays: 90, leadDays: 7, icon: "filter" },
      { id: "side-brush", title: "Заменить боковую щётку робота-пылесоса", action: "Заменить", intervalDays: 120, leadDays: 14, icon: "brush" },
      { id: "main-brush", title: "Проверить основную щётку робота-пылесоса", action: "Проверить", intervalDays: 180, leadDays: 14, icon: "brush" }
    ]
  },
  {
    id: "air-purifier", title: "Очиститель воздуха", icon: "wind",
    models: ["Xiaomi", "Philips", "Tefal", "Ballu", "Другая модель"],
    procedures: [
      { id: "filter", title: "Заменить фильтр очистителя воздуха", action: "Заменить", intervalDays: 180, leadDays: 21, icon: "filter" }
    ]
  },
  {
    id: "conditioner", title: "Кондиционер", icon: "wind",
    models: ["Haier", "Ballu", "Electrolux", "LG", "Другая модель"],
    procedures: [
      { id: "clean-filter", title: "Почистить фильтр кондиционера", action: "Почистить", intervalDays: 60, leadDays: 7, icon: "filter" },
      { id: "service", title: "Проверить кондиционер перед сезоном", action: "Проверить", intervalDays: 365, leadDays: 30, icon: "wind" }
    ]
  },
  {
    id: "washer", title: "Стиральная машина", icon: "appliance",
    models: ["LG", "Samsung", "Bosch", "Haier", "Другая модель"],
    procedures: [
      { id: "drum-clean", title: "Почистить стиральную машину", action: "Почистить", intervalDays: 30, leadDays: 3, icon: "appliance" },
      { id: "hose-check", title: "Проверить шланги стиральной машины", action: "Проверить", intervalDays: 180, leadDays: 14, icon: "shield" }
    ]
  },
  {
    id: "coffee-machine", title: "Кофемашина", icon: "appliance",
    models: ["DeLonghi", "Philips", "Krups", "Bosch", "Другая модель"],
    procedures: [
      { id: "descale", title: "Очистить кофемашину от накипи", action: "Почистить", intervalDays: 60, leadDays: 7, icon: "sparkles" },
      { id: "water-filter", title: "Заменить фильтр кофемашины", action: "Заменить", intervalDays: 90, leadDays: 7, icon: "filter" }
    ]
  },
  {
    id: "safety-sensor", title: "Датчик безопасности", icon: "shield",
    models: ["Aqara", "Яндекс", "Sber", "Tuya", "Другая модель"],
    procedures: [
      { id: "battery", title: "Проверить батарейку датчика", action: "Проверить", intervalDays: 180, leadDays: 14, icon: "battery" },
      { id: "test", title: "Проверить работу датчика", action: "Проверить", intervalDays: 90, leadDays: 7, icon: "shield" }
    ]
  }
];

function addDays(date, days) {
  const next = new Date(date);
  next.setHours(12, 0, 0, 0);
  next.setDate(next.getDate() + Number(days));
  return next.toISOString();
}

function seedTasks() {
  const today = new Date();
  const selected = [
    ["sponge", -1], ["water-filter", 3], ["linen", 0], ["washer", 9], ["detector", 35]
  ];
  return selected.map(([presetId, offset], index) => {
    const p = presets.find(item => item.id === presetId);
    return { ...p, id: `task-${index + 1}`, presetId, dueDate: addDays(today, offset), lastDone: null, history: [], assigneeId: "me", assignee: "Вы", note: "" };
  });
}

function initialState() {
  return {
    onboarded: false,
    activeTab: "today",
    homeType: "Квартира",
    rooms: ["Кухня", "Ванная", "Спальня", "Гостиная", "Прихожая"],
    tasks: seedTasks(),
    devices: [],
    members: [{ id: "me", name: "Вы", color: "#f16f55" }],
    completedThisWeek: 0,
    activity: [],
    theme: "balanced",
    notificationTime: "09:00",
    notificationsEnabled: false,
    notificationPermissionAsked: false,
    notificationLog: {}
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && Array.isArray(saved.tasks) ? { ...initialState(), ...saved, devices: Array.isArray(saved.devices) ? saved.devices : [] } : initialState();
  } catch {
    return initialState();
  }
}

function loadCloud() {
  try {
    const saved = JSON.parse(localStorage.getItem(CLOUD_KEY));
    return saved?.token && saved?.homeId ? { status: "offline", members: [], ...saved, conflict: null } : { status: "local", members: [] };
  } catch {
    return { status: "local", members: [] };
  }
}

let state = loadState();
let cloud = loadCloud();
if (!FAMILY_SYNC_ENABLED && state.activeTab === "family") state.activeTab = "today";
let toastTimer;
let syncTimer;
let syncInFlight = false;
let nativeNotificationPermission = "prompt";
applyTheme(state.theme);

function save({ sync = true } = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  syncNativeReminders();
  if (sync && FAMILY_SYNC_ENABLED) scheduleCloudSync();
}

function reminderPlugin() {
  return window.Capacitor?.Plugins?.Reminder || null;
}

async function syncNativeReminders() {
  const plugin = reminderPlugin();
  if (!plugin) return;
  try {
    await plugin.syncReminders({
      tasksJson: JSON.stringify(state.tasks),
      notificationTime: state.notificationTime,
      enabled: Boolean(state.notificationsEnabled && nativeNotificationPermission === "granted")
    });
  } catch {}
}

async function refreshNativeNotificationPermission() {
  const plugin = reminderPlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.checkPermissions();
    nativeNotificationPermission = result.notifications || "prompt";
    if (nativeNotificationPermission !== "granted" && state.notificationsEnabled) {
      state.notificationsEnabled = false;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    return true;
  } catch {
    return false;
  }
}

function saveCloud() {
  const stored = { ...cloud };
  delete stored.conflict;
  localStorage.setItem(CLOUD_KEY, JSON.stringify(stored));
}

function sharedSnapshot() {
  return {
    schemaVersion: 2,
    homeType: state.homeType,
    rooms: state.rooms,
    tasks: state.tasks,
    devices: state.devices || [],
    completedThisWeek: state.completedThisWeek,
    activity: state.activity || []
  };
}

function snapshotKey(snapshot = sharedSnapshot()) {
  return JSON.stringify(snapshot);
}

function scheduleCloudSync() {
  if (!cloud.token || !cloud.homeId || syncInFlight) return;
  const next = snapshotKey();
  if (next === cloud.lastSnapshot) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => pushCloud().catch(() => {}), 700);
}

function dueInfo(task) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const due = new Date(task.dueDate);
  due.setHours(12, 0, 0, 0);
  const days = Math.round((due - today) / DAY);
  if (days < 0) return { days, status: "overdue", label: `Просрочено ${Math.abs(days)} дн.` };
  if (days === 0) return { days, status: "today", label: "Сегодня" };
  if (days <= Number(task.leadDays || 3)) return { days, status: "soon", label: `Через ${days} дн.` };
  return { days, status: "later", label: `Через ${days} дн.` };
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "short" }).format(date).replace(".", "");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
}

function nav() {
  const items = [
    ["today", "calendar", "Сегодня"],
    ["home", "rooms", "Дом"],
    ["checklists", "list", "Чек-листы"],
    ...(FAMILY_SYNC_ENABLED ? [["family", "users", "Семья"]] : [])
  ];
  return `<nav class="bottom-nav" style="--nav-count:${items.length}" aria-label="Основная навигация">${items.map(([id, ico, label]) => `<button class="nav-item ${state.activeTab === id ? "active" : ""}" type="button" data-tab="${id}">${icon(ico)}<span>${label}</span></button>`).join("")}</nav>`;
}

function sponsorBannerView() {
  if (!state.onboarded || nativeAdVisible || !sponsorBanner || state.activeTab === "family") return "";
  const href = monetizationUrl(`/api/v1/offers/${encodeURIComponent(sponsorBanner.id)}/go?placement=dashboard_banner`);
  return `<aside class="sponsor-strip" data-sponsor-id="${escapeHtml(sponsorBanner.id)}" aria-label="Рекламное предложение"><a href="${escapeHtml(href)}" target="_blank" rel="sponsored noopener noreferrer"><span class="sponsor-label">Реклама · ${escapeHtml(sponsorBanner.partnerName)}</span><strong>${escapeHtml(sponsorBanner.title)}</strong><span class="sponsor-action">Подробнее ${icon("chevron")}</span></a></aside>`;
}

async function loadSponsorBanner() {
  if (!MONETIZATION_AVAILABLE || !state.onboarded || nativeAdVisible || sponsorRequestFinished) return;
  sponsorRequestFinished = true;
  try {
    const response = await fetch(monetizationUrl("/api/v1/offers?category=sponsor-banner"));
    if (!response.ok) return;
    const offers = (await response.json()).items || [];
    if (!offers.length) return;
    let selectedId = "";
    try { selectedId = sessionStorage.getItem("pora-session-sponsor") || ""; } catch {}
    sponsorBanner = offers.find(offer => offer.id === selectedId) || offers[Math.floor(Math.random() * offers.length)];
    try { sessionStorage.setItem("pora-session-sponsor", sponsorBanner.id); } catch {}
    render();
  } catch {}
}

function recordSponsorImpression() {
  const placement = document.querySelector("[data-sponsor-id]");
  const id = placement?.dataset.sponsorId;
  if (!id || sponsorImpressions.has(id)) return;
  sponsorImpressions.add(id);
  fetch(monetizationUrl(`/api/v1/offers/${encodeURIComponent(id)}/impression?placement=dashboard_banner`), { method: "POST", keepalive: true }).catch(() => {});
}

function header() {
  return `<header class="topbar"><div class="brand-lockup"><div class="brand-mark">${icon("home")}</div><div><div class="brand-name">Пора: Дом</div><div class="brand-caption">${state.homeType} · ${state.rooms.length} комнат</div></div></div><button class="icon-button" type="button" data-action="settings" aria-label="Настройки">${icon("settings")}</button></header>`;
}

function availableAssignees() {
  if (cloud.homeId && cloud.members?.length) return cloud.members.map(member => ({ id: member.id, name: member.displayName }));
  return state.members.map(member => ({ id: member.id, name: member.name }));
}

function assigneeName(task) {
  const matched = availableAssignees().find(member => member.id === task.assigneeId);
  return matched?.name || task.assignee || "Вы";
}

function deviceCategory(type) {
  return deviceCatalog.find(item => item.id === type);
}

function deviceById(id) {
  return (state.devices || []).find(item => item.id === id);
}

function deviceDisplayName(device) {
  const category = deviceCategory(device.type);
  return device.name || (device.model && device.model !== "Другая модель" ? device.model : category?.title) || "Устройство";
}

function taskCard(task) {
  const due = dueInfo(task);
  const assigned = assigneeName(task);
  const linkedDevice = task.deviceId ? deviceById(task.deviceId) : null;
  return `<article class="task-card ${due.status}" data-task-id="${task.id}">
    <div class="task-icon">${objectIllustration(task.presetId, task.icon || "clock")}</div>
    <button class="task-copy-button" type="button" data-action="edit-task" data-id="${task.id}"><div class="task-title">${escapeHtml(task.title)}</div><div class="task-meta"><span>${escapeHtml(task.room)}</span><span class="status-dot"></span><span>${due.label}</span>${linkedDevice ? `<span class="device-chip">${escapeHtml(deviceDisplayName(linkedDevice))}</span>` : ""}${cloud.homeId ? `<span class="assignee-chip">${escapeHtml(assigned)}</span>` : ""}</div></button>
    <div class="task-actions"><button class="round-action" type="button" data-action="snooze" data-id="${task.id}" aria-label="Отложить на день">${icon("pause")}</button><button class="round-action primary" type="button" data-action="complete" data-id="${task.id}" aria-label="Отметить выполненным">${icon("check")}</button></div>
  </article>`;
}

function summaryTasks(filter) {
  if (filter === "overdue") return state.tasks.filter(task => dueInfo(task).days < 0);
  if (filter === "today") return state.tasks.filter(task => dueInfo(task).days === 0);
  if (filter === "week") return state.tasks.filter(task => dueInfo(task).days > 0 && dueInfo(task).days <= 7);
  return state.tasks;
}

function todayView() {
  const sorted = [...state.tasks].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const urgent = sorted.filter(task => dueInfo(task).days <= Number(task.leadDays || 3));
  const overdue = summaryTasks("overdue").length;
  const today = summaryTasks("today").length;
  const soon = summaryTasks("week").length;
  return `<main>
    <section class="hero hero-today"><span class="hero-eyebrow">ДОМАШНИЙ ПЛАН · СЕГОДНЯ</span><div class="hero-row"><div><h1>${overdue ? "Дом просит внимания" : "Всё под контролем"}</h1><p>${overdue ? "Начните с просроченного — остальное можно спокойно распределить." : "На сегодня срочных домашних дел нет."}</p></div><span class="date-pill">${formatDate()}</span></div></section>
    <section class="summary-grid" aria-label="Сводка">
      <button class="summary-card danger" type="button" data-action="show-summary" data-filter="overdue" aria-label="Просроченные дела: ${overdue}"><strong>${overdue}</strong><span class="summary-card-footer"><span class="summary-label"><span class="summary-label-full">просрочено</span><span class="summary-label-short">проср.</span></span><span class="summary-chevron">${icon("chevron")}</span></span></button>
      <button class="summary-card" type="button" data-action="show-summary" data-filter="today" aria-label="Дела на сегодня: ${today}"><strong>${today}</strong><span class="summary-card-footer"><span>сегодня</span><span class="summary-chevron">${icon("chevron")}</span></span></button>
      <button class="summary-card" type="button" data-action="show-summary" data-filter="week" aria-label="Дела на ближайшие 7 дней: ${soon}"><strong>${soon}</strong><span class="summary-card-footer"><span class="summary-label"><span class="summary-label-full">на неделе</span><span class="summary-label-short">7 дней</span></span><span class="summary-chevron">${icon("chevron")}</span></span></button>
    </section>
    <div class="section-head"><h2>Ближайшие дела</h2><button class="all-tasks-button" type="button" data-action="show-all" aria-label="Все задачи: ${state.tasks.length}"><span>Все задачи</span><b>${state.tasks.length}</b>${icon("chevron")}</button></div>
    ${urgent.length ? `<div class="task-list">${urgent.map(taskCard).join("")}</div>` : `<div class="empty-state"><div class="big-icon">${icon("check")}</div><h3>На сегодня всё</h3><p>Новые дела появятся здесь, когда подойдёт их срок.</p></div>`}
  </main>`;
}

function homeView() {
  const devices = state.devices || [];
  const deviceCards = devices.map(device => {
    const category = deviceCategory(device.type) || { title: "Устройство", icon: "appliance" };
    const tasks = state.tasks.filter(task => task.deviceId === device.id);
    const nextTask = [...tasks].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    return `<button class="device-card" type="button" data-action="open-device" data-id="${device.id}"><span class="device-card-icon">${objectIllustration(device.type, category.icon)}</span><span class="device-card-copy"><strong>${escapeHtml(deviceDisplayName(device))}</strong><small>${escapeHtml(category.title)} · ${escapeHtml(device.room)}</small><span>${nextTask ? `Ближайшее: ${escapeHtml(nextTask.title)} · ${dueInfo(nextTask).label.toLocaleLowerCase("ru-RU")}` : "Процедуры не выбраны"}</span></span>${icon("chevron")}</button>`;
  }).join("");
  return `<main><section class="hero hero-home"><span class="hero-eyebrow">ВСЁ ДЛЯ ДОМА · В ОДНОМ МЕСТЕ</span><h1>Ваш дом</h1><p>Комнаты, устройства и повторяющиеся дела — в одном домашнем плане.</p></section><div class="section-head"><h2>Комнаты</h2><button class="link-button" type="button" data-action="add-room">+ Комната</button></div><section class="room-grid">${state.rooms.map(room => {
    const tasks = state.tasks.filter(task => task.room === room);
    const urgent = tasks.filter(task => dueInfo(task).days <= Number(task.leadDays || 3)).length;
    const roomIcon = room === "Кухня" ? "kitchen" : room === "Ванная" ? "bath" : room === "Спальня" ? "bedroom" : "home";
    return `<article class="room-card"><button class="room-open" type="button" data-action="open-room" data-room="${escapeHtml(room)}"><div class="room-visual"><span class="room-icon">${roomIllustration(roomIcon)}</span><span class="room-count">${tasks.length} дел</span></div><h3>${escapeHtml(room)}</h3><p>${urgent ? `${urgent} требуют внимания` : "Всё в порядке"}</p></button><button class="room-edit" type="button" data-action="edit-room" data-room="${escapeHtml(room)}" aria-label="Переименовать ${escapeHtml(room)}">${icon("edit")}<span>Переименовать</span></button></article>`;
  }).join("")}</section><div class="section-head devices-head"><div><h2>Устройства</h2><p>${devices.length ? `${devices.length} ${pluralize(devices.length, "устройство", "устройства", "устройств")} в домашнем плане` : "Добавьте технику — сроки обслуживания появятся сами"}</p></div><button class="link-button" type="button" data-action="add-device">+ Устройство</button></div>${devices.length ? `<section class="device-list">${deviceCards}</section>` : `<button class="device-empty" type="button" data-action="add-device"><span class="device-empty-icon">${icon("appliance")}</span><span><strong>Добавить первое устройство</strong><small>Выберите тип и модель, а мы предложим нужные процедуры.</small></span>${icon("chevron")}</button>`}</main>`;
}

function checklistView() {
  return `<main><section class="hero hero-checklists"><span class="hero-eyebrow">ХОРОШИЕ ПРИВЫЧКИ · БЕЗ СЛОЖНОСТЕЙ</span><h1>Готовые чек-листы</h1><p>Добавьте полезный домашний ритм одним нажатием, затем настройте его под себя.</p></section><section class="checklist-grid">${checklistPacks.map(pack => {
    const missing = pack.items.filter(id => !state.tasks.some(task => task.presetId === id));
    return `<article class="checklist-card"><span class="eyebrow">${pack.items.length} действия</span><h3>${pack.name}</h3><p>${pack.caption}</p><button class="small-button ${missing.length ? "" : "manage"}" type="button" data-action="${missing.length ? "add-pack" : "open-pack"}" data-id="${pack.id}">${missing.length ? `Добавить ${missing.length}` : `Управлять ${icon("chevron")}`}</button></article>`;
  }).join("")}</section><div class="section-head" style="margin-top:26px"><h2>Каталог процедур</h2></div><div class="preset-list">${presets.map(presetRow).join("")}</div></main>`;
}

function presetRow(preset) {
  const task = state.tasks.find(item => item.presetId === preset.id);
  const action = task ? "edit-task" : "add-preset";
  const actionId = task?.id || preset.id;
  return `<article class="preset-row"><button class="preset-main" type="button" data-action="${action}" data-id="${actionId}" aria-label="${task ? "Открыть задачу" : "Добавить задачу"}: ${escapeHtml(preset.title)}"><span class="task-icon">${icon(preset.icon)}</span><span><strong>${escapeHtml(preset.title)}</strong><small>${escapeHtml(preset.room)} · каждые ${preset.intervalDays} дн.</small></span></button><button class="${task ? "preset-remove" : "preset-add"}" type="button" data-action="${task ? "delete-task" : "add-preset"}" data-id="${actionId}" aria-label="${task ? "Удалить" : "Добавить"} ${escapeHtml(preset.title)}">${icon(task ? "trash" : "plus")}</button></article>`;
}

function familyView() {
  const connected = Boolean(cloud.token && cloud.homeId);
  const members = connected && cloud.members?.length
    ? cloud.members.map((member, index) => ({ id: member.id, name: member.displayName, color: ["#f16f55", "#7b8f83", "#a9768b", "#4f7d91"][index % 4], role: member.role }))
    : state.members;
  const syncLabels = { synced: "Синхронизировано", syncing: "Сохраняем…", offline: "Нет связи", conflict: "Нужно выбрать", error: "Ошибка связи" };
  const recentActivity = [...(state.activity || [])].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt)).slice(0, 4);
  const weekAgo = Date.now() - 7 * DAY;
  const completedThisWeek = (state.activity || []).filter(item => Date.parse(item.completedAt) >= weekAgo).length || state.completedThisWeek;
  const conflict = cloud.conflict ? `<article class="sync-warning"><strong>Два устройства изменили дом одновременно</strong><p>Ничего не потеряно: выберите, какую версию оставить.</p><div class="two-cols"><button class="secondary-button" type="button" data-action="use-family-version">Версия семьи</button><button class="primary-button" type="button" data-action="keep-my-version">Моя версия</button></div></article>` : "";
  const memberRows = members.map(member => {
    const assignedCount = state.tasks.filter(task => task.assigneeId === member.id || (!task.assigneeId && task.assignee === member.name)).length;
    return `<div class="member-row"><span class="avatar" style="background:${member.color}">${escapeHtml(member.name.slice(0,1))}</span><div class="member-copy"><strong>${escapeHtml(member.name)}</strong><span>${member.role === "owner" ? "Владелец" : "Участник"} · ${assignedCount} ${pluralize(assignedCount, "дело", "дела", "дел")}</span></div><span class="muted">${member.id === cloud.userId ? "Это вы" : "В семье"}</span></div>`;
  }).join("");
  const activityRows = recentActivity.length ? recentActivity.map(item => `<div class="activity-row"><span class="activity-check">${icon("check")}</span><div><strong>${escapeHtml(item.actorName || "Участник")} · выполнено</strong><span>${escapeHtml(item.taskTitle || "Домашнее дело")} · ${formatActivityTime(item.completedAt)}</span></div></div>`).join("") : `<div class="empty-activity">Здесь появятся выполненные семейные дела.</div>`;
  const connectedContent = `${conflict}<div class="section-head family-members-head"><h2>Участники</h2>${cloud.currentRole === "owner" ? `<button class="link-button" type="button" data-action="invite">+ Пригласить</button>` : ""}</div>${memberRows}<div class="section-head activity-head"><h2>Последние выполнения</h2></div><div class="activity-list">${activityRows}</div><div class="family-actions"><button class="secondary-button full" type="button" data-action="sync-now">${icon("history")} Синхронизировать</button><button class="text-danger-button" type="button" data-action="disconnect-family">Отключить этот телефон</button></div>`;
  const localContent = `<article class="cloud-start-card"><span class="permission-icon">${icon("users")}</span><h3>Общий дом на нескольких телефонах</h3><p>Создайте семейное пространство или подключитесь по коду. Локальные данные отправляются только после вашего действия.</p><button class="primary-button full" type="button" data-action="create-family">Создать общий дом</button><button class="secondary-button full" type="button" data-action="join-family">Ввести код приглашения</button><small>Пробный режим: без телефона и почты. Для магазинного релиза добавим восстановление доступа.</small></article>`;
  return `<main><section class="hero"><h1>Семья</h1><p>Общий ритм дома без лишних сообщений и напоминаний друг другу.</p></section><section class="family-hero"><div class="family-title-row"><div><h2>${connected ? escapeHtml(cloud.homeName || state.homeType) : "Семейная неделя"}</h2><p>${connected ? "Изменения доступны участникам общего дома." : "Сейчас всё хранится только на этом устройстве."}</p></div>${connected ? `<span class="sync-pill ${escapeHtml(cloud.status || "offline")}">${syncLabels[cloud.status] || "Подключено"}</span>` : ""}</div><div class="family-stats"><div class="family-stat"><strong>${completedThisWeek}</strong><span>за 7 дней</span></div><div class="family-stat"><strong>${state.tasks.length}</strong><span>активных дел</span></div></div></section>${connected ? connectedContent : localContent}</main>`;
}

function pluralize(number, one, few, many) {
  const mod10 = number % 10;
  const mod100 = number % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function formatActivityTime(value) {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay ? `сегодня, ${date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}` : date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function onboardingView() {
  return `<main class="onboarding"><div class="onboarding-logo">${icon("home")}</div><h1>Чтобы дома всё было вовремя.</h1><p>Пора: Дом напомнит, что заменить, почистить или проверить — и пересчитает следующий срок после выполнения.</p><div class="feature-list"><div class="feature-line"><span class="feature-check">${icon("check")}</span>Готовые домашние процедуры</div><div class="feature-line"><span class="feature-check">${icon("check")}</span>Простые статусы без чувства вины</div><div class="feature-line"><span class="feature-check">${icon("check")}</span>Работает без регистрации</div></div><button class="primary-button full" type="button" data-action="start">Настроить мой дом</button></main>`;
}

function render() {
  const app = document.querySelector("#app");
  const sponsor = sponsorBannerView();
  document.documentElement.classList.toggle("sponsor-banner-visible", Boolean(sponsor));
  if (!state.onboarded) {
    app.innerHTML = onboardingView();
  } else {
    const views = { today: todayView, home: homeView, checklists: checklistView, family: familyView };
    const fab = state.activeTab === "family" ? "" : `<button class="fab" type="button" data-action="add-task">${icon("plus")}<span>Добавить</span></button>`;
    app.innerHTML = `${header()}${(views[state.activeTab] || todayView)()}${sponsor}${fab}${nav()}`;
  }
  bindEvents();
  recordSponsorImpression();
}

function bindEvents() {
  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => {
    state.activeTab = button.dataset.tab;
    save();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  document.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", handleAction));
}

function handleAction(event) {
  const { action, id, room, filter } = event.currentTarget.dataset;
  if (action === "start") return openSetup();
  if (action === "add-task") return openTaskForm();
  if (action === "edit-task") return openTaskForm(id);
  if (action === "complete") return completeTask(id);
  if (action === "snooze") return snoozeTask(id);
  if (action === "show-all") return openTaskList("Все задачи", state.tasks);
  if (action === "show-summary") {
    const titles = { overdue: "Просроченные дела", today: "Дела на сегодня", week: "Дела на ближайшие 7 дней" };
    return openTaskList(titles[filter] || "Все задачи", summaryTasks(filter));
  }
  if (action === "open-room") return openTaskList(room, state.tasks.filter(task => task.room === room));
  if (action === "edit-room") return openRoomForm(room);
  if (action === "add-preset") return addPreset(id);
  if (action === "add-pack") return addPack(id);
  if (action === "open-pack") {
    const pack = checklistPacks.find(item => item.id === id);
    if (pack) return openTaskList(pack.name, state.tasks.filter(task => pack.items.includes(task.presetId)));
  }
  if (action === "add-room") return openRoomForm();
  if (action === "add-device") return openDeviceForm();
  if (action === "open-device") return openDeviceDetails(id);
  if (action === "edit-device") return openDeviceForm(id);
  if (action === "delete-device") return openDeleteDevice(id);
  if (action === "confirm-delete-device") return deleteDevice(id);
  if (action === "settings") return openSettings();
  if (action === "privacy") return openPrivacyPolicy();
  if (action === "invite") return openInvite();
  if (action === "create-family") return openCreateFamily();
  if (action === "join-family") return openJoinFamily();
  if (action === "sync-now") return pullCloud();
  if (action === "use-family-version") return useFamilyVersion();
  if (action === "keep-my-version") return keepMyVersion();
  if (action === "disconnect-family") return openDisconnectFamily();
  if (action === "delete-task") return openDeleteTask(id);
  if (action === "confirm-delete-task") return deleteTask(id);
  if (action === "find-store") return openPurchaseOptions(id);
  if (action === "find-nearby") return findNearbyStore(id);
}

function openModal(content) {
  const layer = document.querySelector("#modal-layer");
  const sheet = document.querySelector("#modal-content");
  resetSheetPosition();
  sheet.innerHTML = `<button class="sheet-handle" type="button" aria-label="Скрыть окно"></button>${content}`;
  layer.hidden = false;
  // Reset after the sheet is visible. Android WebView can preserve the old
  // scroll position when scrollTop is changed while an ancestor is hidden.
  sheet.scrollTop = 0;
  window.requestAnimationFrame(() => {
    if (!layer.hidden) sheet.scrollTop = 0;
  });
  document.body.style.overflow = "hidden";
  layer.querySelectorAll("[data-close-modal]").forEach(el => el.addEventListener("click", closeModal));
  layer.querySelectorAll("[data-action]").forEach(el => el.addEventListener("click", handleAction));
  enableSheetDismissGesture(layer, sheet);
}

function closeModal() {
  if (sheetDismissTimer) window.clearTimeout(sheetDismissTimer);
  sheetDismissTimer = null;
  sheetGestureCleanup?.();
  sheetGestureCleanup = null;
  document.querySelector("#modal-layer").hidden = true;
  document.body.style.overflow = "";
  resetSheetPosition();
}

function resetSheetPosition() {
  const sheet = document.querySelector("#modal-content");
  const backdrop = document.querySelector("#modal-layer .modal-backdrop");
  if (!sheet || !backdrop) return;
  sheet.classList.remove("is-dragging", "is-dismissing");
  sheet.style.removeProperty("transform");
  backdrop.style.removeProperty("opacity");
}

function enableSheetDismissGesture(layer, sheet) {
  sheetGestureCleanup?.();
  const handle = sheet.querySelector(".sheet-handle");
  const backdrop = layer.querySelector(".modal-backdrop");
  if (!handle || !backdrop) return;

  let activePointer = null;
  let startY = 0;
  let lastOffset = 0;
  let startedAt = 0;
  let dragged = false;
  let suppressClick = false;

  const restore = () => {
    sheet.classList.remove("is-dragging");
    sheet.style.removeProperty("transform");
    backdrop.style.removeProperty("opacity");
  };

  const dismiss = () => {
    sheet.classList.remove("is-dragging");
    sheet.classList.add("is-dismissing");
    sheet.style.transform = "translateY(105%)";
    backdrop.style.opacity = "0";
    sheetDismissTimer = window.setTimeout(closeModal, 210);
  };

  handle.addEventListener("pointerdown", event => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    activePointer = event.pointerId;
    startY = event.clientY;
    lastOffset = 0;
    startedAt = performance.now();
    dragged = false;
    suppressClick = false;
    sheet.classList.add("is-dragging");
    try { handle.setPointerCapture(event.pointerId); } catch {}
  });

  const moveDrag = event => {
    if (event.pointerId !== activePointer) return;
    const offset = Math.max(0, event.clientY - startY);
    if (offset > 4) dragged = true;
    if (!dragged) return;
    event.preventDefault();
    lastOffset = offset;
    sheet.style.transform = `translateY(${offset}px)`;
    backdrop.style.opacity = String(Math.max(0.18, 1 - offset / 260));
  };

  const finishDrag = (event, cancelled = false) => {
    if (event.pointerId !== activePointer) return;
    try {
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    } catch {}
    activePointer = null;
    if (!dragged) {
      sheet.classList.remove("is-dragging");
      return;
    }

    suppressClick = true;
    const duration = Math.max(1, performance.now() - startedAt);
    const fastSwipe = lastOffset / duration > 0.45;
    const threshold = Math.min(96, sheet.clientHeight * 0.18);
    if (!cancelled && (lastOffset >= threshold || (lastOffset >= 36 && fastSwipe))) dismiss();
    else restore();
  };

  const endDrag = event => finishDrag(event);
  const cancelDrag = event => finishDrag(event, true);
  document.addEventListener("pointermove", moveDrag, { passive: false });
  document.addEventListener("pointerup", endDrag);
  document.addEventListener("pointercancel", cancelDrag);
  sheetGestureCleanup = () => {
    document.removeEventListener("pointermove", moveDrag);
    document.removeEventListener("pointerup", endDrag);
    document.removeEventListener("pointercancel", cancelDrag);
  };
  handle.addEventListener("click", event => {
    if (suppressClick) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    closeModal();
  });
}

function sheetHeader(title) {
  return `<div class="sheet-header"><h2>${title}</h2><button class="close-button" type="button" data-close-modal aria-label="Закрыть">${icon("close")}</button></div>`;
}

function openSetup() {
  openModal(`${sheetHeader("Настроим быстро")}<form id="setup-form" class="form-grid"><div class="field"><label for="home-type">Что настраиваем</label><select id="home-type" name="homeType"><option>Квартира</option><option>Дом</option><option>Дача</option></select></div><div class="field"><label>Комнаты</label><div class="preset-list">${["Кухня", "Ванная", "Спальня", "Гостиная", "Прихожая"].map(room => `<label class="preset-row"><span class="room-icon">${icon("home")}</span><strong>${room}</strong><input type="checkbox" name="rooms" value="${room}" checked /></label>`).join("")}</div></div><button class="primary-button full" type="submit">Создать домашний план</button></form>`);
  document.querySelector("#setup-form").addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.homeType = form.get("homeType");
    state.rooms = form.getAll("rooms");
    if (!state.rooms.length) {
      showToast("Выберите хотя бы одну комнату");
      return;
    }
    state.tasks = seedTasks().filter(task => state.rooms.includes(task.room));
    state.onboarded = true;
    save();
    closeModal();
    render();
    showToast("Дом настроен — добавили первые процедуры");
  });
}

function openTaskForm(editId = null) {
  const task = editId ? state.tasks.find(item => item.id === editId) : null;
  const dateValue = task ? new Date(task.dueDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const actionValue = task?.action || "Заменить";
  const roomValue = task?.room || state.rooms[0];
  const assignees = availableAssignees();
  const currentAssigneeId = task?.assigneeId || (cloud.homeId && task?.assignee === "Вы" ? cloud.userId : assignees.find(member => member.name === task?.assignee)?.id) || assignees[0]?.id || "me";
  const options = (values, current) => values.map(value => `<option ${value === current ? "selected" : ""}>${escapeHtml(value)}</option>`).join("");
  const assigneeOptions = assignees.map(member => `<option value="${escapeHtml(member.id)}" ${member.id === currentAssigneeId ? "selected" : ""}>${escapeHtml(member.name)}</option>`).join("");
  openModal(`${sheetHeader(task ? "Настроить дело" : "Новое домашнее дело")}<form id="task-form" class="form-grid"><div class="field"><label for="task-title">Что нужно сделать</label><input id="task-title" name="title" maxlength="70" placeholder="Например, заменить фильтр" value="${escapeHtml(task?.title || "")}" required /></div><div class="two-cols"><div class="field"><label for="task-action">Действие</label><select id="task-action" name="action">${options(["Заменить", "Почистить", "Проверить", "Пополнить"], actionValue)}</select></div><div class="field"><label for="task-room">Комната</label><select id="task-room" name="room">${options(state.rooms, roomValue)}</select></div></div><div class="field"><label for="task-assignee">Кто отвечает</label><select id="task-assignee" name="assigneeId">${assigneeOptions}</select></div><div class="two-cols"><div class="field"><label for="task-date">Следующий срок</label><input id="task-date" name="dueDate" type="date" value="${dateValue}" required /></div><div class="field"><label for="task-interval">Повторять, дней</label><input id="task-interval" name="intervalDays" type="number" min="1" max="3650" value="${task?.intervalDays || 30}" required /></div></div><div class="field"><label for="task-lead">Напомнить заранее, дней</label><input id="task-lead" name="leadDays" type="number" min="0" max="365" value="${task?.leadDays ?? 3}" required /></div><div class="field"><label for="task-note">Заметка, необязательно</label><textarea id="task-note" name="note" placeholder="Модель, размер или полезная деталь">${escapeHtml(task?.note || "")}</textarea></div>${task ? `<div class="history-note">Выполнено раз: ${(task.history || []).length}${task.lastDone ? ` · последний раз ${new Intl.DateTimeFormat("ru-RU").format(new Date(task.lastDone))}` : ""}</div>${["Заменить", "Пополнить"].includes(task.action) ? `<button class="store-button" type="button" data-action="find-store" data-id="${task.id}">${icon("map")}Где купить</button>` : ""}` : ""}<div class="form-actions"><button class="secondary-button" type="button" data-close-modal>Отмена</button><button class="primary-button" type="submit">${task ? "Сохранить" : "Добавить"}</button></div>${task ? `<button class="danger-button" type="button" data-action="delete-task" data-id="${task.id}">Удалить дело</button>` : ""}</form>`);
  document.querySelector("#task-form").addEventListener("submit", event => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const selectedAssignee = assignees.find(member => member.id === form.assigneeId) || assignees[0] || { id: "me", name: "Вы" };
    const values = { title: form.title.trim(), action: form.action, room: form.room, dueDate: new Date(`${form.dueDate}T12:00:00`).toISOString(), intervalDays: Number(form.intervalDays), leadDays: Number(form.leadDays), note: form.note.trim(), assigneeId: selectedAssignee.id, assignee: selectedAssignee.name, icon: form.action === "Почистить" ? "sparkles" : form.action === "Проверить" ? "clock" : "filter" };
    if (task) Object.assign(task, values);
    else state.tasks.push({ id: `task-${Date.now()}`, ...values, lastDone: null, history: [] });
    save(); closeModal(); render(); showToast(task ? "Изменения сохранены" : "Дело добавлено");
  });
}

function deleteTask(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  state.tasks = state.tasks.filter(item => item.id !== id);
  save(); closeModal(); render(); showToast("Дело удалено");
}

function openDeleteTask(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  const note = task.deviceId
    ? "Само устройство останется в домашнем плане. Процедуру можно будет добавить снова в настройках устройства."
    : task.presetId
      ? "Эту процедуру можно будет снова добавить из каталога чек-листов."
      : "Удалённую задачу нельзя восстановить.";
  openModal(`${sheetHeader("Удалить задачу?")}<div class="delete-task-preview"><span class="task-icon">${icon(task.icon || "clock")}</span><div><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.room)}</span></div></div><div class="confirm-copy"><p>${note}</p></div><div class="two-cols"><button class="secondary-button" type="button" data-close-modal>Отмена</button><button class="danger-button compact" type="button" data-action="confirm-delete-task" data-id="${task.id}">${icon("trash")} Удалить</button></div>`);
}

function completeTask(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  const completedAt = new Date().toISOString();
  task.history = [...(task.history || []), completedAt];
  task.lastDone = completedAt;
  task.dueDate = addDays(new Date(), task.intervalDays);
  state.completedThisWeek += 1;
  state.activity = [...(state.activity || []), {
    id: `activity-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: "completed",
    taskId: task.id,
    taskTitle: task.title,
    actorId: cloud.userId || "me",
    actorName: cloud.displayName || "Вы",
    completedAt
  }].slice(-100);
  save();
  if (!document.querySelector("#modal-layer").hidden) closeModal();
  render(); showToast(`Готово. Следующий срок — через ${task.intervalDays} дн.`);
}

function snoozeTask(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  task.dueDate = addDays(new Date(task.dueDate), 1);
  save();
  if (!document.querySelector("#modal-layer").hidden) closeModal();
  render(); showToast("Отложили на завтра");
}

function addPreset(id, silent = false) {
  const preset = presets.find(item => item.id === id);
  if (!preset || state.tasks.some(task => task.presetId === id)) return false;
  const assigned = availableAssignees().find(member => member.id === (cloud.userId || "me")) || availableAssignees()[0] || { id: "me", name: "Вы" };
  state.tasks.push({ ...preset, id: `task-${Date.now()}-${Math.random().toString(16).slice(2)}`, presetId: id, dueDate: addDays(new Date(), preset.leadDays || 1), lastDone: null, history: [], assigneeId: assigned.id, assignee: assigned.name, note: "" });
  save();
  if (!silent) { render(); showToast("Процедура добавлена"); }
  return true;
}

function addPack(id) {
  const pack = checklistPacks.find(item => item.id === id);
  if (!pack) return;
  const count = pack.items.reduce((sum, presetId) => sum + (addPreset(presetId, true) ? 1 : 0), 0);
  render(); showToast(count ? `Добавлено процедур: ${count}` : "Все процедуры уже добавлены");
}

function openTaskList(title, tasks) {
  const sorted = [...tasks].sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
  openModal(`${sheetHeader(escapeHtml(title))}${sorted.length ? `<div class="task-list">${sorted.map(taskCard).join("")}</div>` : `<div class="empty-state"><p>Здесь пока нет домашних дел.</p></div>`}`);
}

function openRoomForm(existingRoom = null) {
  openModal(`${sheetHeader(existingRoom ? "Название помещения" : "Новая комната")}<form id="room-form" class="form-grid"><div class="field"><label for="room-name">Название</label><input id="room-name" name="room" maxlength="30" placeholder="Например, Детская" value="${escapeHtml(existingRoom || "")}" required /></div>${existingRoom ? `<p class="muted">Все дела из «${escapeHtml(existingRoom)}» автоматически останутся в переименованном помещении.</p>` : ""}<button class="primary-button full" type="submit">${existingRoom ? "Сохранить название" : "Добавить комнату"}</button></form>`);
  document.querySelector("#room-form").addEventListener("submit", event => {
    event.preventDefault();
    const room = new FormData(event.currentTarget).get("room").trim();
    const duplicate = state.rooms.some(item => item.toLocaleLowerCase("ru-RU") === room.toLocaleLowerCase("ru-RU") && item !== existingRoom);
    if (duplicate) {
      showToast("Такое помещение уже есть");
      return;
    }
    if (existingRoom) {
      const index = state.rooms.indexOf(existingRoom);
      if (index !== -1) state.rooms[index] = room;
      state.tasks.forEach(task => { if (task.room === existingRoom) task.room = room; });
      (state.devices || []).forEach(device => { if (device.room === existingRoom) device.room = room; });
    } else if (room) {
      state.rooms.push(room);
    }
    save(); closeModal(); render(); showToast(existingRoom ? "Название помещения изменено" : "Комната добавлена");
  });
}

function createDeviceProcedureTask(device, procedure) {
  const assigned = availableAssignees().find(member => member.id === (cloud.userId || "me")) || availableAssignees()[0] || { id: "me", name: "Вы" };
  const installedAt = new Date(`${device.installedAt}T12:00:00`);
  const noteParts = [deviceDisplayName(device), device.model !== "Другая модель" ? device.model : ""].filter(Boolean);
  return {
    id: `task-device-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    deviceId: device.id,
    deviceProcedureId: procedure.id,
    title: procedure.title,
    action: procedure.action,
    room: device.room,
    dueDate: addDays(Number.isNaN(installedAt.getTime()) ? new Date() : installedAt, procedure.intervalDays),
    intervalDays: procedure.intervalDays,
    leadDays: procedure.leadDays,
    icon: procedure.icon,
    note: noteParts.join(" · "),
    lastDone: null,
    history: [],
    assigneeId: assigned.id,
    assignee: assigned.name
  };
}

function openDeviceForm(editId = null) {
  const existing = editId ? deviceById(editId) : null;
  const currentType = existing?.type || deviceCatalog[0].id;
  const installedAt = existing?.installedAt || new Date().toISOString().slice(0, 10);
  const typeOptions = deviceCatalog.map(item => `<option value="${item.id}" ${item.id === currentType ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("");
  const roomOptions = state.rooms.map(room => `<option ${room === (existing?.room || state.rooms[0]) ? "selected" : ""}>${escapeHtml(room)}</option>`).join("");
  openModal(`${sheetHeader(existing ? "Настроить устройство" : "Добавить устройство")}<form id="device-form" class="form-grid"><div class="field"><label for="device-type">Тип устройства</label><select id="device-type" name="type" ${existing ? "disabled" : ""}>${typeOptions}</select>${existing ? `<input type="hidden" name="type" value="${escapeHtml(existing.type)}" />` : ""}</div><div class="field"><label for="device-model">Марка или семейство</label><select id="device-model" name="model"></select></div><div class="field"><label for="device-name">Как называть, необязательно</label><input id="device-name" name="name" maxlength="50" value="${escapeHtml(existing?.name || "")}" placeholder="Например, Робот на кухне" /></div><div class="two-cols"><div class="field"><label for="device-room">Где находится</label><select id="device-room" name="room">${roomOptions}</select></div><div class="field"><label for="device-installed">Установлено</label><input id="device-installed" name="installedAt" type="date" value="${installedAt}" required /></div></div><div class="field"><label>Рекомендуемые процедуры</label><div id="device-procedures" class="procedure-options"></div></div><div class="privacy-note">${icon("clock")} Сроки ориентировочные. После добавления каждое дело можно открыть и настроить по инструкции вашего устройства.</div><div class="form-actions"><button class="secondary-button" type="button" data-close-modal>Отмена</button><button class="primary-button" type="submit">${existing ? "Сохранить" : "Добавить"}</button></div></form>`);

  const formElement = document.querySelector("#device-form");
  const typeSelect = document.querySelector("#device-type");
  const modelSelect = document.querySelector("#device-model");
  const proceduresElement = document.querySelector("#device-procedures");
  const existingProcedures = new Set(state.tasks.filter(task => task.deviceId === existing?.id).map(task => task.deviceProcedureId));

  const updateCatalogFields = (keepModel = false) => {
    const category = deviceCategory(existing?.type || typeSelect.value) || deviceCatalog[0];
    const selectedModel = keepModel ? modelSelect.value : existing?.model;
    modelSelect.innerHTML = category.models.map(model => `<option ${model === selectedModel ? "selected" : ""}>${escapeHtml(model)}</option>`).join("");
    proceduresElement.innerHTML = category.procedures.map(procedure => {
      const alreadyAdded = existingProcedures.has(procedure.id);
      const checked = existing ? alreadyAdded : true;
      return `<label class="procedure-option"><span class="procedure-icon">${icon(procedure.icon)}</span><span><strong>${escapeHtml(procedure.title)}</strong><small>Каждые ${procedure.intervalDays} дн.${alreadyAdded ? " · уже добавлено" : ""}</small></span><input type="checkbox" name="procedures" value="${procedure.id}" ${checked ? "checked" : ""} ${alreadyAdded ? "disabled" : ""} /></label>`;
    }).join("");
  };
  updateCatalogFields(false);
  if (!existing) typeSelect.addEventListener("change", () => updateCatalogFields(false));

  formElement.addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const category = deviceCategory(existing?.type || form.get("type"));
    if (!category) return showToast("Выберите тип устройства");
    const values = {
      type: category.id,
      model: String(form.get("model") || category.models[0]),
      name: String(form.get("name") || "").trim(),
      room: String(form.get("room") || state.rooms[0]),
      installedAt: String(form.get("installedAt") || new Date().toISOString().slice(0, 10))
    };
    const selectedProcedures = new Set(form.getAll("procedures"));
    let device;
    if (existing) {
      const installedAtChanged = existing.installedAt !== values.installedAt;
      Object.assign(existing, values);
      device = existing;
      state.tasks.filter(task => task.deviceId === device.id).forEach(task => {
        task.room = device.room;
        task.note = [deviceDisplayName(device), device.model !== "Другая модель" ? device.model : ""].filter(Boolean).join(" · ");
        const procedure = category.procedures.find(item => item.id === task.deviceProcedureId);
        if (installedAtChanged && procedure && !(task.history || []).length) task.dueDate = addDays(new Date(`${device.installedAt}T12:00:00`), procedure.intervalDays);
      });
    } else {
      device = { id: `device-${Date.now()}-${Math.random().toString(16).slice(2)}`, ...values };
      state.devices = [...(state.devices || []), device];
    }
    const linkedProcedures = new Set(state.tasks.filter(task => task.deviceId === device.id).map(task => task.deviceProcedureId));
    category.procedures.filter(procedure => selectedProcedures.has(procedure.id) && !linkedProcedures.has(procedure.id)).forEach(procedure => state.tasks.push(createDeviceProcedureTask(device, procedure)));
    save(); closeModal(); render(); showToast(existing ? "Устройство обновлено" : "Устройство добавлено — дела запланированы");
  });
}

function openDeviceDetails(id) {
  const device = deviceById(id);
  if (!device) return;
  const category = deviceCategory(device.type) || { title: "Устройство", icon: "appliance" };
  const tasks = state.tasks.filter(task => task.deviceId === id).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const installed = new Intl.DateTimeFormat("ru-RU").format(new Date(`${device.installedAt}T12:00:00`));
  openModal(`${sheetHeader(deviceDisplayName(device))}<div class="device-profile"><span class="device-profile-icon">${icon(category.icon)}</span><div><strong>${escapeHtml(category.title)}</strong><span>${escapeHtml(device.model)} · ${escapeHtml(device.room)}</span><small>Добавлено в план: ${installed}</small></div></div><div class="section-head"><h2>Обслуживание</h2><button class="link-button" type="button" data-action="edit-device" data-id="${device.id}">${icon("edit")} Настроить</button></div>${tasks.length ? `<div class="task-list">${tasks.map(taskCard).join("")}</div>` : `<div class="empty-state"><p>Для устройства пока нет процедур. Добавьте их через настройки устройства.</p></div>`}<button class="danger-button" type="button" data-action="delete-device" data-id="${device.id}">Удалить устройство</button>`);
}

function openDeleteDevice(id) {
  const device = deviceById(id);
  if (!device) return;
  const taskCount = state.tasks.filter(task => task.deviceId === id).length;
  openModal(`${sheetHeader("Удалить устройство?")}<div class="confirm-copy"><p>«${escapeHtml(deviceDisplayName(device))}» и ${taskCount} ${pluralize(taskCount, "связанное дело", "связанных дела", "связанных дел")} будут удалены из домашнего плана.</p></div><div class="two-cols"><button class="secondary-button" type="button" data-close-modal>Отмена</button><button class="danger-button compact" type="button" data-action="confirm-delete-device" data-id="${device.id}">Удалить</button></div>`);
}

function deleteDevice(id) {
  const device = deviceById(id);
  if (!device) return;
  state.devices = (state.devices || []).filter(item => item.id !== id);
  state.tasks = state.tasks.filter(task => task.deviceId !== id);
  save(); closeModal(); render(); showToast("Устройство и связанные дела удалены");
}

function openSettings() {
  const notificationState = getNotificationState();
  openModal(`${sheetHeader("Настройки")}<div class="form-grid"><section class="settings-section"><h3>Оформление</h3><p>Выберите настроение приложения. Функции и контрастность останутся одинаковыми.</p><div class="theme-grid">${themeButton("balanced", "Свежий", ["#123f3a", "#f16f55", "#edf3f0"])}${themeButton("soft", "Нежный", ["#765a70", "#dda29c", "#f5eaef"])}${themeButton("workshop", "Мастерская", ["#263d49", "#b8683f", "#e4e9e8"])}</div></section><section class="settings-section"><h3>Напоминания</h3><div class="permission-row"><span class="permission-icon">${icon("bell")}</span><div class="permission-copy"><strong>Уведомления о делах</strong><span>${notificationState.description}</span></div><span class="status-badge ${notificationState.on ? "on" : ""}">${notificationState.label}</span></div><div class="field"><label for="notification-time">Удобное время</label><input id="notification-time" type="time" value="${state.notificationTime}" /></div><div class="two-cols"><button class="secondary-button" type="button" id="request-notifications">${notificationState.on && reminderPlugin() ? "Выключить" : "Разрешить"}</button><button class="secondary-button" type="button" id="test-notification" ${notificationState.on ? "" : "disabled"}>Проверить</button></div><p>Android проверяет сроки в фоне примерно в выбранное время. Точный момент может немного сдвигаться для экономии батареи.</p></section><section class="settings-section"><h3>Данные</h3><button class="secondary-button full" type="button" id="export-data">Скачать резервную копию</button><p>Версия 1.0.1 · ${FAMILY_SYNC_ENABLED && cloud.homeId ? "дом синхронизируется с семейным пространством" : "задачи сохраняются только на этом устройстве"}.</p></section><section class="settings-section"><h3>О приложении</h3><button class="secondary-button full" type="button" data-action="privacy">Политика конфиденциальности</button>${SUPPORT_EMAIL ? `<a class="secondary-button full settings-link" href="mailto:${escapeHtml(SUPPORT_EMAIL)}">Написать в поддержку</a>` : ""}<p>«Пора: Дом» помогает не забывать о регулярном уходе за домом и техникой.</p></section><button class="secondary-button full" type="button" id="reset-app">Удалить все данные на устройстве</button></div>`);
  document.querySelectorAll("[data-theme-option]").forEach(button => button.addEventListener("click", () => {
    state.theme = button.dataset.themeOption;
    applyTheme(state.theme); save(); closeModal(); render(); openSettings();
  }));
  document.querySelector("#notification-time").addEventListener("change", event => {
    state.notificationTime = event.target.value; save(); showToast("Время напоминаний сохранено");
  });
  document.querySelector("#request-notifications").addEventListener("click", toggleNotifications);
  document.querySelector("#test-notification").addEventListener("click", () => sendDueNotification(true));
  document.querySelector("#export-data").addEventListener("click", exportData);
  document.querySelector("#reset-app").addEventListener("click", () => {
    if (cloud.homeId) return showToast("Сначала отключите общий дом в разделе «Семья»");
    localStorage.removeItem(STORAGE_KEY); state = initialState(); syncNativeReminders(); closeModal(); render(); showToast("Данные удалены с устройства");
  });
}

function themeButton(id, label, colors) {
  return `<button class="theme-option ${state.theme === id ? "active" : ""}" type="button" data-theme-option="${id}"><span class="theme-swatches">${colors.map(color => `<i class="theme-swatch" style="background:${color}"></i>`).join("")}</span><span>${label}</span></button>`;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "balanced" ? "" : theme;
}

function getNotificationState() {
  if (reminderPlugin()) {
    if (nativeNotificationPermission === "granted" && state.notificationsEnabled) return { on: true, label: "Включены", description: `Android напомнит примерно в ${state.notificationTime}` };
    if (nativeNotificationPermission === "denied") return { on: false, label: "Запрещены", description: "Разрешение можно изменить в настройках телефона" };
    return { on: false, label: "Выключены", description: "Включаются только после вашего подтверждения" };
  }
  if (!("Notification" in window)) return { on: false, label: "Недоступно", description: "Этот браузер не поддерживает уведомления" };
  if (Notification.permission === "granted") return { on: true, label: "Включены", description: `Будем напоминать около ${state.notificationTime}` };
  if (Notification.permission === "denied") return { on: false, label: "Запрещены", description: "Разрешение можно изменить в настройках браузера" };
  return { on: false, label: "Выключены", description: "Разрешение запрашивается только по вашей кнопке" };
}

async function toggleNotifications() {
  const plugin = reminderPlugin();
  if (plugin) {
    if (state.notificationsEnabled && nativeNotificationPermission === "granted") {
      state.notificationsEnabled = false;
      state.notificationPermissionAsked = true;
      save();
      showToast("Напоминания выключены");
      closeModal(); render(); openSettings();
      return;
    }
    await requestNativeNotificationPermission();
    return;
  }
  return requestBrowserNotifications();
}

async function requestNativeNotificationPermission({ automatic = false } = {}) {
  const plugin = reminderPlugin();
  if (!plugin) return false;
  try {
    const result = await plugin.requestPermissions({ permissions: ["notifications"] });
    nativeNotificationPermission = result.notifications || "denied";
    state.notificationPermissionAsked = true;
    state.notificationsEnabled = nativeNotificationPermission === "granted";
    save();
    if (state.notificationsEnabled) {
      showToast("Напоминания включены");
      if (!automatic && !document.querySelector("#modal-layer").hidden) {
        closeModal(); render(); openSettings();
      }
    } else if (!automatic) {
      showToast("Android не разрешил уведомления");
    }
    return state.notificationsEnabled;
  } catch {
    if (!automatic) showToast("Не удалось запросить разрешение");
    return false;
  }
}

async function requestNotificationsOnFirstLaunch() {
  const plugin = reminderPlugin();
  if (!plugin || state.notificationPermissionAsked) return;
  if (nativeNotificationPermission === "prompt") {
    await requestNativeNotificationPermission({ automatic: true });
    return;
  }
  // The system has already made a decision (for example, permission was
  // denied outside the app). Do not nag on every launch; Settings remains
  // available for a deliberate retry.
  state.notificationPermissionAsked = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function requestBrowserNotifications() {
  if (!("Notification" in window)) return showToast("Уведомления не поддерживаются");
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    showToast("Уведомления включены");
    closeModal(); render(); openSettings();
  } else showToast("Браузер не разрешил уведомления");
}

async function sendDueNotification(force = false) {
  const plugin = reminderPlugin();
  if (plugin) {
    if (!force) return;
    if (!state.notificationsEnabled || nativeNotificationPermission !== "granted") return showToast("Сначала разрешите уведомления");
    try {
      await plugin.showTest();
      showToast("Тестовое уведомление отправлено");
    } catch {
      showToast("Не удалось показать уведомление");
    }
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "granted") {
    if (force) showToast("Сначала разрешите уведомления");
    return;
  }
  const todayKey = new Date().toISOString().slice(0, 10);
  if (!force && state.notificationLog[todayKey]) return;
  if (!force) {
    const [hours, minutes] = state.notificationTime.split(":").map(Number);
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() < hours * 60 + minutes) return;
  }
  const urgent = state.tasks.filter(task => dueInfo(task).days <= Number(task.leadDays || 3));
  const task = urgent[0];
  const title = force ? "Пора: Дом — проверка" : task ? task.title : "Сегодня дома всё спокойно";
  const body = force ? "Уведомления настроены правильно." : task ? `${task.room} · ${dueInfo(task).label}` : "Новых срочных дел нет.";
  const registration = await navigator.serviceWorker?.ready;
  if (registration) await registration.showNotification(title, { body, icon: "assets/icon-192.png", badge: "assets/icon-192.png", tag: force ? "pora-test" : `pora-${todayKey}`, data: { taskId: task?.id || null } });
  else new Notification(title, { body, icon: "assets/icon-192.png" });
  if (!force) { state.notificationLog[todayKey] = true; save(); }
  if (force) showToast("Тестовое уведомление отправлено");
}

function openPrivacyPolicy() {
  const support = SUPPORT_EMAIL
    ? `<p><strong>Контакт разработчика:</strong> <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a></p>`
    : `<p><strong>Контакт разработчика:</strong> указан в карточке приложения в магазине.</p>`;
  openModal(`${sheetHeader("Конфиденциальность")}<article class="legal-copy"><p class="legal-updated">Редакция от 9 ноября 2026 года</p><h3>Какие данные используются</h3><p>Комнаты, устройства, задачи, сроки и история выполнений сохраняются локально на вашем телефоне. Приложение не отправляет их рекламным партнёрам.</p><h3>Резервная копия</h3><p>Файл создаётся только по вашей команде. Вы сами выбираете, где его хранить и кому передавать.</p><h3>Напоминания</h3><p>Android получает локальный список сроков, чтобы показывать уведомления при закрытом приложении. Эти сведения не покидают устройство.</p><h3>Реклама</h3><p>В приложении могут использоваться рекламные SDK нескольких сетей и размеченные предложения прямых партнёров. Они могут обрабатывать технические сведения об устройстве, соединении, рекламные идентификаторы, показы и переходы. Комнаты, список домашних дел, заметки и адрес партнёрам не передаются.</p><h3>Поиск магазинов</h3><p>Поиск рядом запускается только после вашего действия. В первом релизе приложение открывает внешний картографический сервис и не хранит координаты.</p><h3>Удаление данных</h3><p>Все локальные данные можно удалить в настройках приложения или системной кнопкой очистки данных Android.</p>${support}</article>`);
}

function storeSearchQuery(task) {
  const title = task.title.toLocaleLowerCase("ru-RU");
  if (title.includes("фильтр воды")) return "магазин фильтров для воды";
  if (title.includes("батар")) return "магазин батареек";
  if (title.includes("щёт")) return "магазин товаров для дома";
  if (title.includes("губ")) return "хозяйственный магазин";
  return `магазин ${task.title.replace(/^(заменить|пополнить)\s+/i, "")}`;
}

function offerContext(task) {
  const device = task.deviceId ? deviceById(task.deviceId) : null;
  const title = task.title.toLocaleLowerCase("ru-RU");
  let category = device?.type || "household";
  if (!device) {
    if (title.includes("робот") || title.includes("пылесос")) category = "robot-vacuum";
    else if (title.includes("кофемаш")) category = "coffee-machine";
    else if (title.includes("очистител") && title.includes("воздух")) category = "air-purifier";
    else if (title.includes("кондиционер")) category = "conditioner";
    else if (title.includes("стиральн")) category = "washer";
    else if (title.includes("фильтр воды") || title.includes("картридж")) category = "water-filter";
    else if (title.includes("датчик") || title.includes("батар")) category = "safety-sensor";
  }
  const brand = device?.model && device.model !== "Другая модель" ? device.model : "";
  return { category, brand };
}

async function openPurchaseOptions(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  const context = offerContext(task);
  openModal(`${sheetHeader("Где купить")}<div class="empty-state"><div class="big-icon">${icon("clock")}</div><h3>Ищем подходящие предложения…</h3><p>Покажем только варианты для этого домашнего дела.</p></div>`);
  let offers = [];
  try {
    const query = new URLSearchParams({ category: context.category, ...(context.brand ? { brand: context.brand } : {}) });
    const response = await fetch(monetizationUrl(`/api/v1/offers?${query}`));
    if (response.ok) offers = (await response.json()).items || [];
  } catch {}
  const partnerOffers = offers.length ? `<section class="partner-offers" aria-label="Предложения партнёров">${offers.map(offer => `<a class="partner-offer" href="${escapeHtml(monetizationUrl(`/api/v1/offers/${encodeURIComponent(offer.id)}/go?placement=task_details`))}" target="_blank" rel="sponsored noopener noreferrer"><span class="partner-disclosure">Реклама · ${escapeHtml(offer.partnerName)}</span><strong>${escapeHtml(offer.title)}</strong>${offer.description ? `<p>${escapeHtml(offer.description)}</p>` : ""}<span class="partner-offer-footer">${offer.priceLabel ? `<b>${escapeHtml(offer.priceLabel)}</b>` : ""}<span>Перейти ${icon("chevron")}</span></span></a>`).join("")}</section>` : `<div class="partner-empty"><strong>Партнёрских предложений пока нет</strong><p>Подключим их после одобрения приложения в CPA-сети. Обычный поиск магазинов уже доступен.</p></div>`;
  openModal(`${sheetHeader("Где купить")}<div class="purchase-context"><span class="task-icon">${icon(task.icon || "filter")}</span><div><strong>${escapeHtml(task.title)}</strong><p>${context.brand ? `${escapeHtml(context.brand)} · ` : ""}${escapeHtml(task.room)}</p></div></div>${partnerOffers}<button class="secondary-button full nearby-button" type="button" data-action="find-nearby" data-id="${task.id}">${icon("map")} Найти обычные магазины рядом</button><p class="privacy-note">Переход учитывается обезличенно. Имя, домашние дела и адрес партнёру не передаются.</p>`);
}

async function findNearbyStore(id) {
  const task = state.tasks.find(item => item.id === id);
  if (!task) return;
  const query = storeSearchQuery(task);
  const openMap = async coords => {
    const ll = coords ? `&ll=${coords.longitude},${coords.latitude}&z=13` : "";
    let target = `https://yandex.ru/maps/?text=${encodeURIComponent(query)}${ll}`;
    if (coords) {
      try {
        const response = await fetch(apiUrl(`/api/v1/stores/nearby?lat=${encodeURIComponent(coords.latitude)}&lon=${encodeURIComponent(coords.longitude)}&q=${encodeURIComponent(query)}`));
        if (response.ok) {
          const result = await response.json();
          target = result.externalUrl || target;
          if (result.items?.length) return openStoreResults(result.items, target);
        }
      } catch {}
    }
    window.open(target, "_blank", "noopener");
    showToast("Открываем поиск рядом — координаты не сохраняются");
  };
  if (!navigator.geolocation) return openMap(null);
  showToast("Разрешите примерное местоположение для поиска рядом");
  navigator.geolocation.getCurrentPosition(position => openMap(position.coords), () => openMap(null), { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 });
}

function openStoreResults(items, externalUrl) {
  openModal(`${sheetHeader("Где купить рядом")}<div class="preset-list">${items.map(item => `<a class="preset-row" href="${escapeHtml(item.url || externalUrl)}" target="_blank" rel="noopener noreferrer"><span class="room-icon">${icon("map")}</span><span><strong>${escapeHtml(item.name || "Магазин")}</strong><p>${escapeHtml(item.address || "Адрес на карте")}</p></span>${icon("chevron")}</a>`).join("")}</div><a class="secondary-button full" style="margin-top:12px;text-decoration:none" href="${escapeHtml(externalUrl)}" target="_blank" rel="noopener noreferrer">Показать все на карте</a>`);
}

async function cloudRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: { "Content-Type": "application/json", ...(cloud.token ? { Authorization: `Bearer ${cloud.token}` } : {}), ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "request_failed");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function setCloudHome(home, session = {}) {
  cloud = {
    ...cloud,
    ...session,
    homeId: home.id,
    homeName: home.name,
    version: home.version,
    currentRole: home.currentRole,
    members: home.members || [],
    lastSyncedAt: new Date().toISOString(),
    lastSnapshot: snapshotKey(home.snapshot),
    status: "synced",
    conflict: null
  };
  saveCloud();
}

function applyCloudHome(home, session = {}) {
  const deviceSettings = { theme: state.theme, notificationTime: state.notificationTime, notificationLog: state.notificationLog };
  state = { ...initialState(), ...state, ...home.snapshot, ...deviceSettings, onboarded: true, activeTab: "family" };
  setCloudHome(home, session);
  save({ sync: false });
  applyTheme(state.theme);
  render();
}

async function createAnonymousSession(displayName) {
  const response = await fetch(apiUrl("/api/v1/session"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName }) });
  if (!response.ok) throw new Error("session_failed");
  return response.json();
}

function openCreateFamily() {
  openModal(`${sheetHeader("Создать общий дом")}<form id="family-create-form" class="form-grid"><div class="field"><label for="family-name">Название дома</label><input id="family-name" name="homeName" maxlength="60" value="${escapeHtml(state.homeType)}" placeholder="Например, Дом Ивановых" required /></div><div class="field"><label for="family-owner-name">Как вас показывать семье</label><input id="family-owner-name" name="displayName" maxlength="40" placeholder="Например, Лена" required /></div><div class="privacy-note">${icon("users")} Комнаты, устройства и дела будут отправлены в семейное пространство. Уведомления и выбранная тема останутся только на этом телефоне.</div><button class="primary-button full" type="submit">Создать и синхронизировать</button></form>`);
  document.querySelector("#family-create-form").addEventListener("submit", async event => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('[type="submit"]');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    submit.disabled = true; submit.textContent = "Создаём…";
    try {
      const session = await createAnonymousSession(form.displayName.trim());
      cloud = { ...cloud, token: session.token, userId: session.id, displayName: session.displayName };
      state.tasks.forEach(task => {
        if (!task.assigneeId || task.assigneeId === "me") {
          task.assigneeId = session.id;
          task.assignee = session.displayName;
        }
      });
      save({ sync: false });
      const home = await cloudRequest("/api/v1/homes", { method: "POST", body: JSON.stringify({ name: form.homeName.trim(), snapshot: sharedSnapshot() }) });
      setCloudHome(home, { token: session.token, userId: session.id, displayName: session.displayName });
      closeModal(); render(); showToast("Общий дом создан и синхронизирован");
    } catch {
      submit.disabled = false; submit.textContent = "Попробовать ещё раз"; showToast("Не удалось подключиться к серверу");
    }
  });
}

function openJoinFamily(prefilledCode = "") {
  openModal(`${sheetHeader("Подключиться к дому")}<form id="family-join-form" class="form-grid"><div class="field"><label for="family-code">Код приглашения</label><input id="family-code" name="code" maxlength="24" value="${escapeHtml(prefilledCode)}" placeholder="Например, A1B2C3" autocapitalize="characters" required /></div><div class="field"><label for="family-member-name">Ваше имя в семье</label><input id="family-member-name" name="displayName" maxlength="40" placeholder="Например, Алексей" required /></div><div class="privacy-note">${icon("history")} После подключения задачи общего дома заменят текущий локальный список. Резервную копию можно заранее скачать в настройках.</div><button class="primary-button full" type="submit">Подключиться</button></form>`);
  document.querySelector("#family-join-form").addEventListener("submit", async event => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('[type="submit"]');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    submit.disabled = true; submit.textContent = "Подключаем…";
    try {
      const session = await createAnonymousSession(form.displayName.trim());
      cloud = { ...cloud, token: session.token, userId: session.id, displayName: session.displayName };
      const home = await cloudRequest(`/api/v1/invites/${encodeURIComponent(form.code.trim().toUpperCase())}/join`, { method: "POST", body: "{}" });
      applyCloudHome(home, { token: session.token, userId: session.id, displayName: session.displayName });
      closeModal(); render(); showToast("Вы подключились к общему дому");
      history.replaceState({}, "", location.pathname);
    } catch (error) {
      submit.disabled = false; submit.textContent = "Попробовать ещё раз";
      showToast(error.status === 404 ? "Код недействителен или уже истёк" : "Не удалось подключиться к серверу");
    }
  });
}

async function pushCloud({ forceVersion } = {}) {
  if (!cloud.token || !cloud.homeId || syncInFlight) return;
  syncInFlight = true;
  cloud.status = "syncing";
  if (state.activeTab === "family" && document.querySelector("#modal-layer").hidden) render();
  try {
    const snapshot = sharedSnapshot();
    const home = await cloudRequest(`/api/v1/homes/${encodeURIComponent(cloud.homeId)}/snapshot`, { method: "PUT", body: JSON.stringify({ version: forceVersion ?? cloud.version, snapshot }) });
    setCloudHome(home);
    if (state.activeTab === "family" && document.querySelector("#modal-layer").hidden) render();
  } catch (error) {
    if (error.status === 409 && error.payload?.current) {
      cloud.status = "conflict";
      cloud.conflict = error.payload.current;
    } else cloud.status = navigator.onLine ? "error" : "offline";
    saveCloud();
    if (state.activeTab === "family" && document.querySelector("#modal-layer").hidden) render();
  } finally {
    syncInFlight = false;
  }
}

async function pullCloud(manual = true) {
  if (!cloud.token || !cloud.homeId || syncInFlight) return;
  if (snapshotKey() !== cloud.lastSnapshot) {
    await pushCloud();
    if (manual && cloud.status === "synced") showToast("Все изменения сохранены");
    return;
  }
  syncInFlight = true; cloud.status = "syncing";
  if (state.activeTab === "family" && document.querySelector("#modal-layer").hidden) render();
  try {
    const home = await cloudRequest(`/api/v1/homes/${encodeURIComponent(cloud.homeId)}`);
    if (home.version !== cloud.version || snapshotKey(home.snapshot) !== cloud.lastSnapshot) applyCloudHome(home);
    else { setCloudHome(home); if (state.activeTab === "family" && document.querySelector("#modal-layer").hidden) render(); }
    if (manual) showToast("Дом синхронизирован");
  } catch {
    cloud.status = navigator.onLine ? "error" : "offline"; saveCloud();
    if (state.activeTab === "family" && document.querySelector("#modal-layer").hidden) render();
    if (manual) showToast("Сейчас нет связи с семейным домом");
  } finally { syncInFlight = false; }
}

function useFamilyVersion() {
  if (!cloud.conflict) return;
  applyCloudHome(cloud.conflict);
  showToast("Загружена версия семейного дома");
}

async function keepMyVersion() {
  if (!cloud.conflict) return;
  const version = cloud.conflict.version;
  cloud.conflict = null;
  await pushCloud({ forceVersion: version });
  if (cloud.status === "synced") showToast("Ваша версия сохранена для семьи");
}

function openDisconnectFamily() {
  openModal(`${sheetHeader("Отключить общий дом?")}<div class="confirm-copy"><p>Задачи останутся на этом телефоне, но новые семейные изменения больше не будут приходить.</p></div><div class="two-cols"><button class="secondary-button" type="button" data-close-modal>Отмена</button><button class="danger-button compact" type="button" id="confirm-disconnect">Отключить</button></div>`);
  document.querySelector("#confirm-disconnect").addEventListener("click", () => {
    localStorage.removeItem(CLOUD_KEY); cloud = { status: "local", members: [] };
    closeModal(); render(); showToast("Этот телефон отключён от общего дома");
  });
}

async function openInvite() {
  if (!cloud.homeId || cloud.currentRole !== "owner") return showToast("Приглашения создаёт владелец дома");
  openModal(`${sheetHeader("Пригласить в дом")}<div class="empty-state"><div class="big-icon">${icon("users")}</div><h3>Создаём безопасный код…</h3></div>`);
  try {
    const invite = await cloudRequest(`/api/v1/homes/${encodeURIComponent(cloud.homeId)}/invites`, { method: "POST", body: "{}" });
    const inviteUrl = `${location.origin}${location.pathname}?invite=${encodeURIComponent(invite.code)}`;
    openModal(`${sheetHeader("Пригласить в дом")}<div class="invite-card"><span>Код приглашения</span><strong>${escapeHtml(invite.code)}</strong><p>Действует 7 дней, подключиться смогут до 5 человек.</p></div><button class="primary-button full" type="button" id="copy-invite">${icon("users")} Скопировать ссылку</button><p class="muted center">Отправьте ссылку лично тому, кого хотите добавить.</p>`);
    document.querySelector("#copy-invite").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(inviteUrl); showToast("Ссылка скопирована"); }
      catch { showToast(`Код приглашения: ${invite.code}`); }
    });
  } catch { closeModal(); showToast("Не удалось создать приглашение"); }
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `pora-dom-backup-${new Date().toISOString().slice(0,10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Резервная копия создана");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

document.addEventListener("click", event => {
  if (event.target.matches("[data-close-modal]")) closeModal();
});

render();

function openTodayFromReminder() {
  localStorage.removeItem("pora-pending-reminder");
  // Clear the legacy per-task marker left by builds before versionCode 12.
  localStorage.removeItem("pora-pending-task-id");
  if (!state.onboarded) return;
  const modalLayer = document.querySelector("#modal-layer");
  if (modalLayer && !modalLayer.hidden) closeModal();
  state.activeTab = "today";
  save({ sync: false });
  render();
  window.scrollTo({ top: 0, behavior: "auto" });
}

window.addEventListener("pora-reminder-open", openTodayFromReminder);
window.addEventListener("pora-ad-status", event => {
  nativeAdVisible = Boolean(event.detail?.visible);
  document.documentElement.classList.toggle("native-banner-visible", nativeAdVisible);
  if (nativeAdVisible) render();
  else if (["fallback", "none"].includes(event.detail?.provider)) loadSponsorBanner();
});
navigator.serviceWorker?.addEventListener("message", event => {
  if (event.data?.type === "pora-reminder-open") openTodayFromReminder();
});
const pendingReminder = localStorage.getItem("pora-pending-reminder") || localStorage.getItem("pora-pending-task-id");
if (pendingReminder || new URLSearchParams(location.search).get("from") === "notification") {
  window.setTimeout(openTodayFromReminder, 0);
}

window.setTimeout(() => {
  if (!nativeAdVisible) loadSponsorBanner();
}, 4_000);

refreshNativeNotificationPermission().then(() => {
  syncNativeReminders();
  window.setTimeout(() => requestNotificationsOnFirstLaunch(), 500);
  if (!document.querySelector("#modal-layer").hidden && document.querySelector("#request-notifications")) {
    closeModal();
    openSettings();
  }
});

const inviteCode = new URLSearchParams(location.search).get("invite");
if (FAMILY_SYNC_ENABLED && inviteCode) window.setTimeout(() => openJoinFamily(inviteCode), 0);
else if (FAMILY_SYNC_ENABLED && cloud.homeId) window.setTimeout(() => pullCloud(false), 0);

window.addEventListener("online", () => {
  if (FAMILY_SYNC_ENABLED) pullCloud(false);
});
document.addEventListener("visibilitychange", () => {
  if (FAMILY_SYNC_ENABLED && document.visibilityState === "visible") pullCloud(false);
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker.register("./sw.js?v=25").then(() => sendDueNotification()).catch(() => {});
    window.setInterval(() => sendDueNotification(), 60_000);
    if (FAMILY_SYNC_ENABLED) window.setInterval(() => pullCloud(false), 90_000);
  });
}

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const scheduler = read("android/app/src/main/java/ru/poradom/app/ReminderScheduler.java");
const activity = read("android/app/src/main/java/ru/poradom/app/MainActivity.java");

assert.doesNotMatch(scheduler, /EXTRA_TASK_ID|putExtra\s*\(/, "Notification PendingIntent must not carry a task ID");
assert.match(scheduler, /setAction\("ru\.poradom\.app\.OPEN_REMINDER"\)/, "Notification must use the generic reminder action");
assert.doesNotMatch(activity, /getStringExtra|openTaskForm/, "Reminder intent handling must not read or open an individual task");
assert.match(activity, /localStorage\.setItem\('pora-pending-reminder','1'\)/, "Cold-start reminder navigation must persist a generic marker");
assert.match(activity, /new CustomEvent\('pora-reminder-open'\)/, "Warm-start reminder navigation must emit a generic event");

console.log("ANDROID ROUTING OK: reminder notifications cannot carry or open an individual task");

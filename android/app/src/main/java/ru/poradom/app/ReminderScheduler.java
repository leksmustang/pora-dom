package ru.poradom.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.TimeUnit;

final class ReminderScheduler {
    private static final String PREFS = "pora_reminders";
    private static final String KEY_TASKS = "tasks_json";
    private static final String KEY_TIME = "notification_time";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_LAST_DATE = "last_notification_date";
    private static final String WORK_NAME = "pora_daily_reminders";
    private static final String CHANNEL_ID = "home_reminders";
    private static final int NOTIFICATION_ID = 4101;

    private ReminderScheduler() {}

    static void restoreSchedule(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!preferences.getBoolean(KEY_ENABLED, false)) return;
        saveAndSchedule(
            context,
            preferences.getString(KEY_TASKS, "[]"),
            preferences.getString(KEY_TIME, "09:00"),
            true
        );
    }

    static void saveAndSchedule(Context context, String tasksJson, String notificationTime, boolean enabled) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        preferences.edit()
            .putString(KEY_TASKS, tasksJson == null ? "[]" : tasksJson)
            .putString(KEY_TIME, validTime(notificationTime))
            .putBoolean(KEY_ENABLED, enabled)
            .apply();

        WorkManager manager = WorkManager.getInstance(context);
        if (!enabled) {
            manager.cancelUniqueWork(WORK_NAME);
            return;
        }

        long delayMinutes = minutesUntil(preferences.getString(KEY_TIME, "09:00"));
        PeriodicWorkRequest work = new PeriodicWorkRequest.Builder(ReminderWorker.class, 24, TimeUnit.HOURS)
            .setInitialDelay(delayMinutes, TimeUnit.MINUTES)
            .build();
        manager.enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.CANCEL_AND_REENQUEUE, work);
    }

    static void showDueNotification(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!preferences.getBoolean(KEY_ENABLED, false) || !notificationsAllowed(context)) return;

        String today = LocalDate.now().toString();
        if (today.equals(preferences.getString(KEY_LAST_DATE, ""))) return;

        try {
            JSONArray tasks = new JSONArray(preferences.getString(KEY_TASKS, "[]"));
            JSONObject first = null;
            int urgentCount = 0;
            LocalDate now = LocalDate.now();
            for (int index = 0; index < tasks.length(); index++) {
                JSONObject task = tasks.optJSONObject(index);
                if (task == null) continue;
                LocalDate due = Instant.parse(task.optString("dueDate")).atZone(ZoneId.systemDefault()).toLocalDate();
                long days = ChronoUnit.DAYS.between(now, due);
                if (days <= task.optInt("leadDays", 3)) {
                    urgentCount++;
                    if (first == null) first = task;
                }
            }
            if (first == null) return;

            String title = first.optString("title", "Домашнее дело");
            String room = first.optString("room", "Дом");
            String body = urgentCount > 1
                ? room + " · и ещё " + (urgentCount - 1) + " дел требуют внимания"
                : room + " · пора проверить срок";
            showNotification(context, title, body, NOTIFICATION_ID);
            preferences.edit().putString(KEY_LAST_DATE, today).apply();
        } catch (Exception ignored) {
            // Invalid local task data must not crash a background worker.
        }
    }

    static void showTestNotification(Context context) {
        if (!notificationsAllowed(context)) return;
        showNotification(context, "Пора: Дом — проверка", "Напоминания настроены правильно.", NOTIFICATION_ID + 1);
    }

    private static void showNotification(Context context, String title, String body, int id) {
        createChannel(context);
        Intent intent = new Intent(context, MainActivity.class)
            .setAction("ru.poradom.app.OPEN_REMINDER")
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            id,
            intent,
            PendingIntent.FLAG_CANCEL_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_REMINDER);
        NotificationManagerCompat.from(context).notify(id, notification.build());
    }

    private static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Домашние напоминания",
            NotificationManager.IMPORTANCE_DEFAULT
        );
        channel.setDescription("Сроки домашних дел и обслуживания устройств");
        manager.createNotificationChannel(channel);
    }

    private static boolean notificationsAllowed(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private static String validTime(String value) {
        try {
            LocalTime.parse(value);
            return value;
        } catch (Exception ignored) {
            return "09:00";
        }
    }

    private static long minutesUntil(String time) {
        LocalTime selected = LocalTime.parse(validTime(time));
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime next = LocalDateTime.of(now.toLocalDate(), selected);
        if (!next.isAfter(now)) next = next.plusDays(1);
        return Math.max(1, Duration.between(now, next).toMinutes());
    }
}

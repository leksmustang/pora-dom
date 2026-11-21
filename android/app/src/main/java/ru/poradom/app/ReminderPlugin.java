package ru.poradom.app;

import android.Manifest;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "Reminder",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class ReminderPlugin extends Plugin {

    @PluginMethod
    public void syncReminders(PluginCall call) {
        String tasksJson = call.getString("tasksJson", "[]");
        String notificationTime = call.getString("notificationTime", "09:00");
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        ReminderScheduler.saveAndSchedule(getContext(), tasksJson, notificationTime, enabled);
        JSObject result = new JSObject();
        result.put("scheduled", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void showTest(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState("notifications") != PermissionState.GRANTED) {
            call.reject("notification_permission_required");
            return;
        }
        ReminderScheduler.showTestNotification(getContext());
        call.resolve();
    }
}

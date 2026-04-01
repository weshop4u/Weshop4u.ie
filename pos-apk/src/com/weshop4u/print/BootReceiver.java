package com.weshop4u.print;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

/**
 * Auto-starts the polling service on device boot if configured.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "BootReceiver";
    private static final String PREFS_NAME = "weshop4u_print_prefs";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean autoStart = prefs.getBoolean("auto_start", true);
            String serverUrl = prefs.getString("server_url", "");

            if (autoStart && !serverUrl.isEmpty()) {
                Log.i(TAG, "Auto-starting polling service on boot");
                Intent serviceIntent = new Intent(context, OrderPollingService.class);
                serviceIntent.putExtra("server_url", serverUrl);
                serviceIntent.putExtra("store_id", prefs.getInt("store_id", 1));
                context.startService(serviceIntent);
            }
        }
    }
}

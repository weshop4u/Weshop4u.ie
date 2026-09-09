package com.weshop4u.print;

import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Background service that:
 * 1. Polls for pending PRINT JOBS and prints them (existing behavior)
 * 2. Polls for pending ORDERS and broadcasts them to the UI (new behavior)
 *
 * Print job polling and order polling run on separate intervals.
 * Supports multiple store IDs (comma separated) for restaurant POS.
 *
 * No silent fallback to store 1: if store IDs are missing or unparseable,
 * polling refuses to start and says so in the on-screen activity log.
 */
public class OrderPollingService extends Service {

    private static final String TAG = "OrderPolling";
    private static final long PRINT_POLL_INTERVAL = 5000;  // 5 seconds for print jobs
    private static final long ORDER_POLL_INTERVAL = 5000;  // 5 seconds for pending orders
    private static final String PREFS_NAME = "weshop4u_print_prefs";

    private Handler handler;
    private boolean isRunning = false;
    private ApiClient apiClient;
    private SerialPrinter printer;
    private int[] storeIds = new int[]{};

    // Print job polling runnable
    private Runnable printPollRunnable = new Runnable() {
        @Override
        public void run() {
            if (!isRunning) return;
            pollForPrintJobs();
            handler.postDelayed(this, PRINT_POLL_INTERVAL);
        }
    };

    // Order polling runnable
    private Runnable orderPollRunnable = new Runnable() {
        @Override
        public void run() {
            if (!isRunning) return;
            pollForOrders();
            handler.postDelayed(this, ORDER_POLL_INTERVAL);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler(Looper.getMainLooper());
        printer = new SerialPrinter();

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String serverUrl = prefs.getString("server_url", "");
        String storeIdStr = prefs.getString("store_ids", "");
        storeIds = parseStoreIds(storeIdStr);
        Log.i(TAG, "onCreate read prefs store_ids='" + storeIdStr
            + "' parsed to " + java.util.Arrays.toString(storeIds));

        if (!serverUrl.isEmpty()) {
            apiClient = new ApiClient(serverUrl);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getStringExtra("action");
            if ("stop".equals(action)) {
                stopPolling();
                stopSelf();
                return START_NOT_STICKY;
            }

            String serverUrl = intent.getStringExtra("server_url");
            String newStoreIds = intent.getStringExtra("store_ids");

            if (serverUrl != null && !serverUrl.isEmpty()) {
                apiClient = new ApiClient(serverUrl);
            }
            if (newStoreIds != null && !newStoreIds.isEmpty()) {
                storeIds = parseStoreIds(newStoreIds);
                Log.i(TAG, "Received store_ids extra: '" + newStoreIds
                    + "' parsed to " + java.util.Arrays.toString(storeIds));
            } else {
                Log.w(TAG, "No store_ids extra received - keeping "
                    + java.util.Arrays.toString(storeIds));
            }
        }

        startPolling();
        return START_STICKY;
    }

    private void startPolling() {
        if (isRunning) {
            // Already polling: report what we are actually polling, so a
            // settings change that did not take is visible on screen.
            broadcastPrintStatus("SERVICE already polling "
                + java.util.Arrays.toString(storeIds), 0);
            return;
        }
        if (apiClient == null) {
            broadcastPrintStatus("NO SERVER URL - check settings", 0);
            Log.w(TAG, "Cannot start polling - no server URL configured");
            return;
        }
        if (storeIds.length == 0) {
            broadcastPrintStatus("NO STORE IDS - check settings", 0);
            Log.w(TAG, "Cannot start polling - no store IDs configured");
            return;
        }

        isRunning = true;
        Log.i(TAG, "Starting polling for stores " + java.util.Arrays.toString(storeIds));
        broadcastPrintStatus("SERVICE polling "
            + java.util.Arrays.toString(storeIds), 0);

        if (!printer.isConnected()) {
            boolean opened = printer.open();
            Log.i(TAG, "Printer connection: " + (opened ? "OK" : "FAILED"));
        }

        // Start both polling loops
        handler.post(printPollRunnable);
        handler.postDelayed(orderPollRunnable, 1000); // Offset by 1s to avoid simultaneous requests
    }

    private void stopPolling() {
        isRunning = false;
        handler.removeCallbacks(printPollRunnable);
        handler.removeCallbacks(orderPollRunnable);
        printer.close();
        Log.i(TAG, "Stopped all polling");
    }

    /**
     * Poll for pending print jobs and print them (existing behavior).
     */
    private void pollForPrintJobs() {
        Thread thread = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONArray jobs = apiClient.getPendingPrintJobs(storeIds);

                    if (jobs.length() > 0) {
                        Log.i(TAG, "Found " + jobs.length() + " pending print job(s)");

                        for (int i = 0; i < jobs.length(); i++) {
                            JSONObject job = jobs.getJSONObject(i);
                            int jobId = job.getInt("id");
                            String receiptContent = job.optString("receiptContent", "");

                            if (receiptContent.isEmpty()) {
                                int orderId = job.getInt("orderId");
                                int jobStoreId = job.optInt("storeId", -1);
                                if (jobStoreId <= 0) {
                                    Log.e(TAG, "Job " + jobId + " has no storeId - cannot fetch receipt");
                                    broadcastPrintStatus("Job " + jobId + " missing storeId", jobId);
                                    apiClient.markFailed(jobId);
                                    continue;
                                }
                                try {
                                    receiptContent = apiClient.getReceiptContent(orderId, jobStoreId);
                                } catch (Exception e) {
                                    Log.e(TAG, "Failed to get receipt for order " + orderId, e);
                                    apiClient.markFailed(jobId);
                                    continue;
                                }
                            }

                            boolean printed = printReceipt(receiptContent);

                            if (printed) {
                                apiClient.markPrinted(jobId);
                                Log.i(TAG, "Printed job " + jobId + " successfully");
                                broadcastPrintStatus("printed", jobId);
                            } else {
                                apiClient.markFailed(jobId);
                                Log.e(TAG, "Failed to print job " + jobId);
                                broadcastPrintStatus("failed", jobId);
                            }

                            Thread.sleep(1000);
                        }
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Print poll error: " + e.getMessage());
                    broadcastPrintStatus("PRINT POLL ERROR: " + e.getMessage(), 0);
                }
            }
        });
        thread.start();
    }

    /**
     * Poll for pending orders and broadcast them to the UI (new behavior).
     */
    private void pollForOrders() {
        Thread thread = new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    JSONArray orders = apiClient.getPendingOrders(storeIds);
                    broadcastPendingOrders(orders.toString());
                } catch (Exception e) {
                    Log.e(TAG, "Order poll error: " + e.getMessage());
                    broadcastPrintStatus("ORDER POLL ERROR: " + e.getMessage(), 0);
                }
            }
        });
        thread.start();
    }

    private boolean printReceipt(String receiptContent) {
        try {
            if (!printer.isConnected()) printer.open();
            if (!printer.isConnected()) return false;

            printer.init();
            String[] lines = receiptContent.split("\n");
            for (String line : lines) {
                printer.printText(line);
            }
            printer.feedAndCut();
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Print error", e);
            return false;
        }
    }

    void broadcastPrintStatus(String status, int jobId) {
        Intent broadcast = new Intent("com.weshop4u.PRINT_STATUS");
        broadcast.putExtra("status", status);
        broadcast.putExtra("jobId", jobId);
        sendBroadcast(broadcast);
    }

    private void broadcastPendingOrders(String ordersJson) {
        Intent broadcast = new Intent("com.weshop4u.PENDING_ORDERS");
        broadcast.putExtra("orders", ordersJson);
        sendBroadcast(broadcast);
    }

    private int[] parseStoreIds(String storeIdStr) {
        if (storeIdStr == null) return new int[]{};
        String trimmed = storeIdStr.trim();
        if (trimmed.isEmpty()) return new int[]{};

        String[] parts = trimmed.split(",");
        java.util.ArrayList<Integer> valid = new java.util.ArrayList<Integer>();
        for (int i = 0; i < parts.length; i++) {
            String part = parts[i].trim();
            if (part.isEmpty()) continue;
            try {
                int id = Integer.parseInt(part);
                if (id > 0) {
                    valid.add(Integer.valueOf(id));
                } else {
                    Log.e(TAG, "Ignoring non-positive store ID: '" + part + "'");
                }
            } catch (NumberFormatException e) {
                Log.e(TAG, "Ignoring bad store ID: '" + part + "'");
            }
        }

        int[] ids = new int[valid.size()];
        for (int i = 0; i < valid.size(); i++) {
            ids[i] = valid.get(i).intValue();
        }
        return ids;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() { stopPolling(); super.onDestroy(); }
}

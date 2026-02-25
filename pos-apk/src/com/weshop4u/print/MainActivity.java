package com.weshop4u.print;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.SeekBar;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * WeShop4U Print v2 - POS Order Acceptance Terminal
 *
 * Main screen: incoming orders with Accept button
 * Settings: hidden behind gear icon (top-right)
 * Tap order card to expand/collapse item details
 * Auto-prints receipt on accept, shows details on screen as fallback
 */
public class MainActivity extends Activity {

    private static final String APP_TITLE = "WeShop4U Print";
    private static final String PREFS_NAME = "weshop4u_print_prefs";

    private EditText serverUrlInput, storeIdInput;
    private CheckBox autoStartCheckbox;
    private TextView statusText, noOrdersText;
    private LinearLayout settingsPanel, ordersContainer;
    private Button startButton, stopButton;
    private TextView logText;
    private LinearLayout logPanel;
    private Button logToggleBtn;

    private boolean isServiceRunning = false;
    private boolean settingsVisible = false;
    private boolean logVisible = false;
    private Handler handler = new Handler(Looper.getMainLooper());
    private StringBuilder logBuffer = new StringBuilder();
    private int pendingCount = 0;
    private TextView orderCountBadge;
    private int alertVolume = 100; // 0-100

    private Set<Integer> alertedOrderIds = new HashSet<Integer>();
    private Set<Integer> expandedOrderIds = new HashSet<Integer>();
    private Set<Integer> acceptedOrderIds = new HashSet<Integer>();

    private ToneGenerator toneGenerator;
    private Vibrator vibrator;
    private boolean alertPlaying = false;
    private Runnable alertLoopRunnable;

    private BroadcastReceiver printStatusReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String status = intent.getStringExtra("status");
            int jobId = intent.getIntExtra("jobId", 0);
            String ts = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
            appendLog("[" + ts + "] Job #" + jobId + " " +
                ("printed".equals(status) ? "printed successfully" : "FAILED"));
        }
    };

    private BroadcastReceiver pendingOrdersReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            final String ordersJson = intent.getStringExtra("orders");
            if (ordersJson != null) {
                handler.post(new Runnable() {
                    @Override
                    public void run() {
                        updateOrdersUI(ordersJson);
                    }
                });
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        SharedPreferences initPrefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        alertVolume = initPrefs.getInt("alert_volume", 100);
        try {
            toneGenerator = new ToneGenerator(AudioManager.STREAM_ALARM, alertVolume);
        } catch (Exception e) {
            toneGenerator = null;
        }
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);

        ScrollView rootScroll = new ScrollView(this);
        rootScroll.setBackgroundColor(Color.parseColor("#1a1a2e"));
        rootScroll.setFillViewport(true);

        LinearLayout main = new LinearLayout(this);
        main.setOrientation(LinearLayout.VERTICAL);
        main.setPadding(30, 30, 30, 30);

        // ===== TOP BAR =====
        LinearLayout topBar = new LinearLayout(this);
        topBar.setOrientation(LinearLayout.HORIZONTAL);
        topBar.setGravity(Gravity.CENTER_VERTICAL);

        LinearLayout titleGroup = new LinearLayout(this);
        titleGroup.setOrientation(LinearLayout.VERTICAL);
        titleGroup.setLayoutParams(new LinearLayout.LayoutParams(0,
            LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        TextView title = new TextView(this);
        title.setText(APP_TITLE);
        title.setTextSize(22);
        title.setTextColor(Color.parseColor("#00E5FF"));
        title.setTypeface(null, Typeface.BOLD);
        titleGroup.addView(title);

        TextView subtitle = new TextView(this);
        subtitle.setText("POS Order Terminal");
        subtitle.setTextSize(12);
        subtitle.setTextColor(Color.parseColor("#888888"));
        titleGroup.addView(subtitle);

        topBar.addView(titleGroup);

        // Order count badge
        orderCountBadge = new TextView(this);
        orderCountBadge.setTextSize(14);
        orderCountBadge.setTextColor(Color.WHITE);
        orderCountBadge.setTypeface(null, Typeface.BOLD);
        orderCountBadge.setGravity(Gravity.CENTER);
        orderCountBadge.setPadding(16, 6, 16, 6);
        GradientDrawable badgeBgShape = new GradientDrawable();
        badgeBgShape.setColor(Color.parseColor("#EF4444"));
        badgeBgShape.setCornerRadius(20);
        orderCountBadge.setBackground(badgeBgShape);
        orderCountBadge.setVisibility(View.GONE);
        LinearLayout.LayoutParams badgeParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        badgeParams.setMargins(0, 0, 12, 0);
        orderCountBadge.setLayoutParams(badgeParams);
        topBar.addView(orderCountBadge);

        statusText = new TextView(this);
        statusText.setText("\u25CF");
        statusText.setTextSize(18);
        statusText.setTextColor(Color.parseColor("#EF4444"));
        statusText.setPadding(0, 0, 20, 0);
        topBar.addView(statusText);

        Button gearBtn = new Button(this);
        gearBtn.setText("\u2699");
        gearBtn.setTextSize(22);
        gearBtn.setTextColor(Color.WHITE);
        gearBtn.setBackgroundColor(Color.parseColor("#333355"));
        gearBtn.setPadding(20, 10, 20, 10);
        gearBtn.setMinWidth(0);
        gearBtn.setMinimumWidth(0);
        gearBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                toggleSettings();
            }
        });
        topBar.addView(gearBtn);

        main.addView(topBar);
        addSpacer(main, 15);

        // ===== SETTINGS PANEL (hidden by default) =====
        settingsPanel = new LinearLayout(this);
        settingsPanel.setOrientation(LinearLayout.VERTICAL);
        settingsPanel.setBackgroundColor(Color.parseColor("#222244"));
        settingsPanel.setPadding(20, 20, 20, 20);
        settingsPanel.setVisibility(View.GONE);

        settingsPanel.addView(createLabel("Server URL:"));
        serverUrlInput = createInput("https://your-server.com",
            InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        settingsPanel.addView(serverUrlInput);
        addSpacer(settingsPanel, 12);

        settingsPanel.addView(createLabel("Store ID:"));
        storeIdInput = createInput("1", InputType.TYPE_CLASS_NUMBER);
        settingsPanel.addView(storeIdInput);
        addSpacer(settingsPanel, 12);

        autoStartCheckbox = new CheckBox(this);
        autoStartCheckbox.setText("Auto-start on device boot");
        autoStartCheckbox.setTextColor(Color.WHITE);
        autoStartCheckbox.setTextSize(13);
        autoStartCheckbox.setChecked(true);
        settingsPanel.addView(autoStartCheckbox);
        addSpacer(settingsPanel, 12);

        Button saveBtn = createButton("SAVE SETTINGS", "#0a7ea4");
        saveBtn.setTextSize(14);
        saveBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                saveSettings();
            }
        });
        settingsPanel.addView(saveBtn);
        addSpacer(settingsPanel, 8);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        startButton = createButton("START", "#22C55E");
        startButton.setTextSize(14);
        startButton.setLayoutParams(new LinearLayout.LayoutParams(0,
            LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        startButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                startPolling();
            }
        });
        row.addView(startButton);
        addHSpacer(row, 8);
        stopButton = createButton("STOP", "#EF4444");
        stopButton.setTextSize(14);
        stopButton.setLayoutParams(new LinearLayout.LayoutParams(0,
            LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        stopButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                stopPolling();
            }
        });
        stopButton.setEnabled(false);
        row.addView(stopButton);
        settingsPanel.addView(row);
        addSpacer(settingsPanel, 8);

        Button testBtn = createButton("TEST PRINT", "#F59E0B");
        testBtn.setTextSize(14);
        testBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                testPrint();
            }
        });
        settingsPanel.addView(testBtn);
        addSpacer(settingsPanel, 8);

        // Volume slider
        addSpacer(settingsPanel, 12);
        settingsPanel.addView(createLabel("Alert Volume:"));

        LinearLayout volumeRow = new LinearLayout(this);
        volumeRow.setOrientation(LinearLayout.HORIZONTAL);
        volumeRow.setGravity(Gravity.CENTER_VERTICAL);

        TextView volIcon = new TextView(this);
        volIcon.setText("\uD83D\uDD0A");
        volIcon.setTextSize(16);
        volIcon.setPadding(0, 0, 10, 0);
        volumeRow.addView(volIcon);

        final SeekBar volumeSlider = new SeekBar(this);
        volumeSlider.setMax(100);
        volumeSlider.setProgress(alertVolume);
        LinearLayout.LayoutParams sliderParams = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        volumeSlider.setLayoutParams(sliderParams);
        volumeRow.addView(volumeSlider);

        final TextView volLabel = new TextView(this);
        volLabel.setText(alertVolume + "%");
        volLabel.setTextSize(13);
        volLabel.setTextColor(Color.WHITE);
        volLabel.setPadding(10, 0, 0, 0);
        volLabel.setMinWidth(80);
        volumeRow.addView(volLabel);

        volumeSlider.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override
            public void onProgressChanged(SeekBar seekBar, int progress, boolean fromUser) {
                volLabel.setText(progress + "%");
            }
            @Override
            public void onStartTrackingTouch(SeekBar seekBar) {}
            @Override
            public void onStopTrackingTouch(SeekBar seekBar) {
                alertVolume = seekBar.getProgress();
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
                    .putInt("alert_volume", alertVolume).apply();
                // Recreate tone generator with new volume
                if (toneGenerator != null) {
                    toneGenerator.release();
                }
                try {
                    toneGenerator = new ToneGenerator(AudioManager.STREAM_ALARM, alertVolume);
                } catch (Exception e) {
                    toneGenerator = null;
                }
                appendLog("Alert volume set to " + alertVolume + "%");
            }
        });

        settingsPanel.addView(volumeRow);
        addSpacer(settingsPanel, 12);

        TextView printerInfo = new TextView(this);
        printerInfo.setText("Printer: /dev/ttyMT1 @ 115200 baud");
        printerInfo.setTextSize(11);
        printerInfo.setTextColor(Color.parseColor("#888888"));
        printerInfo.setGravity(Gravity.CENTER);
        settingsPanel.addView(printerInfo);

        addSpacer(settingsPanel, 8);
        logToggleBtn = createButton("ACTIVITY LOG \u25BC", "#333355");
        logToggleBtn.setTextSize(12);
        logToggleBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                logVisible = !logVisible;
                logPanel.setVisibility(logVisible ? View.VISIBLE : View.GONE);
                logToggleBtn.setText(logVisible ? "ACTIVITY LOG \u25B2" : "ACTIVITY LOG \u25BC");
            }
        });
        settingsPanel.addView(logToggleBtn);

        logPanel = new LinearLayout(this);
        logPanel.setOrientation(LinearLayout.VERTICAL);
        logPanel.setVisibility(View.GONE);
        logText = new TextView(this);
        logText.setTextSize(10);
        logText.setTextColor(Color.parseColor("#AAAAAA"));
        logText.setBackgroundColor(Color.parseColor("#0a0a1e"));
        logText.setPadding(10, 10, 10, 10);
        logText.setMinHeight(150);
        logText.setText("Ready.");
        logPanel.addView(logText);
        settingsPanel.addView(logPanel);

        main.addView(settingsPanel);
        addSpacer(main, 10);

        // ===== DIVIDER =====
        View divider = new View(this);
        divider.setBackgroundColor(Color.parseColor("#333355"));
        divider.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 2));
        main.addView(divider);
        addSpacer(main, 10);

        // ===== ORDERS SECTION =====
        TextView ordersTitle = new TextView(this);
        ordersTitle.setText("INCOMING ORDERS");
        ordersTitle.setTextSize(16);
        ordersTitle.setTextColor(Color.parseColor("#00E5FF"));
        ordersTitle.setTypeface(null, Typeface.BOLD);
        ordersTitle.setGravity(Gravity.CENTER);
        main.addView(ordersTitle);
        addSpacer(main, 10);

        noOrdersText = new TextView(this);
        noOrdersText.setText("No pending orders\nWaiting for new orders...");
        noOrdersText.setTextSize(14);
        noOrdersText.setTextColor(Color.parseColor("#666666"));
        noOrdersText.setGravity(Gravity.CENTER);
        noOrdersText.setPadding(0, 60, 0, 60);
        main.addView(noOrdersText);

        ordersContainer = new LinearLayout(this);
        ordersContainer.setOrientation(LinearLayout.VERTICAL);
        main.addView(ordersContainer);

        rootScroll.addView(main);
        setContentView(rootScroll);
        loadSettings();

        registerReceiver(printStatusReceiver,
            new IntentFilter("com.weshop4u.PRINT_STATUS"));
        registerReceiver(pendingOrdersReceiver,
            new IntentFilter("com.weshop4u.PENDING_ORDERS"));

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        if (prefs.getBoolean("was_running", false)) {
            startPolling();
        }
    }

    private void toggleSettings() {
        settingsVisible = !settingsVisible;
        settingsPanel.setVisibility(settingsVisible ? View.VISIBLE : View.GONE);
    }

    // ===== ORDER UI =====

    private void updateOrdersUI(String ordersJson) {
        try {
            JSONArray allOrders = new JSONArray(ordersJson);

            if (allOrders.length() == 0 && acceptedOrderIds.isEmpty()) {
                noOrdersText.setVisibility(View.VISIBLE);
                ordersContainer.removeAllViews();
                stopOrderAlert();
                return;
            }

            noOrdersText.setVisibility(View.GONE);

            // Check for new pending orders to trigger alert
            boolean hasNewPending = false;
            boolean hasPending = false;
            int newPendingCount = 0;
            for (int i = 0; i < allOrders.length(); i++) {
                JSONObject order = allOrders.getJSONObject(i);
                int orderId = order.getInt("id");
                String status = order.optString("status", "pending");
                if ("pending".equals(status)) {
                    hasPending = true;
                    newPendingCount++;
                    if (!alertedOrderIds.contains(orderId)) {
                        alertedOrderIds.add(orderId);
                        hasNewPending = true;
                    }
                }
            }

            // Update badge count
            pendingCount = newPendingCount;
            updateOrderCountBadge();

            // Start looping alert if there are pending orders, stop if none
            if (hasPending && (hasNewPending || !alertPlaying)) {
                startOrderAlert();
            } else if (!hasPending) {
                stopOrderAlert();
            }

            ordersContainer.removeAllViews();

            for (int i = 0; i < allOrders.length(); i++) {
                JSONObject order = allOrders.getJSONObject(i);
                ordersContainer.addView(createOrderCard(order));
                addSpacer(ordersContainer, 10);
            }

        } catch (Exception e) {
            appendLog("Error updating orders: " + e.getMessage());
        }
    }

    private LinearLayout createOrderCard(JSONObject order) {
        try {
            final int orderId = order.getInt("id");
            final String orderNumber = order.optString("orderNumber", "#" + orderId);
            String total = order.optString("total", "0.00");
            int itemCount = order.optInt("itemCount", 0);
            int totalQuantity = order.optInt("totalQuantity", 0);
            String customerName = order.optString("customerName", "Guest");
            String paymentMethod = order.optString("paymentMethod", "card");

            final String orderStatus = order.optString("status", "pending");
            final boolean isPending = "pending".equals(orderStatus);
            final boolean isAccepted = !isPending;

            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(20, 16, 20, 16);

            GradientDrawable cardBg = new GradientDrawable();
            cardBg.setColor(isAccepted ? Color.parseColor("#1a3a2e") : Color.parseColor("#2a2a4e"));
            cardBg.setCornerRadius(12);
            cardBg.setStroke(2, isAccepted ? Color.parseColor("#22C55E") : Color.parseColor("#00E5FF"));
            card.setBackground(cardBg);

            // Top row: badge + order number
            LinearLayout topRow = new LinearLayout(this);
            topRow.setOrientation(LinearLayout.HORIZONTAL);
            topRow.setGravity(Gravity.CENTER_VERTICAL);

            TextView badge = new TextView(this);
            badge.setText(isAccepted ? " \u2714 ACCEPTED " : " NEW ORDER ");
            badge.setTextSize(11);
            badge.setTextColor(Color.WHITE);
            badge.setTypeface(null, Typeface.BOLD);
            GradientDrawable badgeBg = new GradientDrawable();
            badgeBg.setColor(isAccepted ? Color.parseColor("#22C55E") : Color.parseColor("#EF4444"));
            badgeBg.setCornerRadius(8);
            badge.setBackground(badgeBg);
            badge.setPadding(12, 4, 12, 4);
            topRow.addView(badge);

            View spacer = new View(this);
            spacer.setLayoutParams(new LinearLayout.LayoutParams(0, 1, 1));
            topRow.addView(spacer);

            TextView orderNumText = new TextView(this);
            orderNumText.setText(orderNumber);
            orderNumText.setTextSize(14);
            orderNumText.setTextColor(Color.WHITE);
            orderNumText.setTypeface(null, Typeface.BOLD);
            topRow.addView(orderNumText);

            card.addView(topRow);
            addSpacer(card, 8);

            // Summary row
            LinearLayout summaryRow = new LinearLayout(this);
            summaryRow.setOrientation(LinearLayout.HORIZONTAL);
            summaryRow.setGravity(Gravity.CENTER_VERTICAL);

            TextView itemsText = new TextView(this);
            itemsText.setText(totalQuantity + " item" + (totalQuantity != 1 ? "s" : "") +
                " \u00B7 " + customerName);
            itemsText.setTextSize(13);
            itemsText.setTextColor(Color.parseColor("#CCCCCC"));
            itemsText.setLayoutParams(new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            summaryRow.addView(itemsText);

            TextView totalText = new TextView(this);
            totalText.setText("\u20AC" + total);
            totalText.setTextSize(18);
            totalText.setTextColor(Color.parseColor("#22C55E"));
            totalText.setTypeface(null, Typeface.BOLD);
            summaryRow.addView(totalText);

            card.addView(summaryRow);

            // Payment
            TextView paymentText = new TextView(this);
            paymentText.setText("Payment: " + ("card".equals(paymentMethod) ? "Card" : "Cash"));
            paymentText.setTextSize(11);
            paymentText.setTextColor(Color.parseColor("#999999"));
            card.addView(paymentText);
            addSpacer(card, 10);

            // Expandable details
            final LinearLayout detailsPanel = new LinearLayout(this);
            detailsPanel.setOrientation(LinearLayout.VERTICAL);
            detailsPanel.setBackgroundColor(Color.parseColor("#1a1a3e"));
            detailsPanel.setPadding(15, 10, 15, 10);
            detailsPanel.setVisibility(expandedOrderIds.contains(orderId) ? View.VISIBLE : View.GONE);

            View detailDivider = new View(this);
            detailDivider.setBackgroundColor(Color.parseColor("#444466"));
            detailDivider.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 1));
            detailsPanel.addView(detailDivider);
            addSpacer(detailsPanel, 8);

            TextView detailTitle = new TextView(this);
            detailTitle.setText("ORDER ITEMS:");
            detailTitle.setTextSize(12);
            detailTitle.setTextColor(Color.parseColor("#00E5FF"));
            detailTitle.setTypeface(null, Typeface.BOLD);
            detailsPanel.addView(detailTitle);
            addSpacer(detailsPanel, 5);

            JSONArray items = order.optJSONArray("items");
            if (items != null) {
                for (int j = 0; j < items.length(); j++) {
                    JSONObject item = items.getJSONObject(j);
                    String itemName = item.optString("name", "Item");
                    int qty = item.optInt("quantity", 1);
                    String subtotalStr = item.optString("subtotal", "0.00");

                    LinearLayout itemRow = new LinearLayout(this);
                    itemRow.setOrientation(LinearLayout.HORIZONTAL);
                    itemRow.setPadding(0, 3, 0, 3);

                    TextView qtyText = new TextView(this);
                    qtyText.setText(qty + "x ");
                    qtyText.setTextSize(12);
                    qtyText.setTextColor(Color.parseColor("#F59E0B"));
                    qtyText.setTypeface(null, Typeface.BOLD);
                    itemRow.addView(qtyText);

                    TextView nameText = new TextView(this);
                    nameText.setText(itemName);
                    nameText.setTextSize(12);
                    nameText.setTextColor(Color.WHITE);
                    nameText.setLayoutParams(new LinearLayout.LayoutParams(0,
                        LinearLayout.LayoutParams.WRAP_CONTENT, 1));
                    itemRow.addView(nameText);

                    TextView priceText = new TextView(this);
                    priceText.setText("\u20AC" + subtotalStr);
                    priceText.setTextSize(12);
                    priceText.setTextColor(Color.parseColor("#CCCCCC"));
                    itemRow.addView(priceText);

                    detailsPanel.addView(itemRow);
                }
            }

            // Reprint button inside details panel
            addSpacer(detailsPanel, 10);
            View reprintDivider = new View(this);
            reprintDivider.setBackgroundColor(Color.parseColor("#444466"));
            reprintDivider.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 1));
            detailsPanel.addView(reprintDivider);
            addSpacer(detailsPanel, 8);

            Button reprintBtn = createButton("\u2399  REPRINT RECEIPT", "#F59E0B");
            reprintBtn.setTextSize(13);
            reprintBtn.setPadding(16, 12, 16, 12);
            reprintBtn.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    reprintOrder(orderId, orderNumber);
                }
            });
            detailsPanel.addView(reprintBtn);

            card.addView(detailsPanel);
            addSpacer(card, 10);

            // Expand hint
            final TextView expandHint = new TextView(this);
            expandHint.setText(expandedOrderIds.contains(orderId) ?
                "\u25B2 Tap to hide items" : "\u25BC Tap to view items");
            expandHint.setTextSize(10);
            expandHint.setTextColor(Color.parseColor("#666666"));
            expandHint.setGravity(Gravity.CENTER);

            View.OnClickListener toggleDetails = new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    if (expandedOrderIds.contains(orderId)) {
                        expandedOrderIds.remove(orderId);
                        detailsPanel.setVisibility(View.GONE);
                        expandHint.setText("\u25BC Tap to view items");
                    } else {
                        expandedOrderIds.add(orderId);
                        detailsPanel.setVisibility(View.VISIBLE);
                        expandHint.setText("\u25B2 Tap to hide items");
                    }
                }
            };

            topRow.setOnClickListener(toggleDetails);
            summaryRow.setOnClickListener(toggleDetails);
            expandHint.setOnClickListener(toggleDetails);
            card.addView(expandHint);
            addSpacer(card, 8);

            // ACCEPT button (only for pending orders)
            if (isPending) {
                Button acceptBtn = createButton("\u2714  ACCEPT ORDER", "#22C55E");
                acceptBtn.setTextSize(16);
                acceptBtn.setPadding(20, 16, 20, 16);
                acceptBtn.setOnClickListener(new View.OnClickListener() {
                    @Override
                    public void onClick(View v) {
                        acceptOrder(orderId, orderNumber);
                    }
                });
                card.addView(acceptBtn);
            }

            return card;

        } catch (Exception e) {
            LinearLayout errorCard = new LinearLayout(this);
            TextView errorText = new TextView(this);
            errorText.setText("Error displaying order");
            errorText.setTextColor(Color.RED);
            errorCard.addView(errorText);
            return errorCard;
        }
    }

    // ===== ORDER ACCEPTANCE =====

    private void acceptOrder(final int orderId, final String orderNumber) {
        appendLog("Accepting order " + orderNumber + "...");
        acceptedOrderIds.add(orderId);
        stopOrderAlert();

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                    String serverUrl = prefs.getString("server_url", "");
                    int storeId = prefs.getInt("store_id", 1);

                    ApiClient api = new ApiClient(serverUrl);
                    JSONObject result = api.acceptOrder(orderId, storeId);

                    final boolean success = result.optBoolean("success", false);
                    final boolean alreadyAccepted = result.optBoolean("alreadyAccepted", false);

                    handler.post(new Runnable() {
                        @Override
                        public void run() {
                            if (success) {
                                appendLog("Order " + orderNumber + " ACCEPTED - receipt will print");
                                Toast.makeText(MainActivity.this, "Order " + orderNumber + " accepted!",
                                    Toast.LENGTH_SHORT).show();
                                playSuccessTone();
                            } else if (alreadyAccepted) {
                                appendLog("Order " + orderNumber + " was already accepted");
                                Toast.makeText(MainActivity.this, "Already accepted on dashboard",
                                    Toast.LENGTH_SHORT).show();
                            } else {
                                appendLog("Failed to accept order " + orderNumber);
                                Toast.makeText(MainActivity.this, "Failed to accept order",
                                    Toast.LENGTH_SHORT).show();
                            }
                        }
                    });
                } catch (final Exception e) {
                    handler.post(new Runnable() {
                        @Override
                        public void run() {
                            appendLog("ERROR accepting order: " + e.getMessage());
                            Toast.makeText(MainActivity.this, "Network error - try again",
                                Toast.LENGTH_SHORT).show();
                            acceptedOrderIds.remove(orderId);
                        }
                    });
                }
            }
        }).start();
    }

    // ===== REPRINT =====

    private void reprintOrder(final int orderId, final String orderNumber) {
        appendLog("Reprinting order " + orderNumber + "...");
        Toast.makeText(this, "Sending reprint for " + orderNumber + "...", Toast.LENGTH_SHORT).show();

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                    String serverUrl = prefs.getString("server_url", "");
                    int storeId = prefs.getInt("store_id", 1);

                    ApiClient api = new ApiClient(serverUrl);
                    final boolean success = api.reprintOrder(orderId, storeId);

                    handler.post(new Runnable() {
                        @Override
                        public void run() {
                            if (success) {
                                appendLog("Reprint job created for " + orderNumber + " - printing shortly");
                                Toast.makeText(MainActivity.this, "Reprint sent!",
                                    Toast.LENGTH_SHORT).show();
                            } else {
                                appendLog("Failed to create reprint for " + orderNumber);
                                Toast.makeText(MainActivity.this, "Reprint failed",
                                    Toast.LENGTH_SHORT).show();
                            }
                        }
                    });
                } catch (final Exception e) {
                    handler.post(new Runnable() {
                        @Override
                        public void run() {
                            appendLog("ERROR reprinting: " + e.getMessage());
                            Toast.makeText(MainActivity.this, "Network error - try again",
                                Toast.LENGTH_SHORT).show();
                        }
                    });
                }
            }
        }).start();
    }

    // ===== AUDIO ALERTS =====

    private void startOrderAlert() {
        if (alertPlaying) return;
        alertPlaying = true;

        alertLoopRunnable = new Runnable() {
            @Override
            public void run() {
                if (!alertPlaying) return;
                // Play loud alarm tone
                if (toneGenerator != null) {
                    try {
                        toneGenerator.startTone(ToneGenerator.TONE_CDMA_EMERGENCY_RINGBACK, 1500);
                    } catch (Exception e) { /* ignore */ }
                }
                // Vibrate pattern
                if (vibrator != null) {
                    long[] pattern = {0, 800, 300, 800, 300, 800};
                    vibrator.vibrate(pattern, -1);
                }
                // Repeat every 3 seconds
                handler.postDelayed(this, 3000);
            }
        };
        handler.post(alertLoopRunnable);
    }

    private void stopOrderAlert() {
        alertPlaying = false;
        if (alertLoopRunnable != null) {
            handler.removeCallbacks(alertLoopRunnable);
        }
        if (toneGenerator != null) {
            try { toneGenerator.stopTone(); } catch (Exception e) { /* ignore */ }
        }
    }

    private void updateOrderCountBadge() {
        if (orderCountBadge == null) return;
        if (pendingCount > 0) {
            orderCountBadge.setText(String.valueOf(pendingCount));
            orderCountBadge.setVisibility(View.VISIBLE);
        } else {
            orderCountBadge.setVisibility(View.GONE);
        }
    }

    private void playSuccessTone() {
        if (toneGenerator != null) {
            try {
                toneGenerator.startTone(ToneGenerator.TONE_PROP_ACK, 200);
            } catch (Exception e) { /* ignore */ }
        }
    }

    // ===== SETTINGS / POLLING =====

    private void loadSettings() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        serverUrlInput.setText(prefs.getString("server_url", ""));
        storeIdInput.setText(String.valueOf(prefs.getInt("store_id", 1)));
        autoStartCheckbox.setChecked(prefs.getBoolean("auto_start", true));
    }

    private void saveSettings() {
        String url = serverUrlInput.getText().toString().trim();
        if (url.isEmpty()) {
            Toast.makeText(this, "Enter server URL", Toast.LENGTH_SHORT).show();
            return;
        }
        if (url.endsWith("/")) url = url.substring(0, url.length() - 1);
        int sid = 1;
        try { sid = Integer.parseInt(storeIdInput.getText().toString().trim()); } catch (Exception e) {}

        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
            .putString("server_url", url)
            .putInt("store_id", sid)
            .putBoolean("auto_start", autoStartCheckbox.isChecked())
            .apply();
        Toast.makeText(this, "Settings saved", Toast.LENGTH_SHORT).show();
        appendLog("Settings saved - Server: " + url + ", Store: " + sid);
    }

    private void startPolling() {
        saveSettings();
        String url = serverUrlInput.getText().toString().trim();
        if (url.isEmpty()) {
            Toast.makeText(this, "Enter server URL first", Toast.LENGTH_SHORT).show();
            return;
        }
        int sid = 1;
        try { sid = Integer.parseInt(storeIdInput.getText().toString().trim()); } catch (Exception e) {}

        Intent i = new Intent(this, OrderPollingService.class);
        i.putExtra("server_url", url);
        i.putExtra("store_id", sid);
        startService(i);
        isServiceRunning = true;

        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
            .putBoolean("was_running", true).apply();

        updateServiceUI();
        appendLog("Polling started");

        if (settingsVisible) {
            settingsVisible = false;
            settingsPanel.setVisibility(View.GONE);
        }
    }

    private void stopPolling() {
        Intent i = new Intent(this, OrderPollingService.class);
        i.putExtra("action", "stop");
        startService(i);
        isServiceRunning = false;

        getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit()
            .putBoolean("was_running", false).apply();

        updateServiceUI();
        appendLog("Polling stopped");
    }

    private void testPrint() {
        appendLog("Sending test print...");
        new Thread(new Runnable() {
            @Override
            public void run() {
                SerialPrinter printer = new SerialPrinter();
                if (!printer.open()) {
                    handler.post(new Runnable() {
                        @Override
                        public void run() {
                            appendLog("ERROR: Could not open printer port");
                        }
                    });
                    return;
                }
                try {
                    printer.printTestReceipt();
                    handler.post(new Runnable() {
                        @Override
                        public void run() {
                            appendLog("Test print OK!");
                        }
                    });
                } catch (final Exception e) {
                    handler.post(new Runnable() {
                        @Override
                        public void run() {
                            appendLog("ERROR: " + e.getMessage());
                        }
                    });
                } finally {
                    printer.close();
                }
            }
        }).start();
    }

    private void updateServiceUI() {
        if (isServiceRunning) {
            statusText.setText("\u25CF");
            statusText.setTextColor(Color.parseColor("#22C55E"));
            startButton.setEnabled(false);
            stopButton.setEnabled(true);
        } else {
            statusText.setText("\u25CF");
            statusText.setTextColor(Color.parseColor("#EF4444"));
            startButton.setEnabled(true);
            stopButton.setEnabled(false);
        }
    }

    private void appendLog(String msg) {
        String ts = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        logBuffer.insert(0, "[" + ts + "] " + msg + "\n");
        String[] lines = logBuffer.toString().split("\n");
        if (lines.length > 50) {
            logBuffer = new StringBuilder();
            for (int i = 0; i < 50; i++) logBuffer.append(lines[i]).append("\n");
        }
        handler.post(new Runnable() {
            @Override
            public void run() {
                if (logText != null) logText.setText(logBuffer.toString());
            }
        });
    }

    // ===== UI HELPERS =====

    private TextView createLabel(String text) {
        TextView l = new TextView(this);
        l.setText(text);
        l.setTextSize(13);
        l.setTextColor(Color.parseColor("#CCCCCC"));
        l.setPadding(0, 0, 0, 6);
        return l;
    }

    private EditText createInput(String hint, int inputType) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setInputType(inputType);
        e.setTextColor(Color.WHITE);
        e.setHintTextColor(Color.parseColor("#666666"));
        e.setBackgroundColor(Color.parseColor("#2a2a4e"));
        e.setPadding(16, 14, 16, 14);
        e.setTextSize(13);
        return e;
    }

    private Button createButton(String text, String color) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextColor(Color.WHITE);
        b.setBackgroundColor(Color.parseColor(color));
        b.setTextSize(14);
        b.setPadding(16, 14, 16, 14);
        return b;
    }

    private void addSpacer(LinearLayout l, int h) {
        View s = new View(this);
        s.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, h));
        l.addView(s);
    }

    private void addHSpacer(LinearLayout l, int w) {
        View s = new View(this);
        s.setLayoutParams(new LinearLayout.LayoutParams(w,
            LinearLayout.LayoutParams.MATCH_PARENT));
        l.addView(s);
    }

    @Override
    protected void onDestroy() {
        try { unregisterReceiver(printStatusReceiver); } catch (Exception e) {}
        try { unregisterReceiver(pendingOrdersReceiver); } catch (Exception e) {}
        if (toneGenerator != null) {
            toneGenerator.release();
            toneGenerator = null;
        }
        super.onDestroy();
    }
}

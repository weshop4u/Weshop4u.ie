package com.weshop4u.print;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;

/**
 * HTTP client for communicating with the WeShop4U server.
 * Handles both print job polling and order acceptance via tRPC endpoints.
 */
public class ApiClient {

    private String baseUrl;

    public ApiClient(String baseUrl) { this.baseUrl = baseUrl; }

    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    // ===== PRINT JOB ENDPOINTS =====

    public JSONArray getPendingPrintJobs(int storeId) throws Exception {
        String inputJson = URLEncoder.encode("{\"json\":{\"storeId\":" + storeId + "}}", "UTF-8");
        String url = baseUrl + "/api/trpc/print.getPendingJobs?input=" + inputJson;
        String response = httpGet(url);
        JSONObject json = new JSONObject(response);
        return json.getJSONObject("result").getJSONObject("data").getJSONArray("json");
    }

    public String getReceiptContent(int orderId, int storeId) throws Exception {
        String inputJson = URLEncoder.encode(
            "{\"json\":{\"orderId\":" + orderId + ",\"storeId\":" + storeId + "}}", "UTF-8");
        String url = baseUrl + "/api/trpc/print.getReceipt?input=" + inputJson;
        String response = httpGet(url);
        JSONObject json = new JSONObject(response);
        return json.getJSONObject("result").getJSONObject("data")
                   .getJSONObject("json").getString("receiptContent");
    }

    public boolean markPrinted(int printJobId) throws Exception {
        String url = baseUrl + "/api/trpc/print.markPrinted";
        String body = "{\"json\":{\"printJobId\":" + printJobId + "}}";
        String response = httpPost(url, body);
        return new JSONObject(response).has("result");
    }

    public boolean markFailed(int printJobId) throws Exception {
        String url = baseUrl + "/api/trpc/print.markFailed";
        String body = "{\"json\":{\"printJobId\":" + printJobId + "}}";
        String response = httpPost(url, body);
        return new JSONObject(response).has("result");
    }

    // ===== ORDER ENDPOINTS (NEW) =====

    /**
     * Get pending orders for this store (lightweight summary for POS display).
     * Returns array of orders with: id, orderNumber, total, itemCount, totalQuantity,
     * customerName, paymentMethod, createdAt, items[{name, quantity, subtotal}]
     */
    public JSONArray getPendingOrders(int storeId) throws Exception {
        String inputJson = URLEncoder.encode("{\"json\":{\"storeId\":" + storeId + "}}", "UTF-8");
        String url = baseUrl + "/api/trpc/store.getPendingOrdersForPOS?input=" + inputJson;
        String response = httpGet(url);
        JSONObject json = new JSONObject(response);
        return json.getJSONObject("result").getJSONObject("data").getJSONArray("json");
    }

    /**
     * Accept an order from the POS. Returns {success: bool, alreadyAccepted: bool}.
     * If alreadyAccepted is true, the order was already accepted by the dashboard.
     * On success, a print job is auto-created on the server for this POS to pick up.
     */
    public JSONObject acceptOrder(int orderId, int storeId) throws Exception {
        String url = baseUrl + "/api/trpc/store.acceptOrderFromPOS";
        String body = "{\"json\":{\"orderId\":" + orderId + ",\"storeId\":" + storeId + "}}";
        String response = httpPost(url, body);
        JSONObject json = new JSONObject(response);
        return json.getJSONObject("result").getJSONObject("data").getJSONObject("json");
    }

    // ===== HTTP HELPERS =====

    private String httpGet(String urlString) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlString).openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Accept", "application/json");
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);
        if (conn.getResponseCode() != 200) throw new Exception("HTTP " + conn.getResponseCode());
        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) sb.append(line);
        reader.close();
        conn.disconnect();
        return sb.toString();
    }

    private String httpPost(String urlString, String body) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlString).openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setRequestProperty("Accept", "application/json");
        conn.setDoOutput(true);
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(10000);
        OutputStream os = conn.getOutputStream();
        os.write(body.getBytes("UTF-8"));
        os.flush();
        os.close();
        if (conn.getResponseCode() != 200) throw new Exception("HTTP " + conn.getResponseCode());
        BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) sb.append(line);
        reader.close();
        conn.disconnect();
        return sb.toString();
    }
}

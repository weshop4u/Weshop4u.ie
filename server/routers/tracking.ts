/**
 * Public order tracking API — no authentication required.
 * Serves the tracking page HTML and provides JSON location data.
 * 
 * GET /track/:orderId — Serves the tracking page (HTML)
 * GET /api/track/:orderId — Returns order + driver location JSON
 */

import { Router } from "express";
import { getDb } from "../db";
import { orders, stores, drivers, orderTracking } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const trackingRouter = Router();

/**
 * GET /api/track/:orderId — JSON endpoint for live tracking data
 * Returns: order status, store location, driver location, delivery location
 */
trackingRouter.get("/api/track/:orderId", async (req, res) => {
  try {
    const orderId = parseInt(req.params.orderId);
    if (isNaN(orderId)) {
      res.status(400).json({ error: "Invalid order ID" });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(500).json({ error: "Database not available" });
      return;
    }

    // Get order with store info
    const orderResult = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        storeId: orders.storeId,
        driverId: orders.driverId,
        deliveryAddress: orders.deliveryAddress,
        deliveryLatitude: orders.deliveryLatitude,
        deliveryLongitude: orders.deliveryLongitude,
        createdAt: orders.createdAt,
        acceptedAt: orders.acceptedAt,
        pickedUpAt: orders.pickedUpAt,
        deliveredAt: orders.deliveredAt,
        storeName: stores.name,
        storeLatitude: stores.latitude,
        storeLongitude: stores.longitude,
        storeAddress: stores.address,
      })
      .from(orders)
      .leftJoin(stores, eq(orders.storeId, stores.id))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderResult.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const order = orderResult[0];

    // Get driver location if assigned
    let driverData = null;
    if (order.driverId && ["picked_up", "on_the_way", "accepted", "preparing", "ready_for_pickup"].includes(order.status)) {
      const driverResult = await db
        .select({
          currentLatitude: drivers.currentLatitude,
          currentLongitude: drivers.currentLongitude,
          lastLocationUpdate: drivers.lastLocationUpdate,
          displayNumber: drivers.displayNumber,
        })
        .from(drivers)
        .where(eq(drivers.userId, order.driverId))
        .limit(1);

      if (driverResult.length > 0 && driverResult[0].currentLatitude) {
        driverData = {
          latitude: parseFloat(driverResult[0].currentLatitude),
          longitude: parseFloat(driverResult[0].currentLongitude!),
          lastUpdate: driverResult[0].lastLocationUpdate?.toISOString() || null,
          name: driverResult[0].displayNumber ? `Driver ${driverResult[0].displayNumber}` : "Your Driver",
        };
      }
    }

    // Get latest tracking events
    const trackingEvents = await db
      .select({
        status: orderTracking.status,
        notes: orderTracking.notes,
        createdAt: orderTracking.createdAt,
      })
      .from(orderTracking)
      .where(eq(orderTracking.orderId, orderId))
      .orderBy(desc(orderTracking.createdAt))
      .limit(20);

    res.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        deliveryAddress: order.deliveryAddress,
        delivery: {
          latitude: order.deliveryLatitude ? parseFloat(order.deliveryLatitude) : null,
          longitude: order.deliveryLongitude ? parseFloat(order.deliveryLongitude) : null,
        },
        createdAt: order.createdAt?.toISOString() || null,
        acceptedAt: order.acceptedAt?.toISOString() || null,
        pickedUpAt: order.pickedUpAt?.toISOString() || null,
        deliveredAt: order.deliveredAt?.toISOString() || null,
      },
      store: {
        name: order.storeName,
        address: order.storeAddress,
        latitude: order.storeLatitude ? parseFloat(order.storeLatitude) : null,
        longitude: order.storeLongitude ? parseFloat(order.storeLongitude) : null,
      },
      driver: driverData,
      trackingEvents: trackingEvents.map((e: any) => ({
        status: e.status,
        notes: e.notes,
        time: e.createdAt?.toISOString() || null,
      })),
    });
  } catch (error: any) {
    console.error("[Tracking] Error:", error.message);
    res.status(500).json({ error: "Failed to load tracking data" });
  }
});

/**
 * GET /track/:orderId — Serves the customer-facing tracking page (HTML)
 * This is a standalone HTML page with embedded CSS/JS — no React needed.
 * Uses OpenStreetMap + Leaflet for the map (free, no API key).
 */
trackingRouter.get("/track/:orderId", async (req, res) => {
  const orderId = req.params.orderId;
  const apiBase = `${req.protocol}://${req.get("host")}`;

  res.send(getTrackingPageHTML(orderId, apiBase));
});

function getTrackingPageHTML(orderId: string, apiBase: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Track Your Order — WeShop4U</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #11181C;
      min-height: 100vh;
    }
    .header {
      background: linear-gradient(135deg, #00BCD4, #00ACC1);
      color: white;
      padding: 16px 20px;
      text-align: center;
      position: sticky;
      top: 0;
      z-index: 1000;
    }
    .header h1 { font-size: 18px; font-weight: 700; }
    .header .order-num { font-size: 13px; opacity: 0.9; margin-top: 2px; }

    .status-banner {
      padding: 14px 20px;
      text-align: center;
      font-weight: 600;
      font-size: 15px;
    }
    .status-banner.active { background: #E8F5E9; color: #2E7D32; }
    .status-banner.preparing { background: #FFF3E0; color: #E65100; }
    .status-banner.delivered { background: #E8F5E9; color: #1B5E20; }
    .status-banner.cancelled { background: #FFEBEE; color: #C62828; }

    #map {
      width: 100%;
      height: 45vh;
      min-height: 280px;
    }

    .info-card {
      background: white;
      margin: 12px;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .info-card h3 {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #687076;
      margin-bottom: 8px;
    }
    .info-card .value {
      font-size: 15px;
      font-weight: 500;
    }

    .timeline {
      background: white;
      margin: 12px;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .timeline h3 {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #687076;
      margin-bottom: 12px;
    }
    .timeline-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .timeline-item:last-child { border-bottom: none; }
    .timeline-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #00BCD4;
      margin-top: 5px;
      flex-shrink: 0;
    }
    .timeline-dot.completed { background: #4CAF50; }
    .timeline-dot.pending { background: #E0E0E0; }
    .timeline-text { font-size: 14px; }
    .timeline-time { font-size: 12px; color: #9BA1A6; margin-top: 2px; }

    .driver-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
    }
    .driver-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #00BCD4;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }
    .driver-name { font-weight: 600; font-size: 15px; }
    .driver-status { font-size: 13px; color: #687076; }

    .refresh-note {
      text-align: center;
      padding: 12px;
      font-size: 12px;
      color: #9BA1A6;
    }

    .error-state {
      text-align: center;
      padding: 60px 20px;
    }
    .error-state h2 { font-size: 20px; margin-bottom: 8px; }
    .error-state p { color: #687076; }

    .loading {
      text-align: center;
      padding: 60px 20px;
      color: #687076;
    }

    .powered-by {
      text-align: center;
      padding: 20px;
      font-size: 12px;
      color: #9BA1A6;
    }
    .powered-by strong { color: #00BCD4; }
  </style>
</head>
<body>
  <div class="header">
    <h1>WeShop4U</h1>
    <div class="order-num" id="orderNum">Loading...</div>
  </div>

  <div id="statusBanner" class="status-banner active" style="display:none;"></div>

  <div id="map"></div>

  <div id="driverCard" class="info-card" style="display:none;">
    <h3>Your Driver</h3>
    <div class="driver-info">
      <div class="driver-avatar">🚗</div>
      <div>
        <div class="driver-name" id="driverName">Driver</div>
        <div class="driver-status" id="driverStatus">On the way</div>
      </div>
    </div>
  </div>

  <div class="info-card">
    <h3>Delivering To</h3>
    <div class="value" id="deliveryAddress">Loading...</div>
  </div>

  <div class="timeline" id="timelineSection">
    <h3>Order Progress</h3>
    <div id="timelineItems"></div>
  </div>

  <div class="refresh-note">Updates every 10 seconds</div>
  <div class="powered-by">Powered by <strong>WeShop4U</strong></div>

  <script>
    const ORDER_ID = '${orderId}';
    // Use relative URL to avoid http/https protocol mismatch through proxies
    const API_BASE = '';
    let map, driverMarker, storeMarker, deliveryMarker;
    let lastStatus = null;

    // Custom icons
    const driverIcon = L.divIcon({
      className: '',
      html: '<div style="background:#00BCD4;color:white;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🚗</div>',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    const storeIcon = L.divIcon({
      className: '',
      html: '<div style="background:#FF9800;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2);">🏪</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    const homeIcon = L.divIcon({
      className: '',
      html: '<div style="background:#4CAF50;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2);">🏠</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    // Initialize map
    map = L.map('map', { zoomControl: true, attributionControl: false }).setView([53.61, -6.18], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const statusLabels = {
      pending: '⏳ Order Received',
      accepted: '✅ Order Confirmed',
      preparing: '👨‍🍳 Being Prepared',
      ready_for_pickup: '📦 Ready for Pickup',
      picked_up: '🚗 Driver Has Your Order',
      on_the_way: '🚗 On The Way To You',
      delivered: '✅ Delivered!',
      cancelled: '❌ Order Cancelled',
    };

    const statusBannerClass = {
      pending: 'preparing',
      accepted: 'preparing',
      preparing: 'preparing',
      ready_for_pickup: 'preparing',
      picked_up: 'active',
      on_the_way: 'active',
      delivered: 'delivered',
      cancelled: 'cancelled',
    };

    function formatTime(isoStr) {
      if (!isoStr) return '';
      const d = new Date(isoStr);
      return d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
    }

    function updateTimeline(order) {
      const steps = [
        { label: 'Order Placed', time: order.createdAt, done: true },
        { label: 'Order Confirmed', time: order.acceptedAt, done: !!order.acceptedAt },
        { label: 'Picked Up by Driver', time: order.pickedUpAt, done: !!order.pickedUpAt },
        { label: 'Delivered', time: order.deliveredAt, done: !!order.deliveredAt },
      ];

      const html = steps.map((s: any) => {
        const dotClass = s.done ? 'completed' : 'pending';
        return '<div class="timeline-item">' +
          '<div class="timeline-dot ' + dotClass + '"></div>' +
          '<div><div class="timeline-text">' + s.label + '</div>' +
          (s.time ? '<div class="timeline-time">' + formatTime(s.time) + '</div>' : '') +
          '</div></div>';
      }).join('');

      document.getElementById('timelineItems').innerHTML = html;
    }

    async function fetchTracking() {
      try {
        const resp = await fetch('/api/track/' + ORDER_ID);
        if (!resp.ok) {
          if (resp.status === 404) {
            document.getElementById('orderNum').textContent = 'Order not found';
            document.getElementById('map').style.display = 'none';
            return;
          }
          throw new Error('Failed to fetch');
        }

        const data = await resp.json();
        const { order, store, driver } = data;

        // Update header
        document.getElementById('orderNum').textContent = 'Order ' + order.orderNumber;

        // Update status banner
        const banner = document.getElementById('statusBanner');
        banner.style.display = 'block';
        banner.textContent = statusLabels[order.status] || order.status;
        banner.className = 'status-banner ' + (statusBannerClass[order.status] || 'active');

        // Update delivery address
        document.getElementById('deliveryAddress').textContent = order.deliveryAddress || 'Address not available';

        // Update timeline
        updateTimeline(order);

        // Update map markers
        const bounds = [];

        // Store marker
        if (store && store.latitude && store.longitude) {
          if (!storeMarker) {
            storeMarker = L.marker([store.latitude, store.longitude], { icon: storeIcon })
              .addTo(map)
              .bindPopup('<b>' + (store.name || 'Store') + '</b>');
          }
          bounds.push([store.latitude, store.longitude]);
        }

        // Delivery marker
        if (order.delivery && order.delivery.latitude && order.delivery.longitude) {
          if (!deliveryMarker) {
            deliveryMarker = L.marker([order.delivery.latitude, order.delivery.longitude], { icon: homeIcon })
              .addTo(map)
              .bindPopup('<b>Delivery Location</b>');
          }
          bounds.push([order.delivery.latitude, order.delivery.longitude]);
        }

        // Driver marker
        if (driver && driver.latitude && driver.longitude) {
          document.getElementById('driverCard').style.display = 'block';
          document.getElementById('driverName').textContent = driver.name || 'Your Driver';
          
          const driverStatusText = {
            picked_up: 'Heading to you',
            on_the_way: 'On the way to you',
            accepted: 'Assigned to your order',
            preparing: 'Waiting at store',
            ready_for_pickup: 'Heading to store',
          };
          document.getElementById('driverStatus').textContent = driverStatusText[order.status] || 'Active';

          if (!driverMarker) {
            driverMarker = L.marker([driver.latitude, driver.longitude], { icon: driverIcon })
              .addTo(map)
              .bindPopup('<b>' + (driver.name || 'Driver') + '</b>');
          } else {
            driverMarker.setLatLng([driver.latitude, driver.longitude]);
          }
          bounds.push([driver.latitude, driver.longitude]);
        } else {
          document.getElementById('driverCard').style.display = 'none';
        }

        // Fit map to bounds on first load or status change
        if (bounds.length > 0 && lastStatus !== order.status) {
          if (bounds.length === 1) {
            map.setView(bounds[0], 15);
          } else {
            map.fitBounds(bounds, { padding: [40, 40] });
          }
        }

        lastStatus = order.status;

        // Stop polling if delivered or cancelled
        if (order.status === 'delivered' || order.status === 'cancelled') {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Tracking fetch error:', err);
      }
    }

    // Initial fetch
    fetchTracking();

    // Poll every 10 seconds
    const pollInterval = setInterval(fetchTracking, 10000);
  </script>
</body>
</html>`;
}

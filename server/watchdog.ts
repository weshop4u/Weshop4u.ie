import { getDb } from "./db";
import { drivers, orders, stores, users } from "../drizzle/schema";
import { eq, and, lte, inArray } from "drizzle-orm";
import { sendPushNotification } from "./services/notifications";
import { sendSMS } from "./sms";

// ---- Config ----
const OFFICE_PHONE = process.env.WATCHDOG_OFFICE_PHONE || "0894626262";
const ADMIN_PHONE = process.env.WATCHDOG_ADMIN_PHONE || "";
const PUSH_AT_MIN = 5;        // office SMS+push, push drivers
const SMS_AT_MIN = 10;        // SMS drivers + admin
const OFFICE_REPEAT_MIN = 10; // office re-SMS every 10 min while stuck
const ADMIN_REPEAT_AT_MIN = 30;
const CAP_MIN = 45;           // stop all alerting after this

// ---- Per-order alert tracking (in-memory) ----
type OrderTrack = {
  pushedDrivers: Set<number>;
  smsedDrivers: Set<number>;
  officeAlerted: boolean;
  adminSmsed: boolean;
  adminRepeated: boolean;
  lastOfficeRepeat: number;
};
const tracked = new Map<number, OrderTrack>();

function getTrack(orderId: number): OrderTrack {
  let t = tracked.get(orderId);
  if (!t) {
    t = {
      pushedDrivers: new Set(),
      smsedDrivers: new Set(),
      officeAlerted: false,
      adminSmsed: false,
      adminRepeated: false,
      lastOfficeRepeat: 0,
    };
    tracked.set(orderId, t);
  }
  return t;
}

async function watchdogTick() {
  try {
    const db = await getDb();
    if (!db) return;

    const cutoff = new Date(Date.now() - PUSH_AT_MIN * 60 * 1000);
    const stuck = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        storeId: orders.storeId,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(
        and(
          eq(orders.status, "pending"),
          lte(orders.createdAt, cutoff)
        )
      );

    const stuckIds = new Set(stuck.map(o => o.id));
    for (const id of tracked.keys()) {
      if (!stuckIds.has(id)) tracked.delete(id);
    }
    if (stuck.length === 0) return;

    const onlineDrivers = await db
      .select({
        driverId: drivers.id,
        userId: drivers.userId,
        name: users.name,
        phone: users.phone,
        pushToken: users.pushToken,
      })
      .from(drivers)
      .innerJoin(users, eq(users.id, drivers.userId))
      .where(eq(drivers.isOnline, true));

    const storeIds = [...new Set(stuck.map(o => o.storeId).filter((x): x is number => x != null))];
    const storeRows = storeIds.length
      ? await db.select({ id: stores.id, name: stores.name }).from(stores).where(inArray(stores.id, storeIds))
      : [];
    const storeName = new Map(storeRows.map(s => [s.id, s.name]));

    for (const order of stuck) {
      const mins = Math.floor((Date.now() - new Date(order.createdAt as any).getTime()) / 60000);
      if (mins > CAP_MIN) continue;

      const track = getTrack(order.id);
      const store = order.storeId != null ? (storeName.get(order.storeId) || "store") : "store";
      const msg = `WeShop4U: Order #${order.orderNumber} pending at ${store} for ${mins} min — please advise staff there is a job waiting`;
      const noDrivers = onlineDrivers.length === 0;

      // ---- 5 min: office SMS + admin push ----
      if (mins >= PUSH_AT_MIN && !track.officeAlerted) {
        track.officeAlerted = true;
        track.lastOfficeRepeat = mins;
        sendSMS({ to: OFFICE_PHONE, message: msg }).catch(e => console.error("[Watchdog] office SMS failed:", e));
        try {
          const admins = await db
            .select({ pushToken: users.pushToken })
            .from(users)
            .where(eq(users.role, "admin"));
          for (const a of admins) {
            if (a.pushToken) {
              sendPushNotification(a.pushToken, {
                title: "⚠️ Pending order not accepted",
                body: msg,
                data: { type: "watchdog", orderId: order.id },
              } as any).catch(() => {});
            }
          }
        } catch (e) {
          console.error("[Watchdog] admin push failed:", e);
        }
      }

      // ---- Push any online driver not yet pushed (catch-up on login) ----
      if (mins >= PUSH_AT_MIN) {
        for (const d of onlineDrivers) {
          if (d.pushToken && !track.pushedDrivers.has(d.driverId)) {
            track.pushedDrivers.add(d.driverId);
            sendPushNotification(d.pushToken, {
              title: "⚠️ Order waiting — office may not know",
              body: msg,
              data: { type: "watchdog", orderId: order.id },
            } as any).catch(() => {});
          }
        }
      }

      // ---- 10 min: SMS all online drivers (catch-up too) + admin SMS ----
      if (mins >= SMS_AT_MIN) {
        for (const d of onlineDrivers) {
          if (d.phone && !track.smsedDrivers.has(d.driverId)) {
            track.smsedDrivers.add(d.driverId);
            sendSMS({ to: d.phone, message: msg }).catch(() => {});
          }
        }
        if (ADMIN_PHONE && !track.adminSmsed) {
          track.adminSmsed = true;
          const extra = noDrivers ? " (NO DRIVERS ONLINE)" : "";
          sendSMS({ to: ADMIN_PHONE, message: msg + extra }).catch(() => {});
        }
      }

      // ---- Office repeat every 10 min while still stuck ----
      if (track.officeAlerted && mins - track.lastOfficeRepeat >= OFFICE_REPEAT_MIN) {
        track.lastOfficeRepeat = mins;
        sendSMS({ to: OFFICE_PHONE, message: msg }).catch(() => {});
      }

      // ---- Admin repeat at 30 min ----
      if (ADMIN_PHONE && mins >= ADMIN_REPEAT_AT_MIN && !track.adminRepeated) {
        track.adminRepeated = true;
        sendSMS({ to: ADMIN_PHONE, message: `STUCK 30+ MIN — ${msg}` }).catch(() => {});
      }
    }
  } catch (e) {
    console.error("[Watchdog] tick failed:", e);
  }
}

export function startWatchdog() {
  console.log("[Watchdog] started — checking pending orders every 60s");
  setInterval(watchdogTick, 60 * 1000);
}

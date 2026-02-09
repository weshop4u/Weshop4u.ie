import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { storesRouter } from "./routers/stores";
import { ordersRouter } from "./routers/orders";
import { deliveryRouter } from "./routers/delivery";
import { driversRouter } from "./routers/drivers";
import { storeRouter } from "./routers/store";
import { authRouter } from "./routers/auth";
import { notificationsRouter } from "./routers/notifications";
import { usersRouter } from "./routers/users";
import { addressesRouter } from "./routers/addresses";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: authRouter,

  // WESHOP4U feature routers
  stores: storesRouter,
  orders: ordersRouter,
  delivery: deliveryRouter,
  drivers: driversRouter,
  store: storeRouter,
  notifications: notificationsRouter,
  users: usersRouter,
  addresses: addressesRouter,
});

export type AppRouter = typeof appRouter;

import { Hono } from "hono";
import type { Env } from "./types";
import config from "./routes/config";
import destinations from "./routes/destinations";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ status: "ok" }));
app.route("/api/config", config);
app.route("/api/destinations", destinations);

export default app;

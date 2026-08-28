import { Hono } from "hono";
import type { Env } from "../types";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => {
  return c.json({ mapTilerApiKey: c.env.MAPTILER_API_KEY });
});

export default app;

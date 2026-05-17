import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import authRoutes from "./routes/auth.routes";
import authorRoutes from "./routes/author.routes";
import adminRoutes from "./routes/admin.routes";
import { errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  // Serve uploaded files before helmet so the CORP header is cross-origin,
  // allowing the browser on :3000/:3001 to load images from :4000.
  app.use(
    "/uploads",
    (_req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    },
    express.static(path.join(__dirname, "../uploads"))
  );

  app.use(helmet());
  app.use(
    cors({
      origin: [env.CORS_ORIGIN_AUTHOR, env.CORS_ORIGIN_ADMIN],
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));

  /**
   * @openapi
   * /health:
   *   get:
   *     tags: [Health]
   *     summary: Health check
   *     security: []
   *     responses:
   *       200:
   *         description: API is running
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status: { type: string, example: ok }
   */
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/api/docs.json", (_req, res) => {
    res.json(swaggerSpec);
  });

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/author", authorRoutes);
  app.use("/api/v1/admin", adminRoutes);

  app.use(errorHandler);
  return app;
}

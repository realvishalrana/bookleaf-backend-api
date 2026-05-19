import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import authRoutes from "./modules/auth/auth.routes";
import authorRoutes from "./modules/author";
import adminRoutes from "./modules/admin";
import healthRoutes from "./modules/health/health.routes";
import { errorHandler } from "./shared/middleware/errorHandler";

export function createApp() {
  const app = express();

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

  app.use("/health", healthRoutes);

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

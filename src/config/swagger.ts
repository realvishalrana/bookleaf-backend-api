import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "BookLeaf API",
      version: "1.0.0",
      description:
        "REST API for BookLeaf Author Support Portal. Use **Authorize** with the JWT from `POST /api/v1/auth/login`.",
    },
    servers: [{ url: `http://localhost:${env.PORT}` }],
    tags: [
      { name: "Health", description: "Service health" },
      { name: "Auth", description: "Authentication" },
      { name: "Author", description: "Author portal (role: AUTHOR)" },
      { name: "Admin", description: "Admin portal (role: ADMIN)" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            details: { type: "array", items: { type: "object" } },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "priya.sharma@email.com" },
            password: { type: "string", example: "BookLeaf@2025" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string" },
            role: { type: "string", enum: ["AUTHOR", "ADMIN"] },
            authorId: { type: "string", nullable: true },
            name: { type: "string", nullable: true },
          },
        },
        TicketStatus: {
          type: "string",
          enum: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
        },
        TicketCategory: {
          type: "string",
          enum: [
            "ROYALTY_PAYMENTS",
            "ISBN_METADATA",
            "PRINTING_QUALITY",
            "DISTRIBUTION_AVAILABILITY",
            "BOOK_STATUS_PRODUCTION",
            "GENERAL_INQUIRY",
          ],
        },
        Priority: {
          type: "string",
          enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
        },
      },
    },
  },
  apis: ["./src/routes/*.ts", "./src/app.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);

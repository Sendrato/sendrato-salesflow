import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { sdk } from "./sdk";
import { registerAuthRoutes } from "./auth";
import { registerChatRoutes } from "./chat";
import { registerCrmChatRoutes } from "../crmChat";
import { registerBrainstormChatRoutes } from "../brainstormChat";
import { registerIntegrationRoutes } from "../integrations";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Auth routes (login, register)
  registerAuthRoutes(app);
  // Chat API with streaming and tool calling
  registerChatRoutes(app);
  // CRM AI Chat with RAG
  registerCrmChatRoutes(app);
  // Brainstorm AI Chat
  registerBrainstormChatRoutes(app);
  // robots.txt — block crawlers from share links and raw uploads
  app.get("/robots.txt", (_req, res) => {
    res
      .type("text/plain")
      .send(
        "User-agent: *\nDisallow: /share/\nDisallow: /api/\nDisallow: /uploads/\n"
      );
  });
  // Serve uploaded files from local storage — STAFF ONLY.
  // Raw /uploads/* is no longer public: external recipients view documents
  // through the tokened /share/:token handler, which streams the file. This
  // guard requires a valid staff session cookie, so anonymous clients and
  // crawlers/archivers (e.g. Save-Page-Now) cannot fetch or archive raw files.
  app.use(
    "/uploads",
    async (req, res, next) => {
      const cookies = parseCookie(req.headers.cookie || "");
      const session = await sdk.verifySession(cookies[COOKIE_NAME]);
      if (!session) {
        res.status(401).send("Authentication required");
        return;
      }
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.setHeader("Cache-Control", "private, no-store");
      next();
    },
    express.static(path.resolve(process.cwd(), "uploads"))
  );
  // Integration routes: email ingest, Slack, import
  registerIntegrationRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);

    // Start IMAP email polling (non-blocking)
    import("../imapPoller")
      .then(({ startImapPolling }) => startImapPolling())
      .catch(err => console.warn("[IMAP] Failed to start polling:", err));
  });
}

startServer().catch(console.error);

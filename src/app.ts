import express from "express";
import path from "path";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import accidentRoutes from "./routes/accident.routes";
import menuRoutes from "./routes/menu.routes";
import publicRoutes from "./routes/public.routes";
import brandingRoutes from "./routes/branding.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import noticeRoutes from "./routes/notice.routes";
import investmentDisclosureRoutes from "./routes/investment-disclosure.routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();
const projectRoot = path.join(__dirname, "..");

app.use(express.json({ limit: "200mb" }));

app.use("/uploads", express.static(path.join(projectRoot, "uploads")));

app.get("/", (_req, res) => {
  res.sendFile(path.join(projectRoot, "public-dashboard-accidents.html"));
});

app.get("/public/dashboard/accidents", (_req, res) => {
  res.sendFile(path.join(projectRoot, "public-dashboard-accidents.html"));
});

app.get("/public/dashboard/investment-disclosure", (_req, res) => {
  res.sendFile(path.join(projectRoot, "public-dashboard-investment-disclosure.html"));
});

app.get("/login", (_req, res) => {
  res.sendFile(path.join(projectRoot, "login.html"));
});

app.get("/register", (_req, res) => {
  res.sendFile(path.join(projectRoot, "register.html"));
});

const portalMainPages = ["/portal", "/dashboard", "/dashboard/accidents", "/dashboard/notices"];
for (const route of portalMainPages) {
  app.get(route, (_req, res) => {
    res.sendFile(path.join(projectRoot, "index.html"));
  });
}

app.get("/dashboard/investment-disclosure", (_req, res) => {
  res.sendFile(path.join(projectRoot, "investment-disclosure-dashboard.html"));
});

app.get("/notices", (_req, res) => {
  res.sendFile(path.join(projectRoot, "notices.html"));
});

app.get("/notices/detail", (_req, res) => {
  res.sendFile(path.join(projectRoot, "notice-detail.html"));
});

app.get("/archive", (_req, res) => {
  res.sendFile(path.join(projectRoot, "archive.html"));
});

const accidentPages = ["/accidents", "/accidents/stats", "/accidents/causes"];
for (const route of accidentPages) {
  app.get(route, (_req, res) => {
    res.sendFile(path.join(projectRoot, "accidents.html"));
  });
}

app.get("/accidents/detail", (_req, res) => {
  res.sendFile(path.join(projectRoot, "accident-detail.html"));
});

app.get("/investment-disclosure", (_req, res) => {
  res.sendFile(path.join(projectRoot, "investment-disclosure.html"));
});

const adminPages = [
  "/admin",
  "/admin/users",
  "/admin/login-logs",
  "/admin/menus",
  "/admin/roles",
  "/admin/codes",
  "/admin/code-relations",
  "/admin/external-apis",
  "/admin/registrations",
  "/admin/accident-db-publication",
  "/admin/investment-disclosure",
];
for (const route of adminPages) {
  app.get(route, (_req, res) => {
    res.sendFile(path.join(projectRoot, "admin.html"));
  });
}

app.get("/health", (_req, res) => {
  res.status(200).json({ message: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/accidents", accidentRoutes);
app.use("/api/menus", menuRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/branding", brandingRoutes);
app.use("/api/investment-disclosure", investmentDisclosureRoutes);

app.use(express.static(projectRoot, { index: false }));

app.use(errorHandler);

export default app;

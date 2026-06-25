import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { authorizeRoles } from "../middlewares/role.middleware";
import { ROLES } from "../constants/roles";
import adminMenuRoutes from "./admin-menu.routes";
import adminPermissionRoutes from "./admin-permission.routes";
import adminBrandingRoutes from "./admin-branding.routes";
import adminUserRoutes from "./admin-user.routes";
import adminCodeRoutes from "./admin-code.routes";
import adminNoticeRoutes from "./admin-notice.routes";
import adminRegistrationRoutes from "./admin-registration.routes";
import adminExternalApiRoutes from "./admin-external-api.routes";
import adminInvestmentDisclosureRoutes from "./admin-investment-disclosure.routes";
import adminFloodAlertRoutes from "./admin-flood-alert.routes";
import adminAccidentDbPublicationRoutes from "./admin-accident-db-publication.routes";
import adminLoginLogRoutes from "./admin-login-log.routes";
import adminUsageLogRoutes from "./admin-usage-log.routes";
import adminSelfReportRoutes from "./admin-self-report.routes";

const router = Router();

router.use(authenticate, authorizeRoles(ROLES.ADMIN));

router.get("/dashboard", (_req, res) => {
  res.status(200).json({ message: "Welcome ADMIN. You can access this resource." });
});

router.use("/", adminMenuRoutes);
router.use("/", adminPermissionRoutes);
router.use("/", adminBrandingRoutes);
router.use("/", adminUserRoutes);
router.use("/", adminCodeRoutes);
router.use("/", adminNoticeRoutes);
router.use("/", adminRegistrationRoutes);
router.use("/", adminExternalApiRoutes);
router.use("/", adminInvestmentDisclosureRoutes);
router.use("/", adminFloodAlertRoutes);
router.use("/", adminAccidentDbPublicationRoutes);
router.use("/", adminLoginLogRoutes);
router.use("/", adminUsageLogRoutes);
router.use("/self-report", adminSelfReportRoutes);

export default router;

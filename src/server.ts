import app from "./app";
import { rainfallSyncService } from "./bootstrap/flood-alert-services";
import { env } from "./config/env";
import { startRainfallSyncScheduler } from "./jobs/rainfall-sync.scheduler";
import { syncDefaultMenus } from "./services/default-menu-sync.service";

void syncDefaultMenus().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Default menu sync failed:", error);
});

startRainfallSyncScheduler(rainfallSyncService);

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server is running on http://localhost:${env.port}`);
});
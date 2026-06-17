import { RAINFALL_SYNC_INTERVAL_MS } from "../constants/rainfall-cache";
import type { RainfallSyncService } from "../services/rainfall-sync.service";

export function startRainfallSyncScheduler(
  rainfallSyncService: RainfallSyncService,
  intervalMs = RAINFALL_SYNC_INTERVAL_MS,
): NodeJS.Timeout {
  const run = async () => {
    try {
      const result = await rainfallSyncService.syncAll();
      // eslint-disable-next-line no-console
      console.log(
        `[rainfall-sync] stations=${result.stationCount} refreshed=${result.refreshed} failed=${result.failed}`,
      );
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[rainfall-sync] failed:", error);
    }
  };

  void run();
  return setInterval(run, intervalMs);
}

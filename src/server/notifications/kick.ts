import "server-only";
import { after } from "next/server";
import { processWebhooks } from "@/server/partner/webhooks";
import { processOutbox } from "./send";

/**
 * Sends just-queued messages right after the response, so customers don't wait
 * for the next cron run. The cron still picks up anything this misses.
 */
export function kickOutbox() {
  after(async () => {
    try {
      await processOutbox(10);
    } catch (err) {
      console.error("[outbox] immediate send failed", err);
    }
    try {
      await processWebhooks(10);
    } catch (err) {
      console.error("[webhooks] immediate send failed", err);
    }
  });
}

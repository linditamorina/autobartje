-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "trackingToken" SET DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

-- CreateIndex
CREATE INDEX "NotificationOutbox_providerId_idx" ON "NotificationOutbox"("providerId");

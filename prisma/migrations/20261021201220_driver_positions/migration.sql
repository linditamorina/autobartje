-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "trackingToken" SET DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

-- CreateTable
CREATE TABLE "DriverPosition" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracyM" INTEGER,
    "speedKmh" INTEGER,
    "heading" INTEGER,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriverPosition_orderId_recordedAt_idx" ON "DriverPosition"("orderId", "recordedAt");

-- CreateIndex
CREATE INDEX "DriverPosition_driverId_recordedAt_idx" ON "DriverPosition"("driverId", "recordedAt");

-- CreateIndex
CREATE INDEX "DriverPosition_createdAt_idx" ON "DriverPosition"("createdAt");

-- AddForeignKey
ALTER TABLE "DriverPosition" ADD CONSTRAINT "DriverPosition_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverPosition" ADD CONSTRAINT "DriverPosition_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

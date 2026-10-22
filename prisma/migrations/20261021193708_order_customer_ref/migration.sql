-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerRef" TEXT,
ALTER COLUMN "trackingToken" SET DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

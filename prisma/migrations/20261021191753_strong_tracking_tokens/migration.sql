-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "trackingToken" SET DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

-- cuid tokens are partly predictable (time and counter); give every order a random one.
UPDATE "Order" SET "trackingToken" = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

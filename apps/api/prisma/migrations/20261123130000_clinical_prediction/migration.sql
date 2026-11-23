-- Additive migration: preserves all singleton and ownership triggers.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
ALTER TABLE "Patient" ADD COLUMN "name" TEXT;
ALTER TABLE "Patient" ADD COLUMN "datasetSplit" TEXT;
ALTER TABLE "Assessment" ADD COLUMN "predictedAt" DATETIME;

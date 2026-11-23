-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "adminSlot" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_role_adminSlot_check" CHECK (
      ("role" = 'ADMIN' AND "adminSlot" IS NOT NULL AND "adminSlot" = 1 AND "active" = true)
      OR ("role" = 'DOCTOR' AND "adminSlot" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "sourceSubjectId" INTEGER,
    "doctorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Patient_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "referenceLabel" TEXT,
    "prediction" INTEGER,
    "predictedLabel" TEXT,
    "modelVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PatientTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "fromDoctorId" TEXT NOT NULL,
    "toDoctorId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatientTransfer_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_adminSlot_key" ON "User"("adminSlot");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_code_key" ON "Patient"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_sourceSubjectId_key" ON "Patient"("sourceSubjectId");

-- CreateIndex
CREATE INDEX "Patient_doctorId_idx" ON "Patient"("doctorId");

-- CreateIndex
CREATE INDEX "Assessment_patientId_createdAt_idx" ON "Assessment"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "PatientTransfer_patientId_createdAt_idx" ON "PatientTransfer"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- The unique slot permits at most one administrator; once seeded, it cannot
-- be deleted or demoted. No public API can create an administrator.
CREATE TRIGGER "protect_admin_delete" BEFORE DELETE ON "User"
WHEN OLD."role" = 'ADMIN'
BEGIN
  SELECT RAISE(ABORT, 'The system administrator cannot be deleted');
END;

CREATE TRIGGER "protect_admin_role" BEFORE UPDATE OF "role", "adminSlot", "active" ON "User"
WHEN OLD."role" = 'ADMIN' AND (NEW."role" != 'ADMIN' OR NEW."adminSlot" IS NULL OR NEW."adminSlot" != 1 OR NEW."active" != true)
BEGIN
  SELECT RAISE(ABORT, 'The system administrator cannot be demoted or disabled');
END;

CREATE TRIGGER "patient_doctor_insert" BEFORE INSERT ON "Patient"
WHEN NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = NEW."doctorId" AND "role" = 'DOCTOR' AND "active" = true)
BEGIN
  SELECT RAISE(ABORT, 'Patient owner must be an active doctor');
END;

CREATE TRIGGER "patient_doctor_update" BEFORE UPDATE OF "doctorId" ON "Patient"
WHEN NOT EXISTS (SELECT 1 FROM "User" WHERE "id" = NEW."doctorId" AND "role" = 'DOCTOR' AND "active" = true)
BEGIN
  SELECT RAISE(ABORT, 'Patient owner must be an active doctor');
END;

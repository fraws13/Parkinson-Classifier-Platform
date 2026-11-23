import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { createDb } from '../src/db/prisma.js';

const db = createDb();
try {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const doctorPassword = process.env.DOCTOR_PASSWORD;
  if (!adminPassword || !doctorPassword || adminPassword.length < 12 || doctorPassword.length < 12 || adminPassword === doctorPassword) {
    throw new Error('Imposta ADMIN_PASSWORD e DOCTOR_PASSWORD differenti, di almeno 12 caratteri, nel file apps/api/.env.');
  }
  const rows = JSON.parse(readFileSync(new URL('../../../contracts/patients_seed.json', import.meta.url), 'utf8'));
  const featureSchema = JSON.parse(readFileSync(new URL('../../../contracts/feature_schema.json', import.meta.url), 'utf8'));
  const split = JSON.parse(readFileSync(new URL('../../../contracts/dataset_split.json', import.meta.url), 'utf8'));
  const trainIds = new Set(split.train_subject_ids);
  // Upserts preserve existing credentials, assignments and histories on subsequent runs.
  const admin = await db.user.upsert({ where: { email: 'admin@parkinson.local' }, update: {}, create: { email: 'admin@parkinson.local', name: 'Amministratore di sistema', role: 'ADMIN', adminSlot: 1, passwordHash: await bcrypt.hash(adminPassword, 12) } });
  const doctors = [];
  for (const [email, name] of [['rossi@parkinson.local', 'Dott.ssa Elena Rossi'], ['bianchi@parkinson.local', 'Dott. Marco Bianchi'], ['verdi@parkinson.local', 'Dott.ssa Giulia Verdi']]) {
    doctors.push(await db.user.upsert({ where: { email }, update: {}, create: { email, name, role: 'DOCTOR', passwordHash: await bcrypt.hash(doctorPassword, 12) } }));
  }
  await db.$transaction(async tx => {
    for (const [index, row] of rows.entries()) {
      const code = `PAH-${String(row.subject_id).padStart(3, '0')}`;
      const exists = await tx.patient.findUnique({ where: { sourceSubjectId: row.subject_id } });
      if (exists) continue;
      await tx.patient.create({ data: { code, sourceSubjectId: row.subject_id, datasetSplit: trainIds.has(row.subject_id) ? 'TRAIN' : 'TEST', doctorId: doctors[index % doctors.length].id, assessments: { create: { features: row.features, schemaVersion: featureSchema.version, source: 'PAHAW_REFERENCE', referenceLabel: row.disease } } } });
    }
    const logged = await tx.auditLog.findFirst({ where: { action: 'DEMO_IMPORTED' } });
    if (!logged) await tx.auditLog.create({ data: { actorId: admin.id, action: 'DEMO_IMPORTED', targetId: 'pahaw-demo' } });
  }, { timeout: 30000 });
  console.log('Seed completato: amministratore, 3 medici e 72 soggetti demo. Credenziali esistenti e assegnazioni preservate.');
} finally {
  await db.$disconnect();
}

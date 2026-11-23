// Explicit opt-in demo setup: not called on startup or by production seed.
import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import { createDb } from '../src/db/prisma.js';

if (process.env.NODE_ENV === 'production') throw new Error('Demo credentials are forbidden in production.');
const split = JSON.parse(readFileSync(new URL('../../../contracts/dataset_split.json', import.meta.url), 'utf8'));
const train = new Set(split.train_subject_ids);
const test = new Set(split.test_subject_ids);
if (train.size !== 57 || test.size !== 15 || [...train].some(id => test.has(id))) throw new Error('Invalid split manifest');
const db = createDb();
try {
  const passwordHash = await bcrypt.hash('admin', 12);
  await db.$transaction(async tx => {
    const admin = await tx.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    await tx.user.update({ where: { id: admin.id }, data: { username: 'admin', passwordHash } });
    const doctors = await tx.user.findMany({ where: { role: 'DOCTOR' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    for (const [index, doctor] of doctors.entries()) {
      await tx.user.update({ where: { id: doctor.id }, data: { username: index === 0 ? 'medic' : `medic${index + 1}`, passwordHash } });
    }
    const imported = await tx.patient.findMany({ where: { sourceSubjectId: { not: null } } });
    for (const patient of imported) {
      const datasetSplit = train.has(patient.sourceSubjectId) ? 'TRAIN' : test.has(patient.sourceSubjectId) ? 'TEST' : null;
      await tx.patient.update({ where: { id: patient.id }, data: { datasetSplit } });
    }
    await tx.session.deleteMany();
  });
  console.log('Demo aggiornata: admin/admin; medic, medic2, medic3… / admin. Sessioni revocate. Solo training e pazienti manuali visibili.');
} finally { await db.$disconnect(); }

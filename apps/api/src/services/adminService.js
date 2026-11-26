import bcrypt from 'bcryptjs';
import { publicUser } from './authService.js';
import { operationalPatients } from './patientScope.js';

export function createAdminService(db) {
  return {
    async listDoctors() {
      const users = await db.user.findMany({ where: { role: 'DOCTOR' }, orderBy: { name: 'asc' }, select: { id: true, name: true, email: true, username: true, active: true, _count: { select: { patients: { where: operationalPatients } } } } });
      return users.map(({ _count, ...user }) => ({ ...user, patientCount: _count.patients }));
    },
    async registerDoctor(body, actorId) {
      const passwordHash = await bcrypt.hash(body.password, 12);
      const user = await db.$transaction(async tx => {
        const created = await tx.user.create({ data: { email: body.email, username: body.username || null, name: body.name, passwordHash, role: 'DOCTOR' } });
        await tx.auditLog.create({ data: { actorId, action: 'DOCTOR_REGISTERED', targetId: created.id } });
        return created;
      });
      return publicUser(user);
    },
    deleteDoctor(doctorId, actorId) {
      return db.$transaction(async tx => {
        const doctor = await tx.user.findFirst({ where: { id: doctorId, role: 'DOCTOR' }, select: { id: true, name: true } });
        if (!doctor) return { status: 404, error: 'Medico non disponibile.' };

        const patientCount = await tx.patient.count({ where: { doctorId } });
        if (patientCount > 0) {
          return { status: 409, error: 'Il medico ha pazienti assegnati. Trasferisci prima tutte le assegnazioni.' };
        }

        const activityCount = await tx.auditLog.count({ where: { actorId: doctorId } });
        if (activityCount > 0) {
          return { status: 409, error: 'Il medico ha attività nello storico e non può essere eliminato.' };
        }

        await tx.user.delete({ where: { id: doctorId } });
        await tx.auditLog.create({ data: { actorId, action: 'DOCTOR_DELETED', targetId: doctorId } });
        return { status: 204 };
      });
    },
    listPatients() {
      // Administrative metadata only: no clinical features or results.
      return db.patient.findMany({ where: operationalPatients, orderBy: { code: 'asc' }, select: { id: true, code: true, doctorId: true, doctor: { select: { id: true, name: true } } } });
    },
    transferPatient(patientId, body, actorId) {
      return db.$transaction(async tx => {
        const target = await tx.user.findFirst({ where: { id: body.toDoctorId, role: 'DOCTOR', active: true } });
        if (!target) return { status: 400, error: 'Il destinatario deve essere un medico attivo.' };
        if (body.toDoctorId === body.expectedDoctorId) return { status: 400, error: 'Seleziona un medico diverso da quello attuale.' };
        const updated = await tx.patient.updateMany({ where: { id: patientId, doctorId: body.expectedDoctorId, ...operationalPatients }, data: { doctorId: body.toDoctorId } });
        if (!updated.count) return { status: 409, error: 'Assegnazione modificata o paziente non disponibile. Aggiorna la lista.' };
        await tx.patientTransfer.create({ data: { patientId, fromDoctorId: body.expectedDoctorId, toDoctorId: body.toDoctorId, actorId } });
        await tx.auditLog.create({ data: { actorId, action: 'PATIENT_TRANSFERRED', targetId: patientId } });
        return { status: 200 };
      });
    },
  };
}

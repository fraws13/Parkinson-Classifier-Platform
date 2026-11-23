export function createDashboardService(db, telemetry) {
  return {
    async snapshot() {
      const [doctors, patients, assessments, transfers, events] = await db.$transaction([
        db.user.findMany({ where: { role: 'DOCTOR' }, select: { id: true, name: true, email: true, active: true, _count: { select: { patients: { where: operationalPatients } } } }, orderBy: { name: 'asc' } }),
        db.patient.count({ where: operationalPatients }),
        db.assessment.count({ where: { patient: operationalPatients } }),
        db.patientTransfer.count(),
        db.auditLog.findMany({ take: 8, orderBy: { createdAt: 'desc' }, select: { id: true, action: true, createdAt: true, actor: { select: { name: true } } } }),
      ]);
      return {
        generatedAt: new Date().toISOString(),
        counts: { doctors: doctors.length, patients, assessments, transfers },
        doctors: doctors.map(({ _count, ...item }) => ({ ...item, patientCount: _count.patients })),
        events,
        telemetry: telemetry.snapshot(),
        targets: { users: 50000, requestsPerMinute: 5000, latencyMs: 1000, availabilityPct: 99.5, reliabilityPct: 99.5, maxOutageMinutes: 30, averageOutageMinutes: 3, window: 'Lun–Ven 08:00–18:00 (fuso operativo da configurare)' },
        limitations: {
          availability: 'Non misurata: richiede monitoraggio esterno e storico nella finestra operativa.',
          reliability: 'Non certificata: risposte HTTP senza 5xx non equivalgono ad affidabilità clinica o SLA.',
          outages: 'Durata delle interruzioni non misurata dal processo stesso.',
          inference: 'Inferenza Python su richiesta del medico. Le etichette di riferimento del dataset restano separate dalle classi predette.',
        },
      };
    },
  };
}
import { operationalPatients } from './patientScope.js';

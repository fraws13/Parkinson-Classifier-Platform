import { randomUUID } from 'node:crypto';
import { featureSchema as schema } from '../validators/clinical.js';
import { operationalPatients } from './patientScope.js';

export function createClinicalService(db, inference) {
  return {
    async listPatients(doctorId) {
      const patients = await db.patient.findMany({
        where: { doctorId, ...operationalPatients }, orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true, datasetSplit: true, createdAt: true, _count: { select: { assessments: true } }, assessments: { orderBy: { createdAt: 'desc' }, take: 1, select: { referenceLabel: true, predictedLabel: true, source: true, createdAt: true } } },
      });
      return patients.map(({ _count, assessments, ...patient }) => ({ ...patient, assessmentCount: _count.assessments, latestAssessment: assessments[0] || null }));
    },
    async getPatient(patientId, doctorId) {
      const patient = await db.patient.findFirst({
        where: { id: patientId, doctorId, ...operationalPatients },
        include: { assessments: { orderBy: { createdAt: 'desc' } } },
      });
      if (!patient) return null;
      return { patient, featureSchema: { version: schema.version, feature_names: schema.feature_names } };
    },
    createPatient(body, doctorId) {
      return db.$transaction(async tx => {
        const patient = await tx.patient.create({ data: { code: `PAT-${randomUUID().slice(0, 8).toUpperCase()}`, name: body.name, doctorId } });
        await tx.auditLog.create({ data: { actorId: doctorId, action: 'PATIENT_CREATED', targetId: patient.id } });
        return patient;
      });
    },
    createAssessment(patientId, body, doctorId) {
      return db.$transaction(async tx => {
        const patient = await tx.patient.findFirst({ where: { id: patientId, doctorId, ...operationalPatients } });
        if (!patient) return null;
        const assessment = await tx.assessment.create({ data: { patientId, features: body.features, schemaVersion: schema.version, source: 'MANUAL' } });
        await tx.auditLog.create({ data: { actorId: doctorId, action: 'ASSESSMENT_CREATED', targetId: patientId } });
        return assessment;
      });
    },
    async predict(patientId, assessmentId, doctorId) {
      const assessment = await db.assessment.findFirst({ where: { id: assessmentId, patientId, patient: { doctorId, ...operationalPatients } } });
      if (!assessment) return null;
      // Do not hold a SQLite write transaction while waiting for Python.
      const result = await inference.predict(assessment.features);
      return db.$transaction(async tx => {
        // Recheck ownership in the same write transaction as result persistence.
        const updated = await tx.assessment.updateMany({
          where: { id: assessmentId, patientId, patient: { doctorId, ...operationalPatients } },
          data: { prediction: result.prediction, predictedLabel: result.label, modelVersion: result.model_version, predictedAt: new Date() },
        });
        if (!updated.count) return null;
        await tx.auditLog.create({ data: { actorId: doctorId, action: 'PREDICTION_CREATED', targetId: patientId } });
        return { prediction: result.prediction, label: result.label, model_version: result.model_version };
      });
    },
  };
}

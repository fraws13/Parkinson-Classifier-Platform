import { newPatient, newAssessment } from '../validators/clinical.js';

export function createClinicalController(clinicalService) {
  return {
    async listPatients(req, res) {
      res.json({ patients: await clinicalService.listPatients(req.user.id) });
    },
    async getPatient(req, res) {
      const result = await clinicalService.getPatient(req.params.id, req.user.id);
      if (!result) return res.status(404).json({ error: 'Paziente non disponibile.' });
      res.json(result);
    },
    async createPatient(req, res) {
      res.status(201).json({ patient: await clinicalService.createPatient(newPatient.parse(req.body), req.user.id) });
    },
    async deletePatient(req, res) {
      const result = await clinicalService.deletePatient(req.params.id, req.user.id);
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.status(204).end();
    },
    async createAssessment(req, res) {
      const assessment = await clinicalService.createAssessment(req.params.id, newAssessment.parse(req.body), req.user.id);
      if (!assessment) return res.status(404).json({ error: 'Paziente non disponibile.' });
      res.status(201).json({ assessment });
    },
    async predict(req, res) {
      const result = await clinicalService.predict(req.params.id, req.params.assessmentId, req.user.id);
      if (!result) return res.status(404).json({ error: 'Test o paziente non disponibile: verifica l’assegnazione corrente.' });
      res.json(result);
    },
  };
}

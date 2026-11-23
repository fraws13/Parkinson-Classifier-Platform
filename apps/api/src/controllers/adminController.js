import { newDoctor, patientTransfer } from '../validators/admin.js';

export function createAdminController(adminService, dashboardService) {
  return {
    async dashboard(req, res) {
      res.json(await dashboardService.snapshot());
    },
    async listDoctors(req, res) {
      res.json({ doctors: await adminService.listDoctors() });
    },
    async registerDoctor(req, res) {
      const doctor = await adminService.registerDoctor(newDoctor.parse(req.body), req.user.id);
      res.status(201).json({ doctor });
    },
    async listPatients(req, res) {
      res.json({ patients: await adminService.listPatients() });
    },
    async transferPatient(req, res) {
      const result = await adminService.transferPatient(req.params.id, patientTransfer.parse(req.body), req.user.id);
      if (result.error) return res.status(result.status).json({ error: result.error });
      res.json({ message: 'Paziente trasferito. Permessi aggiornati.' });
    },
  };
}

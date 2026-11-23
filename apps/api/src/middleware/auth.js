export function createAuthenticated(authService) {
  return async function authenticated(req, res, next) {
    const token = req.cookies.session;
    if (!token || typeof token !== 'string') return res.status(401).json({ error: 'Accedi per continuare.' });
    const session = await authService.findSession(token);
    if (!session || session.expiresAt <= new Date() || !session.user.active) {
      return res.status(401).json({ error: 'Sessione scaduta o non valida.' });
    }
    req.user = session.user;
    req.sessionId = session.id;
    next();
  };
}

export function requireAdmin(req, res, next) {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Operazione riservata all’amministratore.' });
  next();
}

export function requireDoctor(req, res, next) {
  if (req.user.role !== 'DOCTOR') return res.status(403).json({ error: 'Dati clinici riservati al medico assegnato.' });
  next();
}

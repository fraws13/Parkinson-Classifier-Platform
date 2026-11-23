import { credentials } from '../validators/auth.js';
import { publicUser, sessionLifetime } from '../services/authService.js';

export function createAuthController(authService, { production }) {
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'strict', path: '/' };
  return {
    async login(req, res) {
      const result = await authService.login(credentials.parse(req.body));
      if (!result) return res.status(401).json({ error: 'Username o password non validi.' });
      res.cookie('session', result.token, { ...cookieOptions, maxAge: sessionLifetime });
      res.json({ user: result.user });
    },
    me(req, res) {
      res.json({ user: publicUser(req.user) });
    },
    async logout(req, res) {
      await authService.logout(req.sessionId);
      res.clearCookie('session', cookieOptions);
      res.status(204).end();
    },
  };
}

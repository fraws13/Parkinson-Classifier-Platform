import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';

export const sessionLifetime = 8 * 60 * 60 * 1000;
export const hashToken = value => createHash('sha256').update(value).digest('hex');
export const publicUser = user => ({ id: user.id, name: user.name, email: user.email, username: user.username, role: user.role });

export function createAuthService(db) {
  return {
    async login({ username, password }) {
      const user = await db.user.findFirst({ where: { OR: [{ username }, { email: username }] } });
      // Keep password work on the unknown-account path as well.
      const valid = await bcrypt.compare(password, user?.passwordHash || '$2b$12$KIXxRziJ7Wcy7Pza9MdTReYE4HiHPrQdCFlrP1i2kQXb36Cw.F8cO');
      if (!valid || !user?.active) return null;
      const token = randomBytes(32).toString('hex');
      await db.$transaction([
        db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
        db.session.create({ data: { tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + sessionLifetime) } }),
      ]);
      return { token, user: publicUser(user) };
    },
    findSession(token) {
      return db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    },
    logout(sessionId) {
      return db.session.delete({ where: { id: sessionId } });
    },
  };
}

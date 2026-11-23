export function requireTrustedOrigin(appOrigin) {
  return (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') !== appOrigin) {
      return res.status(403).json({ error: 'Origine della richiesta non consentita.' });
    }
    next();
  };
}

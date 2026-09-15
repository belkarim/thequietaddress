const BREVO_DOI_URL = 'https://api.brevo.com/v3/contacts/doubleOptinConfirmation';
const SITE = 'https://thequietaddress.com';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'invalid_json' });
  }

  // Honeypot: answer as if it worked, so a bot learns nothing.
  if (payload.hp) return json(200, { ok: true });

  const email = String(payload.email || '').trim();
  if (!EMAIL_RE.test(email)) return json(400, { ok: false, error: 'invalid_email' });

  const ville = Array.isArray(payload.ville) ? payload.ville.join(', ') : String(payload.ville || '');
  const langue = String(payload.langue || 'en').slice(0, 2).toLowerCase();

  const body = {
    email,
    includeListIds: [Number(process.env.BREVO_LIST_ID)],
    templateId: Number(process.env.BREVO_DOI_TEMPLATE_ID),
    redirectionUrl: `${SITE}/${langue === 'fr' ? 'merci.html' : 'merci-en.html'}`,
    attributes: {
      PRENOM: String(payload.prenom || '').trim(),
      VILLE_INTERET: ville,
      SOURCE: String(payload.source || 'carte'),
      LANGUE: langue,
      DATE_INSCRIPTION: new Date().toISOString().slice(0, 10),
    },
  };

  let response;
  let text;
  try {
    response = await fetch(BREVO_DOI_URL, {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    text = await response.text();
  } catch (err) {
    console.error('Brevo unreachable:', err);
    return json(502, { ok: false, error: 'upstream_unreachable' });
  }

  if (!response.ok) {
    console.error('Brevo %d for %s: %s', response.status, email, text);
    return json(502, { ok: false, error: 'upstream_error' });
  }

  return json(200, { ok: true });
};

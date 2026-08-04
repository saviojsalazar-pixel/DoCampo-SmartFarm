(function () {
  'use strict';

  const SESSION_KEY = 'docampo_supabase_session_v1';
  const cfg = () => window.DoCampoCloudConfig || {};

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function saveSession(session) {
    if (!session) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new CustomEvent('docampo:auth-change', { detail: status() }));
  }

  function status() {
    const session = readSession();
    return {
      authenticated: !!(session && session.access_token),
      email: session && session.user ? session.user.email : '',
      expiresAt: session ? Number(session.expires_at || 0) : 0
    };
  }

  async function request(path, options) {
    if (!cfg().configured) throw new Error('A nuvem ainda não foi configurada.');
    const response = await fetch(cfg().url + path, {
      ...options,
      headers: {
        'apikey': cfg().anonKey,
        'Content-Type': 'application/json',
        ...(options && options.headers ? options.headers : {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.msg || data.message || data.error_description || data.error || 'Falha na autenticação.';
      throw new Error(message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : message);
    }
    return data;
  }

  async function signIn(email, password) {
    if (!navigator.onLine) throw new Error('O primeiro acesso precisa de internet. Depois o aplicativo continua funcionando offline.');
    const session = await request('/auth/v1/token?grant_type=password', {
      method: 'POST', body: JSON.stringify({ email: String(email || '').trim(), password: String(password || '') })
    });
    saveSession(session);
    return status();
  }

  async function refresh() {
    const current = readSession();
    if (!current || !current.refresh_token) throw new Error('Entre na conta para sincronizar.');
    if (!navigator.onLine) return current.access_token;
    const session = await request('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', body: JSON.stringify({ refresh_token: current.refresh_token })
    });
    saveSession(session);
    return session.access_token;
  }

  async function accessToken() {
    const session = readSession();
    if (!session || !session.access_token) throw new Error('Entre na conta para sincronizar.');
    const now = Math.floor(Date.now() / 1000);
    if (Number(session.expires_at || 0) > now + 60) return session.access_token;
    return refresh();
  }

  function signOut() { saveSession(null); }

  window.DoCampoAuth = { signIn, signOut, accessToken, refresh, status };
})();

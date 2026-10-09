const assert = require('assert');
const { createRuntime, runFile } = require('./helpers/runtime');

(async () => {
  const context = createRuntime();
  context.AbortController = AbortController;
  context.DoCampoCloudConfig = { configured: true, url: 'https://example.supabase.co', anonKey: 'public' };
  context.fetch = async () => { throw new TypeError('Failed to fetch'); };
  runFile(context, 'www/cloud-auth.js');
  await assert.rejects(
    context.DoCampoAuth.signIn('teste@example.com', 'senha'),
    /Confirme a internet e se o projeto do Supabase está ativo/
  );

  context.fetch = async () => ({
    ok: false,
    json: async () => ({ message: 'Database error querying schema' })
  });
  await assert.rejects(
    context.DoCampoAuth.signIn('teste@example.com', 'senha'),
    /setup-v2\.sql/
  );
  console.log('cloud-auth-errors: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });

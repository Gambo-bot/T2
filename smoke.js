'use strict';
/* End-to-end smoke test: starts the server on a temp database and exercises the main workflows. Run with: npm test */
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const PORT = 3199, B = `http://localhost:${PORT}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reg-'));
const ADMIN_PW = 'Test-Admin-Pass-2026';
const srv = spawn('node', ['server.js'], { cwd: path.join(__dirname, '..'), stdio: 'inherit',
  env: { ...process.env, PORT, DB_PATH: path.join(tmp, 't.db'), ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: ADMIN_PW } });
function client() {
  let cookie = '';
  return async (m, p, b, raw) => {
    const r = await fetch(B + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'register', ...(cookie ? { cookie } : {}) }, body: b ? JSON.stringify(b) : undefined });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    if (raw) return { status: r.status, text: await r.text() };
    let d = {}; try { d = await r.json(); } catch (e) { /* none */ }
    return { status: r.status, ...d };
  };
}
let failed = 0;
const ok = (n, c) => { if (!c) failed++; console.log((c ? 'PASS  ' : 'FAIL  ') + n); };
async function waitUp() { for (let i = 0; i < 50; i++) { try { if ((await fetch(B + '/healthz')).ok) return; } catch (e) { /* retry */ } await new Promise(r => setTimeout(r, 200)); } throw new Error('server did not start'); }
(async () => {
  await waitUp();
  const A = client(), K = client(), X = client(), T = client();
  let r = await A('POST', '/api/auth/login', { username: 'admin', password: 'wrong-password' }); ok('wrong password rejected', r.status === 401);
  r = await A('POST', '/api/auth/login', { username: 'admin', password: ADMIN_PW }); ok('admin login requires password change', r.status === 200 && r.user.must_change);
  r = await A('GET', '/api/records'); ok('blocked until password changed', r.status === 403);
  r = await A('POST', '/api/auth/change-password', { current: ADMIN_PW, password: 'short' }); ok('weak password rejected', r.status === 400);
  r = await A('POST', '/api/auth/change-password', { current: ADMIN_PW, password: 'My-Strong-Pass-2026' }); ok('password changed', r.status === 200);
  r = await X('POST', '/api/auth/register', { username: 'kofi', full_name: 'Kofi Mensah', password: 'Blue-Elephant-2026' }); ok('staff registration accepted', r.status === 200);
  r = await X('POST', '/api/auth/login', { username: 'kofi', password: 'Blue-Elephant-2026' }); ok('pending staff cannot sign in', r.status === 403);
  r = await A('GET', '/api/users'); const kid = r.users.find(u => u.username === 'kofi'); ok('admin sees pending request', kid && kid.status === 'pending');
  r = await A('POST', `/api/users/${kid.id}/approve`); ok('admin approves', r.status === 200);
  r = await K('POST', '/api/auth/login', { username: 'kofi', password: 'Blue-Elephant-2026' }); ok('approved staff signs in', r.status === 200);
  r = await K('GET', '/api/users'); ok('staff cannot list users', r.status === 403);
  r = await K('GET', '/api/audit'); ok('staff cannot read audit log', r.status === 403);
  const rec = (n, v) => ({ name: n, voter_id: v, area: 'Area A', polling_station: 'PS1', phone: '0244000111', status: 'Active' });
  r = await A('POST', '/api/records', rec('Admin Voter', 'GH-001')); ok('admin adds record', r.status === 200);
  r = await K('POST', '/api/records', rec('Kofi Voter', 'GH-002')); const kr = r.id; ok('staff adds record', r.status === 200);
  r = await K('POST', '/api/records', rec('Dup', 'GH-001')); ok('duplicate voter ID blocked', r.status === 409);
  r = await K('GET', '/api/records'); ok('staff sees only own records', r.total === 1 && r.rows[0].name === 'Kofi Voter');
  r = await A('GET', '/api/records'); ok('admin sees all records', r.total === 2);
  const adminRec = (await A('GET', '/api/records?q=Admin')).rows[0].id;
  r = await K('PUT', `/api/records/${adminRec}`, rec('Hacked', 'GH-001')); ok('staff cannot edit others', r.status === 404);
  r = await K('DELETE', `/api/records/${kr}`); ok('staff cannot delete', r.status === 403);
  r = await K('PUT', `/api/records/${kr}`, rec('Kofi Edited', 'GH-002')); ok('staff edits own', r.status === 200);
  r = await K('GET', '/api/export.csv', null, true); ok('staff export scoped', r.text.includes('Kofi') && !r.text.includes('Admin Voter'));
  r = await K('POST', '/api/import', { rows: [] }); ok('staff cannot import', r.status === 403);
  r = await A('POST', '/api/import', { rows: [rec('=cmd|evil', 'GH-009'), { name: 'Bad' }] }); ok('import validates', r.imported === 1 && r.skipped === 1);
  r = await A('GET', '/api/export.csv', null, true); ok('CSV formula injection neutralised', r.text.includes('"\'=cmd'));
  const nr = await fetch(B + '/api/records', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); ok('missing CSRF header rejected', nr.status === 403);
  r = await A('POST', `/api/users/${kid.id}/disable`); ok('admin disables user', r.status === 200);
  r = await K('GET', '/api/records'); ok('disabled user session ended', r.status === 401);
  r = await A('POST', '/api/users', { username: 'temp1', full_name: 'Temp User', password: 'Temp-Password-2026', role: 'staff' }); ok('admin creates user', r.status === 200);
  for (let i = 0; i < 5; i++) await T('POST', '/api/auth/login', { username: 'temp1', password: 'bad' });
  r = await T('POST', '/api/auth/login', { username: 'temp1', password: 'Temp-Password-2026' }); ok('account lockout after 5 failures', r.status === 401);
  const h = await fetch(B + '/'); ok('web page served with CSP', h.status === 200 && (h.headers.get('content-security-policy') || '').includes("script-src 'self'"));
  r = await A('GET', '/api/audit'); ok('audit log populated', r.total > 10);
})().catch(e => { failed++; console.error(e); }).finally(() => { srv.kill(); fs.rmSync(tmp, { recursive: true, force: true }); console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed'); process.exit(failed ? 1 : 0); });

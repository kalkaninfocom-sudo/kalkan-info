import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';

const USER_TOKEN = process.argv[2];
if (!USER_TOKEN) { console.error('Usage: ... <user_token>'); process.exit(1); }

// Step 1: get fresh page token
const acc = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${USER_TOKEN}`).then(r => r.json());
const page = acc.data?.[0];
if (!page) { console.error('no page', acc); process.exit(1); }
const PAGE_TOKEN = page.access_token;
console.log(`page: ${page.name} · token len: ${PAGE_TOKEN.length}`);

// Step 2: Vercel — DELETE existing IG_LONG_LIVED_TOKEN then POST new
const vToken = JSON.parse(readFileSync(homedir() + '/AppData/Roaming/com.vercel.cli/Data/auth.json', 'utf8')).token;
const PROJ = 'prj_BH2LwGySrcm0VTNmOqam14bGLdGN';
const TEAM = 'team_KQRZpbniYV5I2ZFb1BwcMdxJ';

const list = await fetch(`https://api.vercel.com/v9/projects/${PROJ}/env?teamId=${TEAM}`, {
  headers: { Authorization: `Bearer ${vToken}` }
}).then(r => r.json());

// Delete all envs with this key
const matches = (list.envs || []).filter(e => e.key === 'IG_LONG_LIVED_TOKEN');
console.log(`Found ${matches.length} existing IG_LONG_LIVED_TOKEN env(s), deleting...`);
for (const e of matches) {
  const del = await fetch(`https://api.vercel.com/v9/projects/${PROJ}/env/${e.id}?teamId=${TEAM}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${vToken}` }
  });
  console.log(`  delete ${e.id} target=${e.target}: ${del.status}`);
}

// Create new with target production
const add = await fetch(`https://api.vercel.com/v10/projects/${PROJ}/env?teamId=${TEAM}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${vToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    key: 'IG_LONG_LIVED_TOKEN',
    value: PAGE_TOKEN,
    type: 'encrypted',
    target: ['production', 'preview', 'development']
  })
});
const addBody = await add.json();
console.log(`Add new: ${add.status}`, addBody.key ? '✓ created' : JSON.stringify(addBody).slice(0, 200));

// Step 3: deploy
const hook = 'https://api.vercel.com/v1/integrations/deploy/prj_BH2LwGySrcm0VTNmOqam14bGLdGN/H6qrfGFrBr';
const dep = await fetch(hook, { method: 'POST' }).then(r => r.json());
console.log(`Deploy: ${dep.job?.id}`);

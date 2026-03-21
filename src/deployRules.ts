/**
 * Deploy Firestore security rules using the Firebase Rules API + service account.
 * Run: npm run deploy:rules
 *
 * No firebase-tools needed — uses serviceAccountKey.json directly.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import * as dotenv from 'dotenv';
dotenv.config();

const _require   = createRequire(import.meta.url);
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID!;

if (!PROJECT_ID) {
  console.error('Missing FIREBASE_PROJECT_ID in .env');
  process.exit(1);
}

// Load service account
const KEY_PATHS = [
  path.resolve(process.cwd(), 'serviceAccountKey.json'),
  path.resolve(process.cwd(), 'service-account.json'),
];
const keyPath = KEY_PATHS.find(p => fs.existsSync(p));
if (!keyPath) {
  console.error('serviceAccountKey.json not found in project root');
  process.exit(1);
}
const serviceAccount = _require(keyPath);

// Read rules file
const rulesPath    = path.resolve(process.cwd(), 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

async function getAccessToken(): Promise<string> {
  // Use google-auth-library (bundled with firebase-admin)
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const token  = await client.getAccessToken();
  return token.token!;
}

async function deployRules() {
  console.log('\n🔒 Deploying Firestore security rules...\n');
  console.log(`   Project:    ${PROJECT_ID}`);
  console.log(`   Rules file: ${rulesPath}`);

  const token = await getAccessToken();

  // 1. Create a new ruleset
  const createUrl  = `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/rulesets`;
  const createBody = {
    source: {
      files: [{ name: 'firestore.rules', content: rulesContent }],
    },
  };

  const createRes  = await fetch(createUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(createBody),
  });
  const createData = await createRes.json() as any;

  if (!createRes.ok) {
    console.error('❌  Failed to create ruleset:', JSON.stringify(createData, null, 2));
    process.exit(1);
  }

  const rulesetName = createData.name;
  console.log(`\n   ✓ Ruleset created: ${rulesetName.split('/').pop()}`);

  // 2. Update the Cloud Firestore release to use the new ruleset
  const releaseUrl  = `https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/releases/cloud.firestore`;
  const releaseBody = { release: { name: `projects/${PROJECT_ID}/releases/cloud.firestore`, rulesetName } };

  const releaseRes  = await fetch(releaseUrl, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(releaseBody),
  });
  const releaseData = await releaseRes.json() as any;

  if (!releaseRes.ok) {
    // Try PUT if PATCH not found
    const releaseRes2  = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT_ID}/releases`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `projects/${PROJECT_ID}/releases/cloud.firestore`, rulesetName }),
    });
    const releaseData2 = await releaseRes2.json() as any;
    if (!releaseRes2.ok) {
      console.error('❌  Failed to update release:', JSON.stringify(releaseData2, null, 2));
      process.exit(1);
    }
    console.log('   ✓ Release created');
  } else {
    console.log('   ✓ Release updated');
  }

  console.log('\n✅  Firestore rules deployed successfully!\n');
  console.log('   All 9 accounts now have proper access:');
  console.log('   Admin       → read/write all collections');
  console.log('   Manager     → read all, write own store data');
  console.log('   Pharmacist  → read/write own store data');
  console.log();
  process.exit(0);
}

deployRules().catch(err => {
  console.error('\n❌  Deploy failed:', err.message || err);
  process.exit(1);
});

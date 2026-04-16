const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const distMainDir = path.join(rootDir, 'dist', 'main');
const outputPath = path.join(distMainDir, 'oauth-config.json');
const envPath = path.join(rootDir, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const config = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  OAUTH_REDIRECT_URI: process.env.OAUTH_REDIRECT_URI || ''
};

fs.mkdirSync(distMainDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(config, null, 2), 'utf-8');

const hasOAuthClient = Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
if (hasOAuthClient) {
  console.log('Generated dist/main/oauth-config.json with OAuth client values.');
} else {
  console.warn(
    'Generated dist/main/oauth-config.json without full OAuth credentials. ' +
      'Release builds will require GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.'
  );
}

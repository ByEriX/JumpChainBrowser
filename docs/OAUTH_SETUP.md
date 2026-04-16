# How to Set Up Google OAuth for JumpChain Browser

JumpChain Browser can use OAuth 2.0 instead of an API key for Google Drive access. OAuth is better for long-term reliability, especially with restrictive shared drives.

## Why OAuth

- Higher effective quota behavior per authenticated user
- Better compatibility with restrictive/shared drives (QQ/SB)
- No requirement for users to create and paste API keys
- Stronger security model than distributing a shared API key

## Prerequisites

- A Google account with access to Google Cloud Console
- A Google Cloud project for JumpChain Browser
- Google Drive API enabled in that project

## Step-by-Step Setup

### 1. Open Google Cloud Console

Go to [Google Cloud Console](https://console.cloud.google.com/) and select your project.

### 2. Configure OAuth Consent Screen

1. Go to **APIs & Services** -> **OAuth consent screen**
2. Select user type:
   - **External** for public/community use
   - **Internal** for organization-only use
3. Fill app details
4. Add scopes:
   - `https://www.googleapis.com/auth/drive.readonly`
5. Save and continue

Note: Keep scopes read-only unless you explicitly need write operations.

### 3. Create OAuth Client Credentials

1. Go to **APIs & Services** -> **Credentials**
2. Click **Create Credentials** -> **OAuth client ID**
3. Choose **Desktop app** as application type
4. Name it (for example, `JumpChain Browser Desktop`)
5. Click **Create**
6. Save:
   - **Client ID** (`...apps.googleusercontent.com`)
   - **Client Secret** (`GOCSPX-...`)

### 4. Configure Redirect URI Strategy

For Electron desktop apps, use one of:

- A custom protocol callback (for example `com.jumpchain.browser://oauth/callback`)
- A localhost callback in development (for example `http://localhost:PORT/callback`)

If your chosen OAuth flow requires registered redirect URIs, add them exactly as used by the app.

### 5. Confirm Required APIs

In **APIs & Services** -> **Library**, verify this API is enabled:

- Google Drive API

## Environment Values to Prepare

When OAuth implementation is added, these values should be available to the app:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OAUTH_REDIRECT_URI`

## Electron-Specific Notes

- OAuth flow can be implemented with an embedded browser window or system browser handoff
- If using custom protocol callbacks, register protocol handling in Electron main process
- Keep OAuth logic in main process; renderer should call IPC endpoints only

## Security Best Practices

- Never expose client secret in renderer code
- Keep scopes minimal (`readonly`)
- Validate token expiry before API calls
- Log auth errors without logging sensitive tokens
- Rotate/recreate credentials if leakage is suspected

## Troubleshooting

- **Invalid client**: Client ID/secret is wrong or from another project
- **Redirect URI mismatch**: Redirect URI in code does not exactly match configured value
- **Access denied**: Consent screen or test-user setup blocks the account
- **Insufficient permissions**: Missing required readonly scopes
- **Token refresh failures**: Refresh token revoked or missing; force re-login

## External References

- [Google OAuth 2.0 Overview](https://developers.google.com/identity/protocols/oauth2)
- [Using OAuth 2.0 for Installed Applications](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google Drive API Docs](https://developers.google.com/drive/api)

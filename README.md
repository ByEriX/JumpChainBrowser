# JumpChain Browser

A desktop application for browsing and managing JumpChain PDFs from community Google Drives.

## Features

- **Sync from Community Drives**: Automatically indexes PDFs from known JumpChain community drives
- **Bookmark Management**: Save your favorite jumps with personal notes
- **Local Downloads**: Download PDFs for offline access
- **Source Filtering**: Filter by drive source (QQ, SpaceBattles, Reddit, 4chan)
- **Thumbnail Previews**: View PDF thumbnails directly from Google Drive
- **Dark Theme**: Modern, eye-friendly interface

## Setup

### Prerequisites

- Node.js 18+
- Google OAuth desktop client credentials (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`)

### Installation

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Run the application
npm start
```

### Development

```bash
# Run in development mode with hot reload
npm run dev
```

For local development, place OAuth values in `.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
OAUTH_REDIRECT_URI=http://localhost:53682/oauth2callback
```

`npm run build` writes OAuth values into `dist/main/oauth-config.json` so packaged builds can run without shipping a `.env` file. Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set when building, or the generated config will be incomplete and sign-in will stay unavailable.

## Usage

1. **Login with Google**: On first launch, complete the OAuth sign-in flow to authorize Google Drive access

2. **First Sync**: Click "Sync Now" on the home page to index all PDFs from the community drives
   - Recursively scans all folders in the 4 main community drives
   - Indexes thousands of PDF files with real Google Drive file IDs
   - First sync takes 5-10 minutes (subsequent syncs are much faster)
   - Progress updates are shown during the sync
   - Be patient - this only needs to be done once!

3. **Browse Files**: Use the Browse page to view all indexed files with pagination and search

4. **Bookmark**: Click the bookmark icon on any file card to save it to your bookmarks

5. **Download**: Click the download icon to save a PDF locally for offline access

6. **Settings**: Configure which drive sources to show and manage NSFW content filtering

## Known Community Drives

The app syncs from these public JumpChain community drives:

- **DriveAnon's 4chan Drive**
- **Questionable Questing Drive**
- **SpaceBattles Drive**
- **Reddit Jumpchain Drive**

## NSFW Content Filtering

The app uses a two-tier NSFW detection system:

1. **Drive-level**: Some drives (like Questionable Questing) are marked as NSFW by default
2. **Path-level**: Files are automatically marked as NSFW if their path or filename contains "nsfw" (case-insensitive)

This dual approach handles cases where SFW drives contain NSFW subfolders (e.g., Reddit drive's "NSFW" folder).

**Settings**: By default, NSFW content is hidden. You can enable it in Settings > Content Filters > "Show NSFW Content"

## Technical Details

- **Framework**: Electron + React + TypeScript
- **Database**: SQLite (local storage)
- **State Management**: Zustand
- **UI**: Tailwind CSS + Lucide Icons
- **APIs**: Google Drive API

### Folder Structure

```
src/
├── main/               # Electron main process
│   ├── db/             # SQLite database
│   ├── services/       # Google API, thumbnails, downloads
│   └── main.ts         # Application entry point
├── preload/            # Secure IPC bridge
│   ├── preload.ts
│   └── types.d.ts
└── renderer/
    ├── index.html
    └── src/            # React frontend
        ├── components/ # UI components
        ├── pages/      # Application pages
        └── stores/     # State management
```

## Build & Distribution

```bash
# Create distributable packages
npm run dist
```

This creates installers in the `release/` directory:
- Windows: `.exe` installer
- macOS: `.dmg` file
- Linux: `.AppImage` and `.deb` packages

## How It Works

The app directly scans the known JumpChain community Google Drives to index all PDF files.

When you sync:
1. The app recursively scans 4 community drives (4chan, QQ, SpaceBattles, Reddit)
2. All PDF files in each drive are indexed with their real Google Drive file IDs
3. Files are stored in a local SQLite database with metadata
4. Downloads, thumbnails, and "open in browser" all use real file IDs

**Note**: The first sync takes 5-10 minutes as it recursively scans thousands of folders. Subsequent syncs are faster as they only check for changes.

## Troubleshooting

### Sync Not Working

- Ensure you have an active internet connection
- Check OAuth configuration (`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`)
- For packaged builds, verify `dist/main/oauth-config.json` was generated during build
- First sync takes 5-10 minutes
- Some drives may fail to sync if they have permission issues

### Thumbnails Not Loading

- Thumbnails are loaded from Google Drive on demand
- If thumbnails fail to load, the file is still accessible via the open in browser button
- Some thumbnails may not be available for all files

## License

MIT

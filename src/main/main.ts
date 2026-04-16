import { app, BrowserWindow, nativeTheme } from 'electron';
import path from 'path';
import fs from 'fs';
import { setupIpcHandlers } from './ipcHandlers';

// Load environment variables from .env file
import * as dotenv from 'dotenv';

function loadEnvFile(): void {
  const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(app.getAppPath(), '.env')
  ];

  for (const envPath of candidatePaths) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
      return;
    }
  }

  // Fall back to dotenv default resolution for compatibility.
  dotenv.config();
}

function loadInjectedOauthConfig(): void {
  const candidatePaths = [
    path.resolve(__dirname, 'oauth-config.json'),
    path.resolve(process.cwd(), 'dist/main/oauth-config.json'),
    path.resolve(app.getAppPath(), 'dist/main/oauth-config.json')
  ];

  for (const configPath of candidatePaths) {
    if (!fs.existsSync(configPath)) {
      continue;
    }

    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as {
        GOOGLE_CLIENT_ID?: string;
        GOOGLE_CLIENT_SECRET?: string;
        OAUTH_REDIRECT_URI?: string;
      };

      if (!process.env.GOOGLE_CLIENT_ID && parsed.GOOGLE_CLIENT_ID) {
        process.env.GOOGLE_CLIENT_ID = parsed.GOOGLE_CLIENT_ID;
      }

      if (!process.env.GOOGLE_CLIENT_SECRET && parsed.GOOGLE_CLIENT_SECRET) {
        process.env.GOOGLE_CLIENT_SECRET = parsed.GOOGLE_CLIENT_SECRET;
      }

      if (!process.env.OAUTH_REDIRECT_URI && parsed.OAUTH_REDIRECT_URI) {
        process.env.OAUTH_REDIRECT_URI = parsed.OAUTH_REDIRECT_URI;
      }

      return;
    } catch (error) {
      console.warn(`Failed to load injected OAuth config from ${configPath}:`, error);
    }
  }
}

loadEnvFile();
loadInjectedOauthConfig();

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  // Set dark mode by default
  nativeTheme.themeSource = 'dark';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'default',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

// Setup IPC handlers before window creation
app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent navigation to external URLs
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== 'http://localhost:5173') {
      event.preventDefault();
    }
  });
});

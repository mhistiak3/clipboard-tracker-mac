import {
  app,
  BrowserWindow,
  globalShortcut,
  Tray,
  Menu,
  Notification
} from 'electron';
import clipboardy from 'clipboardy';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let win;
let tray;
let clipboardHistory = [];
let isTracking = false;
let isQuitting = false;
let isWindowReady = false;

function showTrackingNotification() {
  new Notification({
    title: 'Clipboard Tracker',
    body: 'Clipboard tracking is now active!'
  }).show();
}

function createWindow() {
  win = new BrowserWindow({
    width: 500,
    height: 600,
    show: false, // Important: don't show until ready
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');

  win.once('ready-to-show', () => {
    isWindowReady = true;
  });

  // Setup Tray
  tray = new Tray(path.join(__dirname, 'icon.png')); // Make sure this icon exists
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => win.show()
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);
  tray.setToolTip('Clipboard Tracker');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    win.isVisible() ? win.hide() : win.show();
  });

  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function startClipboardWatcher() {
  setInterval(() => {
    if (!isTracking) return;

    try {
      const currentText = clipboardy.readSync().trim();
      if (!currentText) return;

      // Skip if same as top entry
      if (clipboardHistory.length && clipboardHistory[0].text === currentText) {
        return;
      }

      // Remove duplicate if exists
      const existingIndex = clipboardHistory.findIndex(
        (entry) => entry.text === currentText
      );
      if (existingIndex !== -1) {
        clipboardHistory.splice(existingIndex, 1);
      }

      // Add to top
      clipboardHistory.unshift({
        text: currentText,
        time: new Date().toLocaleTimeString()
      });

      // Limit history to 50
      if (clipboardHistory.length > 50) clipboardHistory.pop();

      // Update frontend
      if (win && win.webContents) {
        win.webContents.send('clipboard-updated', clipboardHistory);
      }

      console.log('Clipboard updated:', currentText);
    } catch (err) {
      console.error('Clipboard read error:', err);
    }
  }, 1000);
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  createWindow();
  startClipboardWatcher();

  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (!isTracking) {
      isTracking = true;
      showTrackingNotification();
    }

    if (!win) return;

    if (!win.isVisible()) {
      if (isWindowReady) {
        win.show();
        win.focus();
      } else {
        win.once('ready-to-show', () => {
          isWindowReady = true;
          win.show();
          win.focus();
        });
      }
    } else {
      win.hide();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

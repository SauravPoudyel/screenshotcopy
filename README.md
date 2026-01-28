# Screenshot to ChatGPT

This Chrome extension captures whatever is visible in the current tab and automatically uploads the image to an open ChatGPT tab. It listens for a keyboard shortcut, or you can trigger it manually from the toolbar popup.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select this directory (`screenshotai`)
5. The extension should now appear in your extensions list

## Usage

1. Navigate to any webpage you want to screenshot
2. Use one of these methods to capture:
   - Press `Ctrl+Shift+S` (Windows/Linux) or `MacCtrl+Shift+S` (Mac)
   - Click the extension icon in the toolbar and click "Capture & send screenshot"
3. The extension will:
   - Capture the visible area of the current tab
   - Open or find an existing ChatGPT tab (chat.openai.com)
   - Automatically upload the screenshot to ChatGPT
4. You'll see a notification on the ChatGPT page when the upload is in progress

## Debugging

If the extension doesn't work, try these steps:

### 1. Check Console Logs

**Background Script:**
- Go to `chrome://extensions/`
- Find "Screenshot to ChatGPT"
- Click "service worker" or "background page"
- Look for `[Screenshot]` prefixed logs

**Content Script (ChatGPT page):**
- Open ChatGPT (chat.openai.com)
- Open DevTools (F12 or Cmd+Option+I)
- Check the Console tab for logs

### 2. Verify Permissions

- Make sure the extension has permission to access chat.openai.com
- Try refreshing the ChatGPT tab after installing the extension

### 3. Check ChatGPT UI

- Make sure you're logged into ChatGPT
- The page should be fully loaded before capturing
- Try starting a new chat if nothing happens

### 4. Reload Extension

- Go to `chrome://extensions/`
- Click the reload icon on the extension
- Refresh any open ChatGPT tabs

### 5. Common Issues

**"No active tab to capture"**: Make sure a tab is active when you press the shortcut

**"Could not locate file input"**: ChatGPT's UI may have changed. Check the console logs for details.

**Content script errors**: Try reloading the ChatGPT tab after installing the extension

## How It Works

1. **Background Script** (`background.js`): Listens for keyboard shortcuts and popup clicks, captures the visible tab, and sends the screenshot to the ChatGPT tab
2. **Content Script** (`contentScript.js`): Runs on ChatGPT pages, receives screenshots, and uploads them by finding the file input element and simulating file selection
3. **Popup** (`popup.html/js`): Provides a UI to manually trigger screenshots

## Troubleshooting File Upload

The extension tries multiple methods to upload files:
1. Finding and using the file input element directly
2. Simulating drag-and-drop events on the form

If ChatGPT updates their UI, you may need to adjust the selectors in `contentScript.js`.


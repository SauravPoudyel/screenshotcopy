# Testing the Extension

Follow these steps to test if the extension is working:

## Step 1: Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `screenshotai` folder
4. You should see "Screenshot to ChatGPT" in your extensions list
5. Note: You may need to pin the extension to see its icon in the toolbar

## Step 2: Test Background Script

1. On `chrome://extensions/`, find "Screenshot to ChatGPT"
2. Click the **"service worker"** link (it will open DevTools)
3. In the console, you should see: `Screenshot to ChatGPT extension installed.`
4. Leave this DevTools window open for monitoring

## Step 3: Test Screenshot Capture

1. Open any webpage (e.g., google.com)
2. Click the extension icon in the toolbar
3. Click "Capture & send screenshot" button
4. Check the service worker console - you should see logs like:
   ```
   [Screenshot] Capturing screenshot (reason: popup button)
   [Screenshot] Capturing visible tab: ...
   [Screenshot] Screenshot captured, size: ...
   ```

## Step 4: Test ChatGPT Integration

1. Make sure you're logged into ChatGPT at https://chat.openai.com/
2. The extension should automatically open/find a ChatGPT tab
3. Open DevTools on the ChatGPT page (F12 or Cmd+Option+I)
4. In the console, you should see:
   ```
   Starting screenshot upload...
   Found file input, attempting direct upload
   File upload triggered successfully
   ```
5. You should see a notification appear in the top-right of the ChatGPT page
6. The screenshot should appear as an uploaded file in the ChatGPT input area

## Step 5: Test Keyboard Shortcut

1. Go to `chrome://extensions/shortcuts`
2. Find "Screenshot to ChatGPT"
3. Verify the shortcut is set (default: MacCtrl+Shift+S on Mac)
4. Navigate to any webpage
5. Press the keyboard shortcut
6. The screenshot should be captured and sent to ChatGPT

## Common Issues & Solutions

### Issue: "Could not receive message from content script"

**Solution:**
- Refresh the ChatGPT tab
- Reload the extension from `chrome://extensions/`
- Check that the extension has permission for chat.openai.com

### Issue: Screenshot captures but doesn't upload

**Solution:**
- Open DevTools on the ChatGPT page and check for errors
- Make sure you're on the main chat page, not settings or another page
- Try clicking the paperclip/attachment button manually first to ensure file upload works

### Issue: "Could not find file input"

**Possible causes:**
- ChatGPT's UI has changed
- You're not on a chat page (go to a new or existing chat)
- The page hasn't fully loaded

**Debug:**
- Open DevTools on ChatGPT page
- Run this in console: `document.querySelectorAll('input[type="file"]')`
- If it returns nothing, ChatGPT's UI has changed significantly

### Issue: Keyboard shortcut doesn't work

**Solution:**
- Go to `chrome://extensions/shortcuts`
- Set a custom shortcut that doesn't conflict with other extensions
- Make sure the webpage you're on allows extensions to run

## Manual Testing of File Upload

To test if ChatGPT's file upload is working:

1. Open DevTools console on ChatGPT
2. Paste this code:
   ```javascript
   // Find file input
   const input = document.querySelector('input[type="file"]');
   console.log('File input found:', input);
   
   // Create a test file
   const file = new File(['test'], 'test.txt', { type: 'text/plain' });
   const dt = new DataTransfer();
   dt.items.add(file);
   input.files = dt.files;
   
   // Trigger change
   input.dispatchEvent(new Event('change', { bubbles: true }));
   ```
3. If this works, the extension's upload mechanism should also work

## Getting Help

If none of the above works:

1. Export the service worker console logs
2. Export the ChatGPT page console logs  
3. Check if ChatGPT's UI has been updated recently
4. Try using ChatGPT's file upload manually to ensure it's working
5. Verify you have the latest version of Chrome

## Next Steps After Success

Once it's working:
- Try capturing different types of pages
- Test with multiple screenshots in quick succession
- Verify the queue system works if ChatGPT is slow to load


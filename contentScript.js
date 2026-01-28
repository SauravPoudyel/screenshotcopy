const STORAGE_KEY = "screenshot-queue";
let uploading = false;

// Global settings
let currentSettings = {
  autoSend: true,
  showNotifications: true,
  switchTab: true,
  targetUrl: "https://chatgpt.com/"
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PING") {
    sendResponse({status: "ready"});
    return true;
  }
  if (message?.type === "UPLOAD_SCREENSHOT" && message?.dataUrl) {
    if (message.settings) currentSettings = message.settings;
    enqueueScreenshot(message.dataUrl);
    sendResponse({status: "queued"});
    return true;
  }
  if (message?.type === "SEND_TEXT" && message?.text) {
    if (message.settings) currentSettings = message.settings;
    sendTextToChatGPT(message.text);
    sendResponse({status: "text queued"});
    return true;
  }
});

function enqueueScreenshot(dataUrl) {
  const queue = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  queue.push(dataUrl);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  processQueue();
}

async function processQueue() {
  if (uploading) return;
  const queue = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  if (!queue.length) return;
  uploading = true;
  const screenshot = queue.shift();
  
  if (currentSettings.showNotifications) {
    showNotification("Uploading screenshot to ChatGPT...");
  }
  
  try {
    await uploadScreenshot(screenshot);
    if (currentSettings.showNotifications) {
      showNotification("Screenshot uploaded successfully!", "success");
    }
  } catch (error) {
    console.error("Screenshot upload failed:", error);
    if (currentSettings.showNotifications) {
      showNotification("Failed to upload screenshot. Check console for details.", "error");
    }
    queue.unshift(screenshot);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  uploading = false;
  
  if (queue.length) {
    setTimeout(() => processQueue(), 1000);
  }
}

function showNotification(message, type = "info") {
  const existing = document.getElementById("screenshot-upload-notification");
  if (existing) {
    existing.remove();
  }
  
  const notification = document.createElement("div");
  notification.id = "screenshot-upload-notification";
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === "success" ? "#10a37f" : type === "error" ? "#ef4444" : "#2563eb"};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transition = "opacity 0.3s";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

async function uploadScreenshot(dataUrl) {
  console.log("Starting screenshot upload...");
  const file = await dataUrlToFile(dataUrl, "screenshot.png");
  
  // Wait for the page to be ready
  await waitForForm();
  
  // Method 1: Click attachment button and use file input
  const attachButton = findAttachmentButton();
  if (attachButton) {
    console.log("Found attachment button, clicking it");
    attachButton.click();
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  // Method 2: Try to find and use the file input directly
  const fileInput = await findFileInput();
  if (fileInput) {
    console.log("Found file input, attempting direct upload");
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    
    // Trigger multiple events to ensure React picks it up
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    fileInput.dispatchEvent(new Event('blur', { bubbles: true }));
    
    // Trigger React's internal event handlers
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(fileInput, '');
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    console.log("File upload triggered successfully");
    
    // Wait for the image to be processed, then click send if auto-send enabled
    await waitForImageUpload();
    if (currentSettings.autoSend) {
      await clickSendButton();
    }
    return;
  }
  
  // Method 3: Try drag and drop on various targets
  console.log("Trying drag-and-drop method");
  const targets = [
    document.querySelector('form'),
    document.querySelector('[contenteditable="true"]'),
    document.querySelector('textarea'),
    document.body
  ].filter(Boolean);
  
  for (const target of targets) {
    console.log("Trying drag-and-drop on:", target.tagName);
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    
    // Simulate complete drag-and-drop sequence
    target.dispatchEvent(new DragEvent("dragenter", {
      dataTransfer, bubbles: true, cancelable: true
    }));
    target.dispatchEvent(new DragEvent("dragover", {
      dataTransfer, bubbles: true, cancelable: true
    }));
    target.dispatchEvent(new DragEvent("drop", {
      dataTransfer, bubbles: true, cancelable: true
    }));
    
    // Wait a bit to see if it worked
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if file was attached (look for preview or file name)
    if (document.querySelector('[alt*="screenshot"]') || 
        document.body.innerText.includes('screenshot.png')) {
      console.log("Drag-and-drop appears successful");
      await waitForImageUpload();
      if (currentSettings.autoSend) {
        await clickSendButton();
      }
      return;
    }
  }
  
  throw new Error("Could not find a way to upload the file. ChatGPT UI may have changed.");
}

function findAttachmentButton() {
  // Look for common attachment button patterns
  const selectors = [
    'button[aria-label*="attach" i]',
    'button[aria-label*="file" i]',
    'button[title*="attach" i]',
    'button svg[class*="paperclip"]',
    '[data-testid*="attach"]'
  ];
  
  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button) {
      console.log("Found attachment button with selector:", selector);
      return button;
    }
  }
  
  return null;
}

async function findFileInput(timeout = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    // Look for file input elements
    const inputs = document.querySelectorAll('input[type="file"]');
    for (const input of inputs) {
      if (input.accept && input.accept.includes('image')) {
        return input;
      }
    }
    
    // Also check for any file input
    if (inputs.length > 0) {
      return inputs[0];
    }
    
    // Wait a bit before trying again
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return null;
}

function waitForForm(timeout = 15000) {
  return new Promise((resolve) => {
    const selector = "form";
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    const observer = new MutationObserver(() => {
      const match = document.querySelector(selector);
      if (match) {
        observer.disconnect();
        resolve(match);
      }
    });
    observer.observe(document.body, {childList: true, subtree: true});
    setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector(selector));
    }, timeout);
  });
}

async function dataUrlToFile(dataUrl, filename) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], filename, {type: blob.type});
}

async function waitForImageUpload(timeout = 5000) {
  console.log("Waiting for image to be processed...");
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    // Look for signs that the image has been uploaded
    // ChatGPT shows a thumbnail/preview when image is ready
    const imagePreview = document.querySelector('img[alt*="Uploaded"]') ||
                         document.querySelector('[data-testid*="image"]') ||
                         document.querySelector('img[src*="blob:"]') ||
                         document.querySelector('[class*="image-preview"]') ||
                         document.querySelector('img[class*="uploaded"]');
    
    if (imagePreview) {
      console.log("Image preview detected, ready to send");
      // Wait a bit more to ensure it's fully processed
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log("Timeout waiting for image preview, attempting to send anyway");
  return false;
}

async function sendTextToChatGPT(text) {
  console.log("Sending text to ChatGPT:", text.substring(0, 50) + "...");
  
  if (currentSettings.showNotifications) {
    showNotification("Sending text to ChatGPT...");
  }
  
  try {
    // Wait for the form to be ready
    await waitForForm();
    
    // Find the input field
    const inputField = await findInputField();
    
    if (!inputField) {
      throw new Error("Could not find ChatGPT input field");
    }
    
    console.log("Found input field:", inputField.tagName, inputField.id || inputField.className);
    
    // Focus the input field
    inputField.focus();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Method 1: Try using clipboard API (most reliable for modern editors)
    let success = await tryClipboardPaste(inputField, text);
    
    if (!success) {
      // Method 2: Try direct input simulation
      console.log("Clipboard method failed, trying direct input...");
      success = await tryDirectInput(inputField, text);
    }
    
    if (!success) {
      // Method 3: Try setting value directly
      console.log("Direct input failed, trying value setter...");
      success = await tryValueSetter(inputField, text);
    }
    
    // Wait a moment for the UI to update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Click send button if auto-send enabled
    if (currentSettings.autoSend) {
      await clickSendButton();
    }
    
    if (currentSettings.showNotifications) {
      showNotification("Text sent to ChatGPT!", "success");
    }
  } catch (error) {
    console.error("Failed to send text:", error);
    if (currentSettings.showNotifications) {
      showNotification("Failed to send text: " + error.message, "error");
    }
  }
}

async function tryClipboardPaste(inputField, text) {
  try {
    inputField.focus();
    
    // Write to clipboard
    await navigator.clipboard.writeText(text);
    
    // Simulate Ctrl+V / Cmd+V paste
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer()
    });
    pasteEvent.clipboardData.setData('text/plain', text);
    inputField.dispatchEvent(pasteEvent);
    
    // Also try document.execCommand
    document.execCommand('paste');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Check if text was inserted
    const currentText = inputField.value || inputField.innerText || inputField.textContent;
    if (currentText.includes(text.substring(0, 20))) {
      console.log("Clipboard paste successful");
      return true;
    }
  } catch (e) {
    console.log("Clipboard method error:", e.message);
  }
  return false;
}

async function tryDirectInput(inputField, text) {
  try {
    inputField.focus();
    
    // Clear existing content
    if (inputField.tagName === 'TEXTAREA' || inputField.tagName === 'INPUT') {
      inputField.value = '';
    } else {
      inputField.innerHTML = '';
    }
    
    // Simulate typing by dispatching input events
    for (let i = 0; i < Math.min(text.length, 10); i++) {
      const char = text[i];
      inputField.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
      inputField.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
      
      if (inputField.tagName === 'TEXTAREA' || inputField.tagName === 'INPUT') {
        inputField.value += char;
      }
      
      inputField.dispatchEvent(new InputEvent('input', { 
        bubbles: true, 
        data: char,
        inputType: 'insertText'
      }));
      inputField.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    }
    
    // Now insert the full text
    if (inputField.tagName === 'TEXTAREA' || inputField.tagName === 'INPUT') {
      inputField.value = text;
    } else {
      // For contenteditable, use insertText
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    }
    
    // Trigger final input event
    inputField.dispatchEvent(new InputEvent('input', { 
      bubbles: true, 
      data: text,
      inputType: 'insertText'
    }));
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const currentText = inputField.value || inputField.innerText || inputField.textContent;
    if (currentText.includes(text.substring(0, 20))) {
      console.log("Direct input successful");
      return true;
    }
  } catch (e) {
    console.log("Direct input error:", e.message);
  }
  return false;
}

async function tryValueSetter(inputField, text) {
  try {
    inputField.focus();
    
    // For textarea/input, use native value setter
    if (inputField.tagName === 'TEXTAREA' || inputField.tagName === 'INPUT') {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'value'
      )?.set;
      
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(inputField, text);
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
        console.log("Native value setter successful");
        return true;
      }
    }
    
    // For contenteditable, try innerHTML
    if (inputField.contentEditable === 'true' || inputField.isContentEditable) {
      // Create a paragraph element with the text
      inputField.innerHTML = `<p>${text}</p>`;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Also try innerText
      if (!inputField.innerText.trim()) {
        inputField.innerText = text;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
      }
      
      console.log("ContentEditable setter successful");
      return true;
    }
  } catch (e) {
    console.log("Value setter error:", e.message);
  }
  return false;
}

async function findInputField(timeout = 10000) {
  console.log("Looking for input field...");
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    // ChatGPT specific selectors (in order of preference)
    const selectors = [
      '#prompt-textarea',
      '[data-id="root"] textarea',
      'form textarea',
      '[contenteditable="true"][data-placeholder]',
      'form [contenteditable="true"]',
      '[role="textbox"]',
      'div[contenteditable="true"]'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) {
        console.log("Found input with selector:", selector);
        return element;
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return null;
}

async function clickSendButton() {
  console.log("Looking for send button...");
  
  // Wait a moment for the UI to be ready
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Try multiple selectors for the send button
  const selectors = [
    'button[data-testid="send-button"]',
    'button[data-testid="fruitjuice-send-button"]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="send" i]',
    'form button[type="submit"]',
    'button svg[class*="send"]',
    // ChatGPT specific - look for the button with send icon
    'form button:not([disabled])',
  ];
  
  for (const selector of selectors) {
    const buttons = document.querySelectorAll(selector);
    for (const button of buttons) {
      // Check if it's likely a send button (not disabled, visible)
      if (!button.disabled && button.offsetParent !== null) {
        // Additional check: look for SVG inside that might be a send icon
        const hasSendIcon = button.querySelector('svg') !== null;
        const isSubmitType = button.type === 'submit';
        const hasAriaLabel = button.getAttribute('aria-label')?.toLowerCase().includes('send');
        
        if (hasSendIcon || isSubmitType || hasAriaLabel) {
          console.log("Found send button, clicking:", selector);
          button.click();
          console.log("Send button clicked!");
          return true;
        }
      }
    }
  }
  
  // Fallback: try to find any button in the form that looks clickable
  const form = document.querySelector('form');
  if (form) {
    const allButtons = form.querySelectorAll('button');
    for (const button of allButtons) {
      if (!button.disabled && button.offsetParent !== null) {
        // Check if it has an SVG (likely an icon button like send)
        const svg = button.querySelector('svg');
        if (svg) {
          console.log("Found potential send button (with SVG), clicking...");
          button.click();
          return true;
        }
      }
    }
  }
  
  console.error("Could not find send button");
  return false;
}


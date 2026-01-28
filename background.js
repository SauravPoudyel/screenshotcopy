const chatGptUrls = ["https://chatgpt.com/*", "https://chat.openai.com/*"];

chrome.runtime.onInstalled.addListener(() => {
  console.log("Screenshot to ChatGPT extension installed.");
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-screenshot") {
    captureAndSendScreenshot("keyboard shortcut");
  }
  if (command === "capture-text") {
    captureAndSendText("keyboard shortcut");
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CAPTURE_SCREENSHOT") {
    captureAndSendScreenshot("popup button");
    sendResponse({status: "capture queued"});
    return true;
  }
  if (message?.type === "CAPTURE_TEXT") {
    captureAndSendText("popup button");
    sendResponse({status: "text capture queued"});
    return true;
  }
});

async function captureAndSendScreenshot(reason) {
  try {
    console.log(`[Screenshot] Capturing screenshot (reason: ${reason})`);
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs.length) {
      console.warn("[Screenshot] No active tab to capture.");
      return;
    }
    
    console.log(`[Screenshot] Capturing visible tab: ${tabs[0].title}`);
    const screenshot = await chrome.tabs.captureVisibleTab(tabs[0].windowId, {
      format: "png"
    });
    
    console.log(`[Screenshot] Screenshot captured, size: ${screenshot.length} bytes`);
    console.log("[Screenshot] Ensuring ChatGPT tab is available...");
    
    const tabId = await ensureChatGptTab();
    if (typeof tabId !== "number") {
      console.warn("[Screenshot] Could not open ChatGPT tab.");
      return;
    }
    
    console.log(`[Screenshot] Sending screenshot to tab ${tabId}`);
    
    // Retry logic for sending the message
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          type: "UPLOAD_SCREENSHOT",
          dataUrl: screenshot,
          reason
        });
        console.log("[Screenshot] Screenshot queued successfully:", response);
        break;
      } catch (error) {
        attempts++;
        console.warn(`[Screenshot] Attempt ${attempts}/${maxAttempts} failed:`, error.message);
        
        if (attempts < maxAttempts) {
          console.log("[Screenshot] Retrying in 1 second...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Try to inject the content script again
          await ensureContentScriptInjected(tabId);
        } else {
          console.error("[Screenshot] Failed to send screenshot after", maxAttempts, "attempts");
          console.error("[Screenshot] Make sure you're on a ChatGPT chat page and the page is fully loaded");
        }
      }
    }
  } catch (error) {
    console.error("[Screenshot] Failed to capture screenshot:", error);
  }
}

async function captureAndSendText(reason) {
  try {
    console.log(`[Text] Capturing selected text (reason: ${reason})`);
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs.length) {
      console.warn("[Text] No active tab.");
      return;
    }
    
    // Get selected text from the active tab
    const results = await chrome.scripting.executeScript({
      target: {tabId: tabs[0].id},
      func: () => window.getSelection().toString()
    });
    
    const selectedText = results[0]?.result?.trim();
    
    if (!selectedText) {
      console.warn("[Text] No text selected.");
      return;
    }
    
    console.log(`[Text] Selected text: "${selectedText.substring(0, 50)}..."`);
    console.log("[Text] Ensuring ChatGPT tab is available...");
    
    const tabId = await ensureChatGptTab();
    if (typeof tabId !== "number") {
      console.warn("[Text] Could not open ChatGPT tab.");
      return;
    }
    
    console.log(`[Text] Sending text to tab ${tabId}`);
    
    // Retry logic for sending the message
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          type: "SEND_TEXT",
          text: selectedText,
          reason
        });
        console.log("[Text] Text sent successfully:", response);
        break;
      } catch (error) {
        attempts++;
        console.warn(`[Text] Attempt ${attempts}/${maxAttempts} failed:`, error.message);
        
        if (attempts < maxAttempts) {
          console.log("[Text] Retrying in 1 second...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          await ensureContentScriptInjected(tabId);
        } else {
          console.error("[Text] Failed to send text after", maxAttempts, "attempts");
        }
      }
    }
  } catch (error) {
    console.error("[Text] Failed to capture text:", error);
  }
}

async function ensureChatGptTab() {
  // Check both chatgpt.com and chat.openai.com
  const tabs = await chrome.tabs.query({url: chatGptUrls});
  if (tabs.length) {
    console.log("[Screenshot] Found existing ChatGPT tab:", tabs[0].id, tabs[0].url);
    // Make sure content script is injected
    await ensureContentScriptInjected(tabs[0].id);
    // Switch to the tab
    await chrome.tabs.update(tabs[0].id, {active: true});
    return tabs[0].id;
  }
  console.log("[Screenshot] No ChatGPT tab found, creating new one...");
  // Use the new chatgpt.com URL
  const created = await chrome.tabs.create({url: "https://chatgpt.com/", active: true});
  console.log("[Screenshot] Waiting for ChatGPT tab to load...");
  await waitForTabLoad(created.id);
  console.log("[Screenshot] ChatGPT tab loaded, injecting content script...");
  await ensureContentScriptInjected(created.id);
  return created.id;
}

async function ensureContentScriptInjected(tabId) {
  try {
    // Try to ping the content script
    const response = await chrome.tabs.sendMessage(tabId, {type: "PING"});
    console.log("[Screenshot] Content script already loaded:", response);
  } catch (error) {
    // Content script not loaded, inject it
    console.log("[Screenshot] Content script not loaded, attempting injection...");
    try {
      await chrome.scripting.executeScript({
        target: {tabId},
        files: ["contentScript.js"]
      });
      console.log("[Screenshot] Content script injected successfully");
      // Wait a bit for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (injectError) {
      console.error("[Screenshot] Failed to inject content script:", injectError);
      console.error("[Screenshot] Error details:", injectError.message);
      // Don't throw - we'll try to send the message anyway since the 
      // content script might be loaded via manifest
    }
  }
}

async function waitForTabLoad(tabId, timeout = 20000) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        console.log("[Screenshot] Tab finished loading");
        // Wait an extra 2 seconds for React to initialize
        setTimeout(resolve, 2000);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      console.log("[Screenshot] Tab load timeout, proceeding anyway");
      resolve();
    }, timeout);
  });
}


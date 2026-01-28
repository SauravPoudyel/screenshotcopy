// Elements
const captureButton = document.getElementById("capture-button");
const textButton = document.getElementById("text-button");
const status = document.getElementById("status");
const settingsToggle = document.getElementById("settings-toggle");
const mainPanel = document.getElementById("main-panel");
const settingsPanel = document.getElementById("settings-panel");
const backBtn = document.getElementById("back-btn");
const openShortcuts = document.getElementById("open-shortcuts");

// Settings elements
const autoSendToggle = document.getElementById("auto-send");
const showNotificationsToggle = document.getElementById("show-notifications");
const switchTabToggle = document.getElementById("switch-tab");
const targetUrlSelect = document.getElementById("target-url");

// Load settings on startup
loadSettings();
loadShortcuts();

// Panel switching
settingsToggle?.addEventListener("click", () => {
  mainPanel.classList.add("hidden");
  settingsPanel.classList.remove("hidden");
});

backBtn?.addEventListener("click", () => {
  settingsPanel.classList.add("hidden");
  mainPanel.classList.remove("hidden");
  saveSettings();
});

// Open Chrome shortcuts page
openShortcuts?.addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
});

// Capture screenshot
captureButton?.addEventListener("click", () => {
  setStatus("Capturing screenshot…", "");
  captureButton.disabled = true;
  
  const settings = getSettings();
  chrome.runtime.sendMessage({
    type: "CAPTURE_SCREENSHOT",
    settings
  }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("Could not capture. Check permissions.", "error");
    } else {
      setStatus("Screenshot sent to ChatGPT! ✓", "success");
    }
    captureButton.disabled = false;
  });
});

// Capture text
textButton?.addEventListener("click", () => {
  setStatus("Capturing selected text…", "");
  textButton.disabled = true;
  
  const settings = getSettings();
  chrome.runtime.sendMessage({
    type: "CAPTURE_TEXT",
    settings
  }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("Select some text first.", "error");
    } else {
      setStatus("Text sent to ChatGPT! ✓", "success");
    }
    textButton.disabled = false;
  });
});

// Settings handlers
autoSendToggle?.addEventListener("change", saveSettings);
showNotificationsToggle?.addEventListener("change", saveSettings);
switchTabToggle?.addEventListener("change", saveSettings);
targetUrlSelect?.addEventListener("change", saveSettings);

function setStatus(message, type = "") {
  if (status) {
    status.textContent = message;
    status.className = type;
  }
}

function getSettings() {
  return {
    autoSend: autoSendToggle?.checked ?? true,
    showNotifications: showNotificationsToggle?.checked ?? true,
    switchTab: switchTabToggle?.checked ?? true,
    targetUrl: targetUrlSelect?.value ?? "https://chatgpt.com/"
  };
}

function saveSettings() {
  const settings = getSettings();
  chrome.storage.sync.set({ settings });
}

function loadSettings() {
  chrome.storage.sync.get("settings", (data) => {
    const settings = data.settings || {};
    
    if (autoSendToggle) autoSendToggle.checked = settings.autoSend ?? true;
    if (showNotificationsToggle) showNotificationsToggle.checked = settings.showNotifications ?? true;
    if (switchTabToggle) switchTabToggle.checked = settings.switchTab ?? true;
    if (targetUrlSelect) targetUrlSelect.value = settings.targetUrl ?? "https://chatgpt.com/";
  });
}

function loadShortcuts() {
  // Get current keyboard shortcuts from Chrome
  chrome.commands.getAll((commands) => {
    commands.forEach((command) => {
      if (command.name === "capture-screenshot" && command.shortcut) {
        const el = document.getElementById("shortcut-screenshot");
        if (el) el.textContent = formatShortcut(command.shortcut);
      }
      if (command.name === "capture-text" && command.shortcut) {
        const el = document.getElementById("shortcut-text");
        if (el) el.textContent = formatShortcut(command.shortcut);
      }
    });
  });
}

function formatShortcut(shortcut) {
  // Convert Chrome's format to a nicer display
  return shortcut
    .replace("MacCtrl", "⌃")
    .replace("Ctrl", "Ctrl")
    .replace("Shift", "⇧")
    .replace("Alt", "⌥")
    .replace("+", " + ");
}


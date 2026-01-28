const captureButton = document.getElementById("capture-button");
const textButton = document.getElementById("text-button");
const status = document.getElementById("status");

captureButton?.addEventListener("click", () => {
  setStatus("Capturing screenshot…");
  captureButton.disabled = true;
  chrome.runtime.sendMessage({type: "CAPTURE_SCREENSHOT"}, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("Could not capture. Make sure the extension has permission.");
    } else {
      setStatus(response?.status ?? "Screenshot sent to ChatGPT!");
    }
    captureButton.disabled = false;
  });
});

textButton?.addEventListener("click", () => {
  setStatus("Capturing selected text…");
  textButton.disabled = true;
  chrome.runtime.sendMessage({type: "CAPTURE_TEXT"}, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("Could not capture text. Select some text first.");
    } else {
      setStatus(response?.status ?? "Text sent to ChatGPT!");
    }
    textButton.disabled = false;
  });
});

function setStatus(message) {
  if (status) {
    status.textContent = message;
  }
}


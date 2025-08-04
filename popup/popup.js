const readValues = document.querySelector("#read-values");
const minPages = document.querySelector("#min-pages");
const minPercent = document.querySelector("#min-percent");
const readValuesSubmit = readValues.querySelector("button");
const pauseHistory = document.querySelector("#pause-history");
const showRecordIcon = document.querySelector("#show-record-icon");
const clearCache = document.querySelector("#clear-cache");

function displaySettings(settings) {
    minPages.value = settings.minPages;
    minPercent.value = settings.minPercent;
    pauseHistory.checked = settings.pauseHistory;
    showRecordIcon.checked = settings.showRecordIcon;
}

function setStatus(message) {
    let statusBox = document.getElementById("status-area");
    if (statusBox === null) {
        statusBox = document.createElement("div");
        statusBox.id = "status-area";
        statusBox.className = "subsection";
        statusBox.innerHTML = `<h3>Info</h3><p></p>`;
        document.body.appendChild(statusBox);
    }

    statusBox.querySelector("p").textContent = message;
}

readValues.addEventListener("submit", async (e) => {
    e.preventDefault();
    readValuesSubmit.disabled = true;
    const response = await chrome.runtime.sendMessage({
        type: "updateSettings", data: {
            minPages: minPages.value === "" ? undefined : parseInt(minPages.value),
            minPercent: minPercent.value === "" ? undefined : parseInt(minPercent.value)
        }
    });

    if (response.status === "ok") {
        displaySettings(response.settings);
    }
    readValuesSubmit.disabled = false;
    setStatus("Settings updated !");
});

pauseHistory.addEventListener("change", async (e) => {
    e.preventDefault();
    pauseHistory.disabled = true;
    const response = await chrome.runtime.sendMessage({
        type: "updateSettings", data: {pauseHistory: pauseHistory.checked}
    });

    if (response.status === "ok") {
        displaySettings(response.settings);
    }
    pauseHistory.disabled = false;
    setStatus(`History recording ${pauseHistory.checked ? "paused" : "resumed"} !`);
});

showRecordIcon.addEventListener("change", async (e) => {
    e.preventDefault();
    showRecordIcon.disabled = true;
    const response = await chrome.runtime.sendMessage({
        type: "updateSettings", data: {showRecordIcon: showRecordIcon.checked}
    });

    if (response.status === "ok") {
        displaySettings(response.settings);
    }
    showRecordIcon.disabled = false;
    setStatus(`Record icon will ${showRecordIcon.checked ? "" : "not"} be shown !`);
});

clearCache.addEventListener("click", () => {
    chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
            if (tab.url && new URL(tab.url).hostname === "nhentai.net") {
                chrome.tabs.sendMessage(tab.id, {
                    type: "clearCache",
                });
            }
        }
    });
    setStatus(`Cleared reading cache !`);
})

chrome.runtime.sendMessage({type: "getSettings"}).then((response) => {
    if (response.status === "ok") {
        displaySettings(response.settings);
    }
});
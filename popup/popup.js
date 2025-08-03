const readValues = document.querySelector("#read-values");
const minPages = document.querySelector("#min-pages");
const minPercent = document.querySelector("#min-percent");
const readValuesSubmit = readValues.querySelector("button");
const pauseHistory = document.querySelector("#pause-history");

function displaySettings(settings) {
    minPages.value = settings.minPages;
    minPercent.value = settings.minPercent;
    pauseHistory.checked = settings.pauseHistory;
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

chrome.runtime.sendMessage({type: "getSettings"}).then((response) => {
    if (response.status === "ok") {
        displaySettings(response.settings);
    }
});
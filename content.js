let loading = false;
let settings = undefined;

async function sendReadMessage(galleryId) {
    const {scrapInfo} = await import(chrome.runtime.getURL('utils.js'));

    if (loading) {
        return;
    }
    loading = true;

    const scrapped = await scrapInfo(galleryId);
    if (scrapped.ok) {
        const res = await chrome.runtime.sendMessage({
            type: "addRead", data: scrapped.data
        });
        loading = false;
        return res.status === "ok";
    }
    loading = false;
    return false;
}

function onUrlChange(callback) {
    let currentUrl = location.href;

    const observer = new MutationObserver(() => {
        if (location.href !== currentUrl) {
            currentUrl = location.href;
            callback(currentUrl);
        }
    });

    observer.observe(document, {subtree: true, childList: true});

    return observer;
}

async function trackGalleryPages(url) {
    const match = url.match(/nhentai\.net\/g\/(\d+)\/(\d+)/);
    if (!match || settings.pauseHistory) {
        return;
    }

    const [_, galleryId, pageNumber] = match;
    let readPages = JSON.parse(sessionStorage.getItem(galleryId) || "[]");

    if (readPages === "read") {
        return;
    }

    const pageNumberNum = parseInt(pageNumber);
    if (!readPages.includes(pageNumberNum)) {
        readPages.push(pageNumberNum);
    }

    const totalPages = parseInt(document.querySelector(".num-pages").innerText);
    if (readPages.length >= settings.minPages || (readPages.length >= totalPages * settings.minPercent / 100)) {
        console.log("sending read message !")
        if (await sendReadMessage(galleryId)) {
            console.log(`Read recorded for ${galleryId}`)
            sessionStorage.setItem(galleryId, JSON.stringify("read"));

            if (settings.showRecordIcon) {
                const recordIcon = document.createElement("img");
                recordIcon.src = chrome.runtime.getURL("icons/icon128.png");
                recordIcon.alt = "history recorded marker";
                recordIcon.id = "record-icon";
                document.body.appendChild(recordIcon);
                setTimeout(() => {
                    recordIcon.classList.add('exit');
                    recordIcon.addEventListener('animationend', () => {
                        recordIcon.remove();
                    });
                }, 1500);
            }
            return;
        }
    }
    sessionStorage.setItem(galleryId, JSON.stringify(readPages));
}

chrome.runtime.sendMessage({type: "getSettings"}).then((result) => {
    if (result.status === "ok") {
        settings = result.settings;
        trackGalleryPages(window.location.href);
        onUrlChange(trackGalleryPages);
    } else {
        console.warn("Could not get settings, no history will be recorded");
    }
})

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "clearCache") {
        window.sessionStorage.clear();
    }
    if (message.type === "updatedSettings") {
        settings = message.settings;
        trackGalleryPages(window.location.href);
    }
})
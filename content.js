let loading = false;
let observer = undefined;

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

async function trackGalleryPages(url, settings) {
    const match = url.match(/nhentai\.net\/g\/(\d+)\/(\d+)/);
    if (!match || settings.pauseHistory) {
        return;
    }

    const [_, galleryId, pageNumber] = match;
    const storageData = await chrome.storage.local.get([galleryId, "lastRead"])
    let readPages = storageData[galleryId] || [];
    let lastRead = storageData.lastRead;

    if (Date.now() - lastRead > 60 * 1000) {
        const {clearCache} = await import(chrome.runtime.getURL("utils.js"))
        await clearCache();
        console.log("cleared cache since previous session ended")
        readPages = [];
    }

    if (readPages === "read") {
        return;
    }

    const pageNumberNum = parseInt(pageNumber);
    if (!readPages.includes(pageNumberNum)) {
        readPages.push(pageNumberNum);
    }

    const totalPages = parseInt(document.querySelector(".num-pages").innerText);
    const toStore = {};
    if (readPages.length >= settings.minPages || (readPages.length >= totalPages * settings.minPercent / 100)) {
        console.log("sending read message !")
        if (await sendReadMessage(galleryId)) {
            console.log(`Read recorded for ${galleryId}`);
            toStore[galleryId] = "read";

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
        }
    }
    else {
    toStore[galleryId] = readPages;}
    toStore.lastRead = Date.now();
    await chrome.storage.local.set(toStore);
}

chrome.runtime.sendMessage({type: "getSettings"}).then((result) => {
    if (result.status === "ok") {
        trackGalleryPages(window.location.href, result.settings);
        observer = onUrlChange((url) => trackGalleryPages(url, result.settings));
    } else {
        console.warn("Could not get settings because of ", result.reason, ", no history will be recorded");
    }
})

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "updatedSettings") {
        trackGalleryPages(window.location.href, message.settings);
        if (observer) {
            observer.disconnect();
            observer = onUrlChange((url) => trackGalleryPages(url, message.settings));
        }
    }
})
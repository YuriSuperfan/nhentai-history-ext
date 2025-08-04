let loading = false;
let settings = undefined;

async function sendReadMessage(galleryId) {
    if (loading) {
        return;
    }
    loading = true;
    try {
        const response = await fetch(`https://nhentai.net/g/${galleryId}/`);
        if (response.ok) {
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const cleanId = parseInt(galleryId);

            const metaTitle = doc.querySelector('meta[itemprop="name"]');
            const title = metaTitle ? metaTitle.getAttribute('content') : `${galleryId}`;

            const parodies = Array.from(doc
                .querySelectorAll(".tag-container")[0]
                .querySelectorAll(".tag .name"))
                .map(e => e.innerText);

            const characters = Array.from(doc
                .querySelectorAll(".tag-container")[1]
                .querySelectorAll(".tag .name"))
                .map(e => e.innerText);

            const tags = Array.from(doc
                .querySelectorAll(".tag-container")[2]
                .querySelectorAll(".tag .name"))
                .map(e => e.innerText);

            const artists = Array.from(doc
                .querySelectorAll(".tag-container")[3]
                .querySelectorAll(".tag .name"))
                .map(e => e.innerText);

            const languages = Array.from(doc
                .querySelectorAll(".tag-container")[5]
                .querySelectorAll(".tag .name"))
                .map(e => e.innerText);

            const pages = doc.querySelectorAll(".tag-container")[7]
                .querySelector(".tag .name").innerText;

            const timestamp = Date.now();

            let thumb = "";
            const coverEl = doc.querySelector('#cover img');
            if (coverEl) {
                thumb = coverEl.getAttribute('data-src') || coverEl.getAttribute('src') || '';
                if (thumb.startsWith('//')) {
                    thumb = 'https:' + thumb;
                }
            }

            const res = await chrome.runtime.sendMessage({
                type: "addRead",
                data: {
                    galleryId: cleanId,
                    title,
                    parodies,
                    characters,
                    tags,
                    artists,
                    languages,
                    pages,
                    timestamp,
                    thumb
                }
            });
            loading = false;
            return res.status === "ok";
        } else {
            loading = false;
            console.warn(`Failed to fetch gallery page (status ${response.status})`);
            return false;
        }
    } catch (e) {
        loading = false;
        console.warn('Fetch error :', e);
        return false;
    }
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

        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === "updatedSettings") {
                settings = message.settings;
                trackGalleryPages(window.location.href);
            }
        })
    } else {
        console.warn("Could not get settings, no history will be recorded");
    }
})
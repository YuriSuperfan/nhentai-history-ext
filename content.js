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

            const artist = doc.querySelectorAll(".tag-container")[3]
                .querySelector(".tag .name").innerText;

            const tags = Array.from(doc
                .querySelectorAll(".tag-container")[2]
                .querySelectorAll(".tag .name"))
                .map(e => e.innerText);

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
                type: "read", galleryId: cleanId, title, artist, tags, timestamp, thumb
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
            sessionStorage.setItem(galleryId, JSON.stringify("read"));
            return;
        }
    }
    sessionStorage.setItem(galleryId, JSON.stringify(readPages));
}

chrome.runtime.sendMessage({type: "getSettings"}).then((result) => {
    if (result.status === "ok") {
        settings = result;
        trackGalleryPages(window.location.href);
        onUrlChange(trackGalleryPages);

        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === "updatedSettings") {
                settings = message;
                trackGalleryPages(window.location.href);
                console.log(settings);
            }
        })
    } else {
        console.warn("Could not get settings, no history will be recorded");
    }
})
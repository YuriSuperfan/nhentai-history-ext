async function sendReadMessage(doujinId) {
    try {
        const response = await fetch(`https://nhentai.net/g/${doujinId}/`);
        if (response.ok) {
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const id = parseInt(doujinId);

            const metaTitle = doc.querySelector('meta[itemprop="name"]');
            const title = metaTitle ? metaTitle.getAttribute('content') : `${doujinId}`;

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
                type: "read",
                id,
                title,
                artist,
                tags,
                timestamp,
                thumb
            });
            console.log(res);
        } else {
            console.warn(`Failed to fetch gallery page (status ${response.status})`);
        }
    } catch (e) {
        console.warn('Fetch error :', e);
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

function trackDoujinPages(url) {
    const match = url.match(/nhentai\.net\/g\/(\d+)\/(\d+)/);
    if (!match) {
        return;
    }

    const [_, doujinId, pageNumber] = match;
    let readPages = JSON.parse(sessionStorage.getItem(doujinId) || "[]");

    if (readPages === "read") {
        return;
    }

    const pageNumberNum = parseInt(pageNumber);
    if (!readPages.includes(pageNumberNum)) {
        readPages.push(pageNumberNum);
        sessionStorage.setItem(doujinId, JSON.stringify(readPages));
    }

    const totalPages = parseInt(document.querySelector(".num-pages").innerText);
    if (readPages.length === 10 || (readPages.length === Math.round(totalPages / 3))) {
        console.log("sending read message !")
        sendReadMessage(doujinId);
        sessionStorage.setItem(doujinId, JSON.stringify("read"));
    }
}

trackDoujinPages(window.location.href);
onUrlChange(trackDoujinPages);
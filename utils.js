const tagTypes = ["parodies", "characters", "tags", "artists", "languages"];

export function formatEpoch(epoch) {
    const date = new Date(epoch);

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export function makeCover(data, settings) {
    const cover = document.createElement("a");
    cover.href = `https://nhentai.net/g/${data.galleryId}`;
    cover.target = "_blank"
    cover.className = "cover-card";

    const deleteHTML = `
            <button class="action-btn delete-btn" title="Delete entry">
              <svg width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="action-btn restore-btn" title="Restore entry">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" 
                     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 12a9 9 0 1 1-3.1-6.5" />
                  <polyline points="21 3 21 9 15 9" />
                </svg>
            </button>`;

    let infoHTML = tagTypes.map((tagType) => {
        if (settings[`display${tagType.charAt(0).toUpperCase()}${tagType.slice(1)}`] === false) {
            return "";
        } else {
            return `
                <span class="colored">
                ${tagType.charAt(0).toUpperCase() + tagType.slice(1)}:
                </span> 
                ${data[tagType].map(str => `<span>${str}</span>`).join(', ')}
                <br>`;
        }
    }).join((""));
    if (settings["displayPages"]) {
        infoHTML += `<span class="colored">Pages:</span> ${data.pages} <br>`
    }

    const dateHTML = `
        <p><span class="colored">
        ${settings.lastRead ? "Last read: </span><span>" : ""}
        ${formatEpoch(data.timestamp)}
        </span></p>`;

    cover.innerHTML = `
        <div class="top">
            ${settings.deleteId !== undefined ? deleteHTML : ""}
            ${infoHTML.length !== 0 || settings.detailReads ? `<div class="info">
                ${infoHTML}
                ${settings.detailReads === true ? `<span class="colored">Reads:</span> ${data.readCount}` : ""}
            </div>` : ""}
            <img src="${data.thumb}" alt="cover of ${data.galleryId}">
        </div>
        
        <div class="bottom ${settings.noOverflow === true ? "no-overflow" : ""}">
            ${settings.noDate === true ? "" : dateHTML}
            <p class="title" title="${data.title}">${data.title}</p>
        </div>`;

    if (settings.deleteId !== undefined) {
        const deleteBtn = cover.querySelector(".delete-btn");
        const restoreBtn = cover.querySelector(".restore-btn");
        let loading = false;
        let deleted = false;
        let restoreData = undefined;

        deleteBtn.addEventListener("click", async (e) => {
            if (loading || deleted) {
                return;
            }
            loading = true;
            e.preventDefault();
            e.stopPropagation();
            const response = await chrome.runtime.sendMessage({
                type: "deleteRead", data: settings.deleteId
            });
            if (response.status === "ok") {
                cover.classList.add("deleted");
                restoreData = response.restoreData;
                deleted = true;
                loading = false;
            }
        })

        restoreBtn.addEventListener("click", async (e) => {
            if (loading || !deleted) {
                return;
            }
            loading = true;
            e.preventDefault();
            e.stopPropagation();
            const response = await chrome.runtime.sendMessage({
                type: "restoreRead", data: restoreData
            });
            if (response.status === "ok") {
                cover.classList.remove("deleted");
                deleted = false;
                loading = false;
                restoreData = undefined;
            }
        })
    }

    return cover;
}

export async function scrapInfo(galleryId) {
    try {
        const response = await fetch(`https://nhentai.net/g/${galleryId}/`);
        if (response.ok) {
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const cleanId = parseInt(galleryId);

            const fullTitle = doc.querySelector("#info .title span.pretty")
            const metaTitle = doc.querySelector('meta[itemprop="name"]');
            const title = fullTitle ? fullTitle.innerText : (metaTitle ? metaTitle.getAttribute('content') : `${galleryId}`);

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

            return {
                ok: true, data: {
                    galleryId: cleanId, title, parodies, characters, tags, artists, languages, pages, timestamp, thumb
                }
            };
        } else {
            console.warn(`Failed to fetch gallery page (status ${response.status})`);
            return {ok: false};
        }
    } catch (e) {
        console.warn('Error :', e);
        return {ok: false};
    }
}
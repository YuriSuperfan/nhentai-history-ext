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

    cover.innerHTML = `
        <div class="top">
        ${settings.deleteId !== undefined ? `
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
            </button>` : ""}
            <div class="info">
                <span class="colored">Artist:</span> ${data.artist}
                <br>
                <span class="colored">Tags:</span> ${data.tags.map(str => `<span>${str}</span>`).join(', ')}
                ${settings.detailReads === true ? `<br><span class="colored">Reads:</span> ${data.readCount}` : ""}
            </div>
            <img src="${data.thumb}" alt="cover of ${data.galleryId}">
        </div>
        
        <div class="bottom ${settings.noOverflow === true ? "no-overflow" : ""}">
            ${settings.noDate === true ? "" : `<p> <span class="colored">${settings.lastRead ? "Last read: </span><span>" : ""}${formatEpoch(data.timestamp)}</span></p>`}
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
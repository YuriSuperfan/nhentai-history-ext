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
    cover.href = `https://nhentai.net/g/${data.id}`;
    cover.target = "_blank"
    cover.className = "cover-card";

    cover.innerHTML = `
        <div class="top">
        ${settings.deleteData !== undefined ? `
            <button class="delete-btn">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>` : ""}
            <div class="info">
                <span class="colored">Artist:</span> ${data.artist}
                <br>
                <span class="colored">Tags:</span> ${data.tags.map(str => `<span>${str}</span>`).join(', ')}
                ${settings.detailReads === true ? `<br><span class="colored">Reads:</span> ${data.readTimestamps.length}` : ""}
            </div>
            <img src="${data.thumb}" alt="cover of ${data.id}">
        </div>
        
        <div class="bottom ${settings.noOverflow === true ? "no-overflow" : ""}">
            ${settings.noDate === true ? "" : `<p> <span class="colored">${settings.lastRead ? "Last read: </span><span>" : ""}${formatEpoch(data.timestamp)}</span></p>`}
            <p class="title" title="${data.title}">${data.title}</p>
        </div>`;

    if (settings.deleteData !== undefined) {
        const deleteBtn = cover.querySelector(".delete-btn");
        let loading = false;
        deleteBtn.addEventListener("click", async (e) => {
            if (loading) {
                return;
            }
            loading = true;
            e.preventDefault();
            e.stopPropagation();
            if (await chrome.runtime.sendMessage({
                type: settings.deleteData.type,
                data: settings.deleteData.data
            }) === "ok") {
                settings.deleteData.callback(cover);
            }
            loading = false;
        })
    }

    return cover;
}
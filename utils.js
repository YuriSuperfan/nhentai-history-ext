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
            <div class="info">
                <span class="colored">Artist:</span> ${data.artist}
                <br>
                <span class="colored">Tags:</span> ${data.tags.map(str => `<span>${str}</span>`).join(', ')}
            </div>
            <img src="${data.thumb}" alt="cover of ${data.id}">
        </div>
        
        <div class="bottom">
            ${settings.noDate === true ? "" : `<p class="colored">${formatEpoch(data.lastRead)}</p>`}
            <p class="title">${data.title}</p>
        </div>`;

    return cover;
}
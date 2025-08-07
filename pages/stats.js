import {makeCover, makeEndCard} from "../utils.js";
import '../lib/dexie.js';

const db = new Dexie("nhentaiHistory");
db.version(1).stores({
    galleries: `galleryId, *parodies, *characters, *tags, *artists, *languages, readCount`,
    reads: `readId, blobId, galleryId, timestamp, [galleryId+timestamp]`,
    blobs: `blobId, endTime`,
    parodies: `value, readCount`,
    characters: `value, readCount`,
    tags: `value, readCount`,
    artists: `value, readCount`,
    languages: `value, readCount`,
});

const tagTypes = ["parodies", "characters", "tags", "artists", "languages"];
const statTypes = ["galleries", ...tagTypes];
const totalStats = document.querySelector("#total-stats");

function makeResultCard(data) {
    let result;
    if (data.href !== undefined) {
        result = document.createElement("a");
        result.href = data.href;
        result.target = "_blank";
    } else {
        result = document.createElement("div");
    }
    result.className = "result-card";
    result.innerHTML = `
        <h2 class="title-placeholder"> e</h2>
        <h2 class="result-title" title="${data.title}">${data.title}</h2>
        <h3>
            <span class="colored">${data.nbReads}</span> read${data.nbReads === 1 ? "" : "s"}
            ${data.uniqueReads !== undefined ? `- <span class="colored">${data.uniqueReads}</span> galler${data.uniqueReads === 1 ? "y" : "ies"}` : ""}
        </h3>
        <div class="collection"></div>
    `;
    const collection = result.querySelector(".collection");
    if (typeof data.children === "function") {
        let currentPage = 0;
        const pageSize = 10;
        let reachedEnd = false;
        let isLoading = false;

        async function addChildren() {
            if (isLoading || reachedEnd) {
                return;
            }
            isLoading = true;

            const res = await data.children(currentPage, pageSize);

            res.children.forEach((child) => collection.appendChild(child));
            reachedEnd = res.reachedEnd;

            currentPage++;
            isLoading = false;
        }

        collection.addEventListener('scroll', () => {
            const scrollLeft = collection.scrollLeft;
            const visibleWidth = collection.clientWidth;
            const totalWidth = collection.scrollWidth;

            if (scrollLeft + visibleWidth >= totalWidth - 100) {
                addChildren();
            }
        });
        addChildren();
    } else {
        collection.appendChild(data.children);
        collection.classList.add("single-collection");
    }
    return result;
}

async function setupStats(settings) {
    let current = window.location.hash.split("#")[1];
    if (!statTypes.includes(current)) {
        current = "galleries";
    }

    statTypes.forEach((statType) => {
        const results = document.createElement("div");
        results.className = "results";
        results.id = `${statType}-results`;
        document.querySelector("#content").appendChild(results);

        const selection = document.createElement("button");
        selection.innerText = statType.charAt(0).toUpperCase() + statType.slice(1);
        selection.className = "selection-option";
        selection.id = `${statType}-selection`;
        document.querySelector("#selection").appendChild(selection);
    })

    const totals = {
        reads: "~", galleries: "~", parodies: "~", characters: "~", tags: "~", artists: "~", languages: "~",
    };

    async function displayTotal() {
        totals.reads = await db.reads.count();
        if (totals[current] === "~") {
            totals[current] = await db[current].count();
        }
        totalStats.innerHTML = `
        <span class="colored">${totals.reads}</span>
        total reads with 
        <span class="colored">${totals[current]}</span> 
        unique ${current}`;
    }

    function changeCurrent(newCurrent) {
        statTypes.forEach((type) => {
            if (newCurrent === type) {
                document.querySelector(`#${type}-results`).classList.add("current-results");
                document.querySelector(`#${type}-selection`).classList.add("selected");
            } else {
                document.querySelector(`#${type}-results`).classList.remove("current-results");
                document.querySelector(`#${type}-selection`).classList.remove("selected");
            }
        });
        window.location.hash = `#${newCurrent}`;
        current = newCurrent;
        displayTotal();
    }

    changeCurrent(current);

    const pageSize = 10;

    function setupGalleryStats() {
        let currentPage = 0;
        let isLoading = false;
        let reachedEnd = false;
        const galleryResults = document.querySelector("#galleries-results");
        const galleryButton = document.querySelector("#galleries-selection");

        async function loadNextGalleries() {
            if (isLoading || reachedEnd) {
                return;
            }
            isLoading = true;

            const offset = currentPage * pageSize;

            const data = await db.galleries
                .orderBy("readCount")
                .reverse()
                .offset(offset)
                .limit(pageSize)
                .toArray();

            if (data.length === 0) {
                reachedEnd = true;
                isLoading = false;
                return;
            }

            for (const gallery of data) {
                const lastRead = await db.reads
                    .where('[galleryId+timestamp]')
                    .between([gallery.galleryId, Dexie.minKey], [gallery.galleryId, Dexie.maxKey])
                    .reverse()
                    .first();


                galleryResults.appendChild(makeResultCard({
                    title: gallery.title,
                    nbReads: gallery.readCount,
                    children: makeCover({...gallery, timestamp: lastRead.timestamp}, {...settings, lastRead: true})
                }));
            }

            currentPage++;
            isLoading = false;
        }

        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const fullHeight = document.documentElement.scrollHeight;

            if (scrollTop + windowHeight >= fullHeight - 300) {
                if (current === "galleries") {
                    loadNextGalleries();
                }
            }
        });

        galleryButton.addEventListener("click", () => {
            changeCurrent("galleries");
        });

        loadNextGalleries();
    }

    let latestReads = await db.reads
        .orderBy("timestamp")
        .reverse()
        .limit(settings.searchEntryCount)
        .toArray().then((readEntries) => {
            return db.galleries.bulkGet([...new Set(readEntries.map((readEntry) => readEntry.galleryId))])
        });

    let galleryNb = await db.galleries.count();

    async function setupCustomStats(tagType) {
        let currentPage = 0;
        let isLoading = false;
        let reachedEnd = false;
        const customResults = document.querySelector(`#${tagType}-results`);
        const customButton = document.querySelector(`#${tagType}-selection`);

        async function loadNextCustom() {
            if (isLoading || reachedEnd) {
                return;
            }
            isLoading = true;

            const offset = currentPage * pageSize;

            const data = await db[tagType]
                .orderBy("readCount")
                .reverse()
                .offset(offset)
                .limit(pageSize)
                .toArray();

            if (data.length === 0) {
                reachedEnd = true;
                isLoading = false;
                return;
            }

            for (const customEntry of data) {
                const uniqueReads = await db.galleries
                    .where(tagType)
                    .equals(customEntry.value)
                    .count();

                async function loadNextChildren(currentPage, pageSize) {
                    const offset = currentPage * pageSize;

                    const galleries = latestReads
                        .filter((galleryEntry) => galleryEntry[tagType].includes(customEntry.value))
                        .sort((a, b) => b.readCount - a.readCount)
                        .slice(offset, offset + pageSize);

                    const children = galleries.map((gallery) => makeCover({
                        ...gallery
                    }, {
                        ...settings, noDate: true, noOverflow: true, detailReads: true
                    }));

                    if (children.length !== pageSize && settings.searchEntryCount < galleryNb) {
                        children.push(makeEndCard({
                            nothing: currentPage === 0 && children.length === 0, showTip: true
                        }));
                    }

                    return {
                        children, reachedEnd: children.length !== pageSize
                    };
                }

                customResults.appendChild(makeResultCard({
                    title: customEntry.value,
                    nbReads: customEntry.readCount,
                    children: loadNextChildren,
                    href: `https://nhentai.net/tag/${customEntry.value.replaceAll(" ", "-")}/`,
                    uniqueReads
                }));
            }

            currentPage++;
            isLoading = false;
        }

        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const fullHeight = document.documentElement.scrollHeight;

            if (scrollTop + windowHeight >= fullHeight - 300) {
                if (current === tagType) {
                    loadNextCustom();
                }
            }
        });

        customButton.addEventListener("click", () => {
            changeCurrent(tagType);
        });

        loadNextCustom();
    }

    setupGalleryStats();
    tagTypes.forEach((tagType) => setupCustomStats(tagType))
}


chrome.runtime.sendMessage({type: "getSettings"}).then((result) => {
    if (result.status === "ok") {
        setupStats(result.settings)
    } else {
        console.warn("Could not get settings, using defaults");
        setupStats({});
    }
});
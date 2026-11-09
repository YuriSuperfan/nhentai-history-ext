import {debounce, makeCover, makeEndCard, tagTypes} from "../utils.js";
import "../lib/dexie.js";

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

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function setupSearch(settings) {
    let latestReads = [];
    let galleryNb = await db.galleries.count();

    const entryCountInfo = document.querySelector("#entry-count-info");

    async function updateEntries(nbEntries) {
        latestReads = [];
        entryCountInfo.innerText = "Loading";

        latestReads = await db.reads
            .orderBy("timestamp")
            .reverse()
            .limit(nbEntries)
            .toArray().then(async (readEntries) => {
                const galleryData = await db.galleries.bulkGet([...new Set(readEntries.map((readEntry) => readEntry.galleryId))]);

                for (const readEntry of readEntries) {
                    const matchingGallery = galleryData.find((galleryEntry) => galleryEntry.galleryId === readEntry.galleryId);
                    if (matchingGallery.timestamp === undefined) {
                        matchingGallery.timestamp = readEntry.timestamp;
                    }
                }

                return galleryData;
            });
        entryCountInfo.innerText = nbEntries;
        debouncedSearch();

        const randomButton = document.querySelector("#random-btn");
        randomButton.addEventListener("click", () => {
            const index = getRandomInt(0, latestReads.length);
            const link = document.createElement("a");
            link.href = `https://nhentai.net/g/${latestReads[index].galleryId}`;
            link.target = "_blank";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    const searchFilters = {};

    const titleInput = document.querySelector("#title-input");
    const results = document.querySelector('#results');

    let loader = undefined;

    async function search() {
        results.innerHTML = "";
        window.removeEventListener("scroll", loader);

        const filtered = latestReads
            .filter((entry) => {
                for (const tagType of tagTypes) {
                    if (searchFilters[tagType.plural]) {
                        if (searchFilters[tagType.plural].isAnd) {
                            if (!searchFilters[tagType.plural].values.every((value) => {
                                return entry[tagType.plural].includes(value);
                            })) {
                                return false;
                            }
                        } else {
                            if (searchFilters[tagType.plural].values.length !== 0 && !searchFilters[tagType.plural].values.some((value) => {
                                return entry[tagType.plural].includes(value);
                            })) {
                                return false;
                            }
                        }
                    }
                }
                return true;
            });

        let finalList;

        if (searchFilters.titleValue) {
            finalList = filtered.map((e) => {
                const title = e.title.toLowerCase();
                const s = searchFilters.titleValue.toLowerCase();

                let distance = -1;
                if (title.includes(s)) {
                    distance = 2;
                }
                if (title.includes(" " + s)) {
                    distance = 1;
                }
                if (title.startsWith(s)) {
                    distance = 0;
                }

                return {data: e, distance};
            }).filter((e) => {
                return e.distance !== -1;
            }).sort((e, f) => {
                if (e.distance === f.distance) {
                    return e.data.title.localeCompare(f.data.title);
                }
                return e.distance - f.distance;
            }).map((e) => {
                return e.data;
            });
        } else {
            finalList = filtered.sort(() => 0.5 - Math.random());
        }

        let currentPage = 0;
        let isLoading = false;
        let reachedEnd = false;
        const pageSize = 20;

        function loadNext() {
            if (isLoading || reachedEnd) {
                return;
            }
            isLoading = true;

            const offset = currentPage * pageSize;

            const data = finalList.slice(offset, offset + pageSize);

            if (data.length === 0) {
                reachedEnd = true;
                isLoading = false;

                results.appendChild(makeEndCard({
                    nothing: currentPage === 0, showTip: galleryNb > latestReads.length, isSearch: true,
                }));
                return;
            }

            data.forEach((entry) => {
                results.appendChild(makeCover({
                    ...entry,
                }, {
                    ...settings, lastRead: true, detailReads: true,
                }));
            });

            currentPage++;
            isLoading = false;
        }

        loader = () => {
            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const fullHeight = document.documentElement.scrollHeight;

            if (scrollTop + windowHeight >= fullHeight - 300) {
                loadNext();
            }
        };

        window.addEventListener('scroll', loader);

        loadNext();

        const oldRandomButton = document.querySelector("#random-btn");
        const newRandomButton = oldRandomButton.cloneNode(true);
        oldRandomButton.parentNode.replaceChild(newRandomButton, oldRandomButton);
        newRandomButton.addEventListener("click", () => {
            if (finalList.length === 0){
                return;
            }
            const index = getRandomInt(0, finalList.length);
            const link = document.createElement("a");
            link.href = `https://nhentai.net/g/${finalList[index].galleryId}`;
            link.target = "_blank";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    const debouncedSearch = debounce(search, 300);

    const titleFilter = document.querySelector("#title-filter");
    tagTypes.forEach((tagType) => {
        searchFilters[tagType.plural] = {values: [], isAnd: true};

        const filter = document.createElement("form");
        filter.className = "filter";
        filter.innerHTML = `
            <div class="header">
                <label id="${tagType.plural}-label" class="colored" for="${tagType.plural}-input">${tagType.pluralCap}</label>
                <div class="and-or">
                    <button class="and-option selected">
                        And
                    </button>
                    <button class="or-option">
                        Or
                    </button>
                </div>
            </div>
            
            <div id="${tagType.plural}-input-area" class="input-area">
                <div class="input-box">
                    <input type="text" id="${tagType.plural}-input" autocomplete="off">
                    <div class="suggestions" style="display:none;"></div>
                </div>
                <button type="submit">Add</button>
            </div>
            
            <div class="current-elements"></div>`;

        const input = filter.querySelector(`#${tagType.plural}-input`);
        const currentElements = filter.querySelector(".current-elements");
        const orButton = filter.querySelector(`.or-option`);
        const andButton = filter.querySelector(`.and-option`);
        const suggestionsBox = filter.querySelector(".suggestions");

        function getMatchingTags(prefix, limit) {
            prefix = prefix.toLowerCase();
            const excludeSet = new Set(searchFilters[tagType.plural].values.map(e => e.toLowerCase()));

            const results = [];

            for (const entry of latestReads) {
                for (const tag of entry[tagType.plural]) {
                    const lowerTag = tag.toLowerCase();
                    if (lowerTag.startsWith(prefix) && !excludeSet.has(lowerTag) && !results.includes(tag)) {
                        results.push(tag);
                        if (results.length >= limit) {
                            return results;
                        }
                    }
                }
            }

            return results;
        }

        function showSuggestions(filtered) {
            suggestionsBox.innerHTML = "";
            if (filtered.length === 0) {
                suggestionsBox.style.display = "none";
                return;
            }
            filtered.forEach(item => {
                const div = document.createElement("div");
                div.className = "suggestion";
                div.textContent = item;
                div.title = item;
                div.addEventListener("click", (e) => {
                    e.preventDefault();
                    input.value = "";
                    suggestionsBox.style.display = "none";
                    addTag(item);
                });
                suggestionsBox.appendChild(div);
            });
            suggestionsBox.style.display = "flex";
        }

        function addTag(value) {
            const newElement = document.createElement("button");
            newElement.innerText = value;
            newElement.className = "element";
            searchFilters[tagType.plural].values.push(value);
            newElement.addEventListener("click", () => {
                const index = searchFilters[tagType.plural].values.indexOf(value);
                if (index !== -1) {
                    searchFilters[tagType.plural].values.splice(index, 1);
                    newElement.remove();
                    debouncedSearch();
                }
            });
            currentElements.appendChild(newElement);
            debouncedSearch();
        }

        input.addEventListener("input", debounce(() => showSuggestions(getMatchingTags(input.value, 5)), 300));
        input.addEventListener("click", () => showSuggestions(getMatchingTags(input.value, 5)));

        document.addEventListener("click", (e) => {
            if (!e.target.closest(`#${tagType.plural}-input-area`)) {
                suggestionsBox.style.display = "none";
            }
        });

        orButton.addEventListener("click", (e) => {
            e.preventDefault();
            orButton.classList.add("selected");
            andButton.classList.remove("selected");
            searchFilters[tagType.plural].isAnd = false;
            debouncedSearch();
        });

        andButton.addEventListener("click", (e) => {
            e.preventDefault();
            orButton.classList.remove("selected");
            andButton.classList.add("selected");
            searchFilters[tagType.plural].isAnd = true;
            debouncedSearch();
        });

        filter.addEventListener("submit", (e) => {
            const currentValue = input.value;
            e.preventDefault();
            if (currentValue !== "") {
                input.value = "";
                addTag(currentValue);
            }
        });

        titleFilter.insertAdjacentElement("afterend", filter);
    });

    const entryCountForm = document.querySelector("#entry-count-form");
    const entryCount = document.querySelector("#entry-count");
    entryCountForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nbEntries = entryCount.value === "" ? NaN : parseInt(entryCount.value);
        if (!isNaN(nbEntries)) {
            updateEntries(nbEntries);
        }
    });

    titleInput.addEventListener("input", () => {
        searchFilters.titleValue = titleInput.value;
        debouncedSearch();
    });

    updateEntries(settings.searchEntryCount);
}

chrome.runtime.sendMessage({type: "getSettings"}).then((result) => {
    if (result.status !== "ok") {
        console.warn("Could not get settings because of ", result.reason, ", using defaults");
    }
    setupSearch(result.settings);
});
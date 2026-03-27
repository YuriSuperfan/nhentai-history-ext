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

async function insertReads(data) {
    try {
        await db.transaction('rw', db.reads, async () => {
            await db.reads.bulkAdd(data);
        })
        console.log("ok-rea")
    } catch (e) {
        console.warn(e)
    }
}

async function insertGalleries(data) {
    try {
        await db.transaction('rw', db.galleries, async () => {
            await db.galleries.bulkAdd(data);
        })
        console.log("ok-gal")
    } catch (e) {
        console.warn(e)
    }
}

async function insertBlobs(data) {
    try {
        await db.transaction('rw', db.blobs, async () => {
            await db.blobs.bulkAdd(data);
        })
        console.log("ok-blo")
    } catch (e) {
        console.warn(e)
    }
}

document.querySelector("#galleryInput").addEventListener('change', (event) => {
    const reader = new FileReader();
    reader.onload = onReaderLoad;
    reader.readAsText(event.target.files[0]);

    function onReaderLoad(event) {
        console.log(event.target.result);
        const obj = JSON.parse(event.target.result);
        insertGalleries(obj);
    }
})

document.querySelector("#readInput").addEventListener('change', (event) => {
    const reader = new FileReader();
    reader.onload = onReaderLoad;
    reader.readAsText(event.target.files[0]);

    function onReaderLoad(event) {
        console.log(event.target.result);
        const obj = JSON.parse(event.target.result);
        insertReads(obj);
    }
})

document.querySelector("#blobInput").addEventListener('change', (event) => {
    const reader = new FileReader();
    reader.onload = onReaderLoad;
    reader.readAsText(event.target.files[0]);

    function onReaderLoad(event) {
        console.log(event.target.result);
        const obj = JSON.parse(event.target.result);
        insertBlobs(obj);
    }
})


function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}


document.querySelector("#gallerySave").addEventListener("click", async () => {
    console.log("save");
    db.table("galleries").toArray().then((e) => {
        download("galleries.json", JSON.stringify(e))
    })
});

document.querySelector("#readSave").addEventListener("click", async () => {
    console.log("save");
    db.table("reads").toArray().then((e) => {
        download("reads.json", JSON.stringify(e))
    })
});

document.querySelector("#blobSave").addEventListener("click", async () => {
    console.log("save");
    db.table("blobs").toArray().then((e) => {
        download("blobs.json", JSON.stringify(e))
    })
});
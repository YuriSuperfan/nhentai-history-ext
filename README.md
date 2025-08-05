# nhentai History Extension

This extension records your reading history on
[nhentai.net](https://nhentai.net). You can then view it and get statistics !

## How to install

Go to `chrome://extensions/`, enable Developer Mode and click "Load unpacked".
Select this folder, and the extension should be enabled !

## How to use

Once the extension is enabled, it will start to record your history.

Clicking the extension in the tray will open a popup, which lets you access the
history, search and stats pages. You can also edit quick settings, or open the
full settings page.

### Pages

`history.html`: This page lets you see your history, with galleries grouped
together as sessions. Only a few sessions are opened at first, and the next can
be loaded by scrolling to the bottom of the page.

`stats.html`: This page lets you see stats about the galleries you read. You can
see the most read galleries, authors, tags... In a similar fashion to
`history.html`, you can load more entries by scrolling down.

`settings.html`: This page allows you to change the extension's settings, such
as the number of pages to be read before recording a gallery in history, or the
information to be displayed on an entry.

## Credit

The icon for the extension was created using a scroll design by Freepik uploaded
to [Flaticon](https://www.flaticon.com/free-icons/scroll), as well as the
favicon for [nhentai](https://nhentai.net).

The extension uses the [Dexie](https://dexie.org/) library to handle the
browser's IndexedDB.
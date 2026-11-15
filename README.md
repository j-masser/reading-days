# Reading Days

A personal calendar of the books you read each day.

- Tap any day to add books. Search pulls titles, authors and covers from Open Library.
- You can add more than one book to a day. The calendar shows them as a small stack.
- Books without a cover on Open Library, or added "as typed", get a generated cover in their own color.
- Stats: current streak, longest streak, days read in the month you're viewing, and books read that year.
- The "On the shelf" row shows every book you read in the month and how many days you spent on each.

## Running it

It is three static files (`index.html`, `styles.css`, `app.js`) with no build step.

- **On your computer:** open `index.html` in a browser.
- **Online (free):** put the folder in a GitHub repo and turn on GitHub Pages, or drag the folder onto Netlify Drop.

## Your data

Entries are saved in the browser you use (localStorage), so each device keeps its own log.
Use **Export backup** to download a `.json` file, and **Import backup** to load it on another
device or browser. Clearing your browser's site data erases the log, so export now and then.

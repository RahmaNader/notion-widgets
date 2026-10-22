# Multi Timer

A web rebuild of the Android "Multi Timer" app as a static widget. Open `index.html`, or embed the hosted page in Notion with `/embed`.

Data is saved in the browser (localStorage). Use **Export boards (.mt)** to back it up or move it to another browser.

## Elements
Countdown, Quick timer, Interval, Pomodoro, CountUp, Stopwatch, Counter, Clock, Buttons (up to 3 buttons, each running commands on other timers), and Container (runs a timer from any board in place).

## Controls
- **Tap**: start / pause / continue. On a finished timer, a tap stops the alarm and resets it.
- **Double-tap**: reset (can be turned off in Settings → Controls).
- **Long-press or right-click**: Start, Delay, Add time, Reset, History, Single view, Edit, Copy, Move to board, Delete.
- **Board menu (⋮)**: Rename, Edit board (drag to reorder, set columns, add elements), Add a timer, Import, Export to Excel, Web Share, Export, Copy board, Undo last action, Delete board.

## Importing timers
Use **Import** for `.xlsx`, `.xls`, `.csv`, a Notion database CSV export, or a `.mt` backup. Use **Linked sheets** for a URL that can be synced again later (a Google Sheets link shared as "Anyone with the link", or a published CSV link). You can merge the sheet into a board or mirror it exactly.

Use **Download Excel template** for a ready-made example. Each sheet becomes a board unless the sheet has a `Board` column. The main columns are below; column names are not case-sensitive, and the aliases are in brackets.

| Column | Example |
| --- | --- |
| Board (Category, Group, List) | `Morning` |
| Name (Timer, Title, Task) | `Skin care` |
| Type | `countdown` (default), `quick`, `interval`, `pomodoro`, `countup`, `stopwatch`, `counter`, `clock` |
| Duration (Time, Time block, Minutes) | `25m`, `1h 30m`, `90`, `01:30:00`, `25:00` |
| Color / Icon | `pink` or `#ec4899` / `spa` (a Font Awesome name; if empty, an icon is picked from the timer name) |
| Auto repeat, Autocomplete | `yes` / `no` |
| Intervals, Repeats | `Work 40s; Rest 20s`, `8` |
| Short break, Long break, Sessions | Pomodoro settings |
| Initial, Final, Step | Counter settings |
| Timezone | `Africa/Cairo` |

A Notion database exported as CSV imports as-is: `Category` becomes the board and `Time block` becomes the duration.

## Desktop notifications
Settings → Alert settings → **Desktop notifications** (or the banner on the board). Notifications stay on screen until you dismiss them and have **Stop** and **+1 min** buttons.
- **Widget opened in its own tab:** the browser asks for permission once and the page shows the notifications itself.
- **Widget embedded in Notion:** browsers don't let embeds show notifications, so turning them on opens a small **notifier window**. Allow notifications in it once, then keep it open (minimized is fine). The embed sends it the timers' end times, so notifications arrive on time even when the Notion tab is in the background. If you close it, use **Reopen window** in Alert settings.

## Browser limits
Alarms and notifications only work while the page (or the Notion page that embeds it) is open. Timers are based on the clock, so a timer that finishes while the page is closed shows its overtime when you reopen it. Vibration works only in Android browsers. Keeping the screen on needs a browser that supports the Screen Wake Lock API.

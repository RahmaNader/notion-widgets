# The Task Oracle

A wheel that picks a random task for you. Open `index.html`, or embed the hosted page in Notion with `/embed`. Tasks, filters and history are saved in the browser.

## Getting tasks from Notion
1. Open **Tasks** or **Reoccurring tasks** as a full page.
2. Click **•••** → **Export** → **Markdown & CSV**.
3. Unzip the download and drop the `…_all.csv` file (or an Excel copy of it) onto the widget.

Both exports are recognised automatically. Tasks marked Done/Cancelled and tasks with **Hide** ticked are skipped. For recurring tasks you can import only the ones whose Status is **Active**. Importing the same file again updates those tasks instead of duplicating them.

Columns used: Name, Time block, Category, Tags, Routine, Priority, Progress, Status, Items, Notes, Link, Day, Optional, Hide. A simple `Task Name, Time, Item1 | Item2, Notes` CSV also works, and **Excel template** downloads an example.

## Picking
- **Filters** (category, routine, tags, priority, source file, time available, today's tasks) decide what's on the wheel.
- **No repeats** removes each chosen task until every task has had its turn; then a new round starts.
- **Favour higher priority** makes slices bigger by priority (Low 1, Medium 2, High 3, Extremely High 4).
- After a spin: **Done**, **Spin again**, **Copy name** (to find it in Notion), **Open link**, or **Remove from wheel**. Recent picks are listed under **Recent Fates**.

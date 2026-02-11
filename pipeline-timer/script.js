// --- State ---
let tasks = []; 
let notes = [];
let isRunning = false;
let timerInterval = null;
let secondsRemaining = 0; 
let userName = "";
let editingTaskIndex = -1;
let deletingTaskIndex = -1;
let viewMode = 'list'; 
let categoryColorMap = {};
let notesMinimized = false;

// DOM Elements
const taskContainer = document.getElementById('task-container');
const emptyState = document.getElementById('empty-state');
const btnStart = document.getElementById('btn-start');
const workspace = document.getElementById('workspace');
const viewIcon = document.getElementById('view-icon');
const viewLabel = document.getElementById('view-label');

// --- Init ---
function enterApp(e) {
    e.preventDefault();
    const input = document.getElementById('user-name-input');
    const name = input.value.trim();
    if (name) {
        userName = name;
        document.getElementById('user-greeting').innerText = `Welcome, ${userName}`;
        document.getElementById('app-title').innerText = `${userName}'s Puzzle`;
        
        const modal = document.getElementById('welcome-modal');
        modal.classList.add('opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 500);
    }
}

// --- Toggle Notes Panel ---
function toggleNotes() {
    const panel = document.getElementById('notes-panel');
    const icon = document.getElementById('notes-chevron');
    notesMinimized = !notesMinimized;
    
    if (notesMinimized) {
        panel.classList.replace('h-48', 'h-9'); 
        icon.style.transform = 'rotate(180deg)';
    } else {
        panel.classList.replace('h-9', 'h-48');
        icon.style.transform = 'rotate(0deg)';
    }
}

function exportNotes(e) {
    if(e) e.stopPropagation();
    if (notes.length === 0) {
        showBalloon("No notes to export");
        return;
    }
    
    const content = notes.map(n => `[${n.timestamp}] ${n.task}: ${n.text}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-notes-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showBalloon("Notes Exported!");
}

// --- Settings / Theme Logic ---
function openSettingsModal() {
    document.getElementById('settings-modal').classList.remove('hidden');
}

function toggleDarkMode() {
    document.documentElement.classList.toggle('dark');
}

function setTheme(colorName) {
    document.documentElement.removeAttribute('data-theme');
    if(colorName !== 'purple') {
        document.documentElement.setAttribute('data-theme', colorName);
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('sidebar-collapsed');
    
    const icons = sidebar.querySelector('.sidebar-collapsed-icons');
    if (sidebar.classList.contains('sidebar-collapsed')) {
        icons.classList.remove('hidden');
        icons.classList.add('flex');
    } else {
        icons.classList.add('hidden');
        icons.classList.remove('flex');
    }
}

function toggleView() {
    viewMode = viewMode === 'pipeline' ? 'list' : 'pipeline';
    if (viewMode === 'list') {
        viewIcon.className = "fa-solid fa-puzzle-piece";
        viewLabel.innerText = "Pipeline View";
    } else {
        viewIcon.className = "fa-solid fa-list";
        viewLabel.innerText = "List View";
    }
    renderTasks();
}

// --- Manual Add Task ---
function openAddTaskModal() {
    document.getElementById('add-task-modal').classList.remove('hidden');
    document.getElementById('new-task-name').value = '';
    document.getElementById('new-task-duration').value = '25';
}

function handleManualAddTask(e) {
    e.preventDefault();
    const name = document.getElementById('new-task-name').value;
    const duration = parseInt(document.getElementById('new-task-duration').value);
    const category = document.getElementById('new-task-category').value;

    if (name && duration > 0) {
        const newTask = createTaskObject(name, category, duration * 60);
        
        if (tasks.length === 0) {
             tasks = [newTask];
             resetTimer(true);
             tasks = [newTask];
             secondsRemaining = newTask.duration;
        } else {
            tasks.push(newTask);
        }

        document.getElementById('add-task-modal').classList.add('hidden');
        renderTasks();
        updateDashboard();
        showBalloon("Task Added");
    }
}

// --- Notes Logic ---
function addNote(e) {
    e.preventDefault();
    const input = document.getElementById('note-input');
    const text = input.value.trim();
    if (!text) return;

    const currentTaskName = tasks.length > 0 ? tasks[0].name : "No Active Task";
    const isTaskRunning = isRunning;
    
    const note = {
        text: text,
        task: currentTaskName,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        contextColor: isTaskRunning ? 'text-brand' : 'text-gray-400'
    };

    notes.unshift(note);
    renderNotes();
    input.value = '';
}

function renderNotes() {
    const container = document.getElementById('notes-list');
    if (notes.length === 0) {
        container.innerHTML = '<div class="text-center text-xs text-brand/30 italic mt-4">No notes yet.</div>';
        return;
    }

    container.innerHTML = notes.map(n => `
        <div class="bg-gray-50 dark:bg-darkBg rounded-lg p-3 border border-gray-100 dark:border-darkBorder text-sm">
            <p class="text-gray-800 dark:text-gray-200 mb-1">${n.text}</p>
            <div class="flex justify-between items-center text-[10px]">
                <span class="font-bold uppercase ${n.contextColor}"><i class="fa-solid fa-tag mr-1"></i> ${n.task}</span>
                <span class="text-gray-400">${n.timestamp}</span>
            </div>
        </div>
    `).join('');
}

// --- File Handling ---
function handleFileSelect(input) {
    const fileNameDisplay = document.getElementById('file-name-display');
    if (input.files && input.files.length > 0) {
        fileNameDisplay.textContent = input.files[0].name;
    } else {
        fileNameDisplay.textContent = "";
    }
}

function processFile() {
    const fileInput = document.getElementById('csv-file-input');
    if (!fileInput.files || !fileInput.files.length) {
        showBalloon("Please select a file first");
        return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => parseCSVData(e.target.result);
    reader.readAsText(file);
}

function parseCSVData(text) {
    const trimmedText = text.trim();
    if (!trimmedText) return showBalloon("File empty.");
    const rows = splitCSV(trimmedText);
    if (rows.length < 2) return showBalloon("Invalid CSV.");
    
    const headers = rows[0].map(h => h.toLowerCase().trim());
    const nameIdx = headers.indexOf('name');
    const timeIdx = headers.indexOf('time block');
    const categoryIdx = headers.indexOf('category');

    if (nameIdx === -1 || timeIdx === -1) {
        showBalloon("Missing 'Name' or 'Time block' columns.");
        return;
    }

    const newTasks = [];
    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        if (cols.length < headers.length) continue;
        const rawTime = cols[timeIdx] || "0";
        const durationMinutes = parseDuration(rawTime);
        if (durationMinutes > 0) {
            newTasks.push(createTaskObject(
                cols[nameIdx] || "Task",
                categoryIdx > -1 ? cols[categoryIdx] : "General",
                durationMinutes * 60
            ));
        }
    }

    if (newTasks.length > 0) {
        if(tasks.length > 0) {
             tasks = tasks.concat(newTasks);
             showBalloon("Tasks Appended!");
        } else {
            resetTimer(true);
            tasks = newTasks;
            if(tasks.length > 0) secondsRemaining = tasks[0].duration;
            showBalloon("Puzzle Generated!");
        }
        renderTasks();
        updateDashboard();
    } else {
        showBalloon("No valid tasks found.");
    }
}

function splitCSV(str) {
    const arr = [];
    let quote = false;
    let col = 0, row = 0;
    for (let c = 0; c < str.length; c++) {
        let cc = str[c], nc = str[c+1];
        arr[row] = arr[row] || [];
        arr[row][col] = arr[row][col] || '';
        if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }
        if (cc == '"') { quote = !quote; continue; }
        if (cc == ',' && !quote) { ++col; continue; }
        if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }
        if (cc == '\n' && !quote) { ++row; col = 0; continue; }
        if (cc == '\r' && !quote) { ++row; col = 0; continue; }
        arr[row][col] += cc;
    }
    return arr;
}

function parseDuration(timeStr) {
    const match = timeStr.match(/(\d+)/);
    return match ? parseInt(match[0]) : 0;
}

function createTaskObject(name, category, durationSeconds) {
    return {
        id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        name: name,
        category: category,
        duration: durationSeconds,
        originalDuration: durationSeconds
    };
}

// --- Rendering ---
function renderTasks() {
    const oldPieces = taskContainer.querySelectorAll('.puzzle-piece, .list-piece, .static-node');
    oldPieces.forEach(p => p.remove());

    if (tasks.length === 0) {
        taskContainer.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    taskContainer.classList.remove('hidden');
    emptyState.classList.add('hidden');

    workspace.scrollTop = 0;
    workspace.scrollLeft = 0;

    if (viewMode === 'pipeline') {
        workspace.classList.remove('overflow-y-auto', 'overflow-x-hidden', 'flex-col');
        workspace.classList.add('overflow-x-auto', 'overflow-y-hidden', 'block');
        workspace.classList.remove('justify-center');
        
        taskContainer.className = "flex flex-row items-center px-10 py-12 gap-0 min-w-max mx-auto h-full";
        
        const startNode = document.createElement('div');
        startNode.className = "static-node flex flex-col items-center justify-center h-40 w-20 bg-brand/5 dark:bg-darkBorder rounded-l-full rounded-r-none border-r border-brand/20 dark:border-gray-600 z-[100] shadow-sm mr-[-10px]";
        startNode.innerHTML = `<span class="text-xs font-bold text-brand -rotate-90 tracking-widest uppercase">Start</span>`;
        taskContainer.appendChild(startNode);

    } else {
        workspace.classList.add('overflow-y-auto', 'overflow-x-hidden', 'flex-col');
        workspace.classList.remove('overflow-x-auto', 'overflow-y-hidden', 'block', 'justify-center');
        
        taskContainer.className = "flex flex-col items-stretch w-full max-w-2xl mx-auto py-8 px-6 h-auto mt-4";
    }

    const maxZ = tasks.length + 50; 

    tasks.forEach((task, index) => {
        const isCurrent = (index === 0);
        const displaySeconds = isCurrent ? secondsRemaining : task.duration;
        
        const el = document.createElement('div');
        el.setAttribute('draggable', !isRunning);
        el.dataset.index = index;

        const colorBase = getCategoryColor(task.category);
        const stripClass = `bg-${colorBase}-500`;
        const tagClass = `bg-${colorBase}-500/10 text-${colorBase}-600 dark:text-${colorBase}-400 border border-${colorBase}-500/20 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider`;

        if (viewMode === 'pipeline') {
            el.className = `puzzle-piece flex-shrink-0 select-none ${isCurrent ? 'active-piece' : ''}`;
            el.style.zIndex = maxZ - index;

            el.innerHTML = `
                <div class="puzzle-card-body">
                    <div class="h-2 w-full rounded-t-[10px] ${stripClass}"></div>
                    <div class="puzzle-content-wrapper ${!isCurrent ? 'mt-6' : ''}"> <!-- Adjusted top margin -->
                        <div class="flex justify-between items-start gap-2">
                            <h3 class="font-bold text-gray-700 dark:text-gray-200 text-sm leading-tight line-clamp-2" title="${task.name}">${task.name}</h3>
                            <div class="cursor-grab text-gray-300 dark:text-gray-600 hover:text-gray-500 ${isRunning ? 'opacity-0' : ''}">
                                <i class="fa-solid fa-grip-vertical"></i>
                            </div>
                        </div>
                        <div class="mt-2">
                            <div class="flex justify-between items-end">
                                <span class="${tagClass}">
                                    ${task.category}
                                </span>
                                <span class="font-mono text-lg font-bold ${isCurrent ? 'text-brand' : 'text-gray-500 dark:text-gray-500'} timer-display">
                                    ${formatTime(displaySeconds)}
                                </span>
                            </div>
                            ${isCurrent ? `
                            <div class="progress-bar-container">
                                <div class="h-full progress-bar" style="width: ${(1 - (displaySeconds / task.originalDuration)) * 100}%"></div>
                            </div>
                            ` : ''}
                            ${!isRunning ? `
                            <div class="mt-2 pt-2 border-t border-gray-100 dark:border-darkBorder flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onclick="duplicateTask(${index})" class="text-gray-400 hover:text-brand text-xs" title="Duplicate"><i class="fa-regular fa-copy"></i></button>
                                <button onclick="openEditModal(${index})" class="text-gray-400 hover:text-brand text-xs" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                                <button onclick="openDeleteModal(${index})" class="text-gray-400 hover:text-red-500 text-xs" title="Delete"><i class="fa-solid fa-trash"></i></button>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        } else {
            el.className = `list-piece select-none ${isCurrent ? 'active-piece' : ''}`;
            el.style.zIndex = 1;

            el.innerHTML = `
                <div class="puzzle-card-body flex-row overflow-hidden">
                    <div class="w-2 h-full ${stripClass}"></div>
                    <div class="puzzle-content-wrapper w-full !p-4 !flex-row !items-center !justify-between">
                        <div class="flex items-center gap-4 flex-1">
                            <div class="cursor-grab text-gray-300 dark:text-gray-600 hover:text-gray-500 ${isRunning ? 'opacity-0' : ''}">
                                <i class="fa-solid fa-grip-vertical"></i>
                            </div>
                            <div class="flex flex-col items-start">
                                <h3 class="font-bold text-gray-700 dark:text-gray-200 text-sm leading-tight">${task.name}</h3>
                                <span class="mt-1 ${tagClass}">
                                    ${task.category}
                                </span>
                            </div>
                        </div>

                        <div class="flex items-center gap-4 md:gap-8">
                            <div class="text-right w-20">
                                <span class="font-mono text-lg font-bold ${isCurrent ? 'text-brand' : 'text-gray-500 dark:text-gray-500'} timer-display">
                                    ${formatTime(displaySeconds)}
                                </span>
                            </div>
                            
                            ${!isRunning ? `
                            <div class="flex gap-3">
                                <button onclick="duplicateTask(${index})" class="text-gray-300 hover:text-brand text-xs" title="Duplicate"><i class="fa-regular fa-copy"></i></button>
                                <button onclick="openEditModal(${index})" class="text-gray-300 hover:text-brand text-xs" title="Edit"><i class="fa-solid fa-pencil"></i></button>
                                <button onclick="openDeleteModal(${index})" class="text-gray-300 hover:text-red-500 text-xs" title="Delete"><i class="fa-solid fa-trash"></i></button>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    ${isCurrent ? `
                        <div class="absolute bottom-0 left-0 w-full h-1 bg-gray-100 dark:bg-darkBorder">
                            <div class="h-full progress-bar" style="width: ${(1 - (displaySeconds / task.originalDuration)) * 100}%"></div>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        el.classList.add('group');

        if (!isRunning) {
            el.addEventListener('dragstart', handleDragStart);
            el.addEventListener('dragover', handleDragOver);
            el.addEventListener('drop', handleDrop);
            el.addEventListener('dragenter', handleDragEnter);
            el.addEventListener('dragleave', handleDragLeave);
        }

        taskContainer.appendChild(el);
    });

    if (viewMode === 'pipeline') {
         const finishNode = document.createElement('div');
         finishNode.className = "static-node flex flex-col items-center justify-center h-40 w-20 bg-brand/5 dark:bg-darkBorder rounded-r-full rounded-l-none border-l border-brand/20 dark:border-gray-600 z-0 shadow-sm ml-[-10px] pl-8";
         finishNode.innerHTML = `<span class="text-xs font-bold text-brand -rotate-90 tracking-widest uppercase">Finish</span>`;
         taskContainer.appendChild(finishNode);
    }
}

function getCategoryColor(category) {
    if (!category) return 'gray';
    if (categoryColorMap[category]) {
        return categoryColorMap[category];
    }
    const colors = ['rose', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'slate'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    categoryColorMap[category] = randomColor;
    return randomColor;
}

// --- Core Logic ---
function toggleTimer() {
    if (tasks.length === 0) return;
    if (isRunning) pauseTimer();
    else startTimer();
}

function startTimer() {
    if (tasks.length === 0) return;
    if (secondsRemaining <= 0) secondsRemaining = tasks[0].duration;
    isRunning = true;
    updateBtnState(true);
    renderTasks();
    timerInterval = setInterval(tick, 1000);
}

function pauseTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    updateBtnState(false);
    renderTasks();
}

function updateBtnState(running) {
    if (running) {
        btnStart.innerHTML = '<i class="fa-solid fa-pause"></i> <span>Pause Flow</span>';
        btnStart.className = "w-full mb-3 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-amber-200 transition flex items-center justify-center gap-2 text-lg transform hover:scale-[1.02]";
        document.getElementById('btn-sidebar-start').innerHTML = '<i class="fa-solid fa-pause text-sm"></i>';
    } else {
        btnStart.innerHTML = '<i class="fa-solid fa-play"></i> <span>Start Flow</span>';
        btnStart.className = "w-full mb-3 bg-brand hover:bg-brandHover text-white py-3 rounded-xl font-bold shadow-lg shadow-brand/20 transition flex items-center justify-center gap-2 text-lg transform hover:scale-[1.02]";
        document.getElementById('btn-sidebar-start').innerHTML = '<i class="fa-solid fa-play text-sm"></i>';
    }
}

function tick() {
    if (secondsRemaining > 0) {
        secondsRemaining--;
        const activeCard = taskContainer.querySelector('.active-piece');
        if (activeCard) {
            activeCard.querySelector('.timer-display').innerText = formatTime(secondsRemaining);
            const pBar = activeCard.querySelector('.progress-bar');
            if(pBar) pBar.style.width = `${(1 - (secondsRemaining / tasks[0].originalDuration)) * 100}%`;
        }
    } else {
        completeCurrentTask();
    }
    updateDashboard();
}

function completeCurrentTask() {
    showBalloon(`Done: ${tasks[0].name}`);
    playNotification();
    fireConfetti();
    tasks.shift();
    handleNextTask();
}

function skipCurrentTask() {
    if (tasks.length === 0) return;
    const t = tasks.shift();
    t.duration = t.originalDuration;
    tasks.push(t);
    handleNextTask();
}

function markDoneManual() {
    if (tasks.length === 0) return;
    showBalloon(`Cleared: ${tasks[0].name}`);
    tasks.shift();
    handleNextTask();
}

function handleNextTask() {
    if (tasks.length > 0) {
        secondsRemaining = tasks[0].duration;
    } else {
        finishPipeline();
    }
    renderTasks();
    updateDashboard();
}

function finishPipeline() {
    clearInterval(timerInterval);
    isRunning = false;
    btnStart.innerHTML = '<i class="fa-solid fa-check"></i> Finished';
    btnStart.className = "w-full mb-3 bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-xl font-bold shadow-lg transition flex items-center justify-center gap-2 text-lg transform hover:scale-[1.02]";
    showBalloon("All tasks completed!", true);
    document.getElementById('finish-modal').classList.remove('hidden');
}

function resetTimer(full = false) {
    clearInterval(timerInterval);
    isRunning = false;
    if (full) { tasks = []; secondsRemaining = 0; }
    else if(tasks.length > 0) secondsRemaining = tasks[0].originalDuration;
    updateBtnState(false);
    renderTasks();
    updateDashboard();
}

// --- Helpers ---
function adjustTime(delta) {
    if (tasks.length === 0) return;
    secondsRemaining = Math.max(0, secondsRemaining + delta);
    renderTasks();
    updateDashboard();
}

function duplicateTask(idx) {
    const org = tasks[idx];
    tasks.splice(idx + 1, 0, createTaskObject(org.name + " (Copy)", org.category, org.duration));
    renderTasks();
    updateDashboard();
}

function openDeleteModal(idx) {
    deletingTaskIndex = idx;
    document.getElementById('delete-modal').classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden');
    deletingTaskIndex = -1;
}

function confirmDelete() {
    if (deletingTaskIndex === -1) return;
    
    const idx = deletingTaskIndex;
    if(idx === 0) {
        pauseTimer(); 
        tasks.splice(idx, 1);
        if(tasks.length > 0) {
            secondsRemaining = tasks[0].duration;
        } else {
            secondsRemaining = 0;
        }
    } else {
        tasks.splice(idx, 1);
    }
    
    closeDeleteModal();
    renderTasks();
    updateDashboard();
}

function openEditModal(idx) {
    editingTaskIndex = idx;
    const t = tasks[idx];
    document.getElementById('edit-name').value = t.name;
    document.getElementById('edit-duration').value = Math.ceil((idx===0 ? secondsRemaining : t.duration)/60);
    document.getElementById('edit-modal').classList.remove('hidden');
}

function saveEdit() {
    const name = document.getElementById('edit-name').value;
    const mins = parseInt(document.getElementById('edit-duration').value);
    if(name && mins > 0) {
        tasks[editingTaskIndex].name = name;
        const secs = mins * 60;
        if(editingTaskIndex === 0) { secondsRemaining = secs; tasks[0].originalDuration = secs; tasks[0].duration = secs; }
        else { tasks[editingTaskIndex].duration = secs; tasks[editingTaskIndex].originalDuration = secs; }
        closeEditModal();
        renderTasks();
        updateDashboard();
    }
}
function closeEditModal() { document.getElementById('edit-modal').classList.add('hidden'); }

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2,'0')}`;
}
function updateDashboard() {
    const now = new Date();
    // New line to update date
    const dateElement = document.getElementById('display-date');
    if (dateElement) {
        dateElement.innerText = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    document.getElementById('display-current-time').innerText = now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    if(tasks.length===0){
        document.getElementById('display-end-time').innerText = "--:--";
        return;
    }
    let total = (isRunning || secondsRemaining>0) ? secondsRemaining : tasks[0].duration;
    for(let i=1; i<tasks.length; i++) total += tasks[i].duration;
    document.getElementById('display-total-duration').innerText = `${Math.floor(total/60)}m`;
    document.getElementById('display-end-time').innerText = new Date(now.getTime()+total*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}
setInterval(updateDashboard, 1000);

function playNotification() { document.getElementById('timer-sound').play().catch(()=>{}); }
function fireConfetti() { if(typeof confetti==='function') confetti({particleCount:100,spread:70,origin:{y:0.6}}); }
function showBalloon(t) {
    const b = document.getElementById('notification-balloon');
    document.getElementById('notification-text').innerText = t;
    b.classList.remove('hidden', 'completion-balloon');
    void b.offsetWidth; 
    b.classList.add('completion-balloon');
    setTimeout(()=>b.classList.add('hidden'),4000);
}

let dragSrcEl = null;
function handleDragStart(e) {
    this.style.opacity = '0.4';
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.index);
    this.classList.add('dragging');
}
function handleDragOver(e) { e.preventDefault(); return false; }
function handleDragEnter(e) { }
function handleDragLeave(e) { }
function handleDrop(e) {
    e.stopPropagation();
    const srcIdx = parseInt(e.dataTransfer.getData('text/plain'));
    const destIdx = parseInt(this.dataset.index);
    if (srcIdx !== destIdx && !isNaN(srcIdx)) {
        const moved = tasks.splice(srcIdx, 1)[0];
        tasks.splice(destIdx, 0, moved);
        if(srcIdx===0 || destIdx===0) secondsRemaining = tasks[0].duration;
        renderTasks();
        updateDashboard();
    }
    return false;
}
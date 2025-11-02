// Bash Learning Platform - Main Application Logic

// Import modules with CommonJS/ESM interop: modules.js may be a CJS file when running
// in Node (tests) but bundlers expect ESM. Import the default and normalize.
// Try to import the CJS wrapper that re-exports content in a bundler-friendly way.
import modulesCJS from '../../modules.cjs';
const modules = (modulesCJS && modulesCJS.modules) ? modulesCJS.modules : modulesCJS;
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

let terminal;
let currentQuiz = null;
let currentQuestionIndex = 0;

// Progress tracking
let userProgress = {
  completedQuizzes: [],
  completedExercises: [],
  currentSection: 'welcome',
};

// Virtual File System
let virtualFS = {
  '/': {
    type: 'dir',
    children: {
      'home': {
        type: 'dir',
        children: {
          'user': {
            type: 'dir',
            children: {
              'file1.txt': { type: 'file', content: 'This is file1.txt\n' },
              'file2.txt': { type: 'file', content: 'This is file2.txt\n' },
              'directory1': {
                type: 'dir',
                children: {}
              }
            }
          }
        }
      }
    }
  }
};

let currentPath = '/home/user';
let commandHistory = [];
let historyIndex = -1;

// Initialize the application
window.addEventListener('load', function () {
  loadProgress();
  initTerminal();
  setupEventListeners();
  loadWelcomeContent();
});

// Fetch authentication token for WebSocket
async function fetchToken() {
  // Skip token fetching when opened as file://
  if (window.location.protocol === 'file:') {
    return null;
  }
  try {
    // First try the same origin (works when vite proxy is configured)
    let response = await fetch('/token');
    if (!response.ok) {
      // If the dev server proxy isn't available or backend errored, try backend directly
      console.warn('/token returned non-OK, trying backend at port 3000');
      response = await fetch(`${window.location.protocol}//${window.location.hostname}:3000/token`);
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.token;
  } catch (e) {
    console.warn('Failed to fetch token, falling back to simulated terminal:', e);
    // Always fall back to simulated terminal for development
    return null;
  }
}

// Initialize XTerm terminal
function initTerminal() {
  terminal = new Terminal({
    cursorBlink: true,
    theme: {
      background: '#1e1e1e',
      foreground: '#f0f0f0',
      cursor: '#61dafb',
    },
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(document.getElementById('terminal'));
    fitAddon.fit();
    // Ensure the terminal accepts keyboard input immediately
    terminal.focus();
    // Explicitly allow stdin (in case an environment set it off)
    try {
      terminal.setOption('disableStdin', false);
    } catch (e) {
      // Older xterm versions may not support setOption; ignore safely
    }

  // Make terminal globally accessible
  window.terminal = terminal;

  terminal.writeln('Welcome to Bash Simulator!');
  terminal.writeln('Type "help" for available commands or start learning!');
  terminal.writeln('');
  terminal.write('$ ');

  // Add a hidden div for testing terminal output
  const outputDiv = document.createElement('div');
  outputDiv.id = 'terminal-output';
  outputDiv.style.display = 'none';
  document.body.appendChild(outputDiv);

  // Make clicking the terminal container focus the xterm instance (helpful on some browsers)
  const termContainer = document.getElementById('terminal');
  if (termContainer) {
    termContainer.style.cursor = 'text';
    termContainer.addEventListener('click', () => terminal.focus());
  }

  // Add a small status UI with controls: Mode label, Force simulated button, Debug toggle
  let debugKeys = false;
  // socket and connection flag are declared here so status UI handlers can access them
  let socket = null;
  let remoteConnected = false;
  function createStatusUI() {
    const container = document.getElementById('terminal');
    if (!container) return;
    container.style.position = container.style.position || 'relative';
    const status = document.createElement('div');
    status.id = 'terminal-status';
    status.style.position = 'absolute';
    status.style.right = '8px';
    status.style.top = '8px';
    status.style.zIndex = '20';
    status.style.display = 'flex';
    status.style.alignItems = 'center';
    status.style.gap = '8px';

    const mode = document.createElement('span');
    mode.id = 'terminal-mode';
    mode.textContent = 'Mode: init';
    mode.style.background = 'rgba(0,0,0,0.6)';
    mode.style.color = '#fff';
    mode.style.padding = '4px 8px';
    mode.style.borderRadius = '6px';
    mode.style.fontSize = '12px';

    const btnSim = document.createElement('button');
    btnSim.textContent = 'Use simulated';
    btnSim.style.padding = '4px 8px';
    btnSim.style.fontSize = '12px';
    btnSim.addEventListener('click', () => {
      // force simulated terminal
      try { if (socket) socket.close(); } catch (e) {}
      remoteConnected = false;
      setMode('simulated');
      useLocalSimulated();
    });

    const btnDbg = document.createElement('button');
    btnDbg.textContent = 'Toggle debug';
    btnDbg.style.padding = '4px 8px';
    btnDbg.style.fontSize = '12px';
    btnDbg.addEventListener('click', () => {
      debugKeys = !debugKeys;
      btnDbg.textContent = debugKeys ? 'Debug: ON' : 'Debug: OFF';
      console.info('Terminal debug keystrokes', debugKeys ? 'enabled' : 'disabled');
    });

    // Theme toggle
    const btnTheme = document.createElement('button');
    btnTheme.textContent = 'Theme';
    btnTheme.style.padding = '4px 8px';
    btnTheme.style.fontSize = '12px';
    btnTheme.addEventListener('click', () => {
      const body = document.body;
      const isLight = body.classList.toggle('light-theme');
      btnTheme.textContent = isLight ? 'Light' : 'Dark';
      try { localStorage.setItem('theme', isLight ? 'light' : 'dark'); } catch (e) {}
    });

    // Font size control
    const fontSelect = document.createElement('select');
    ['12','14','16','18'].forEach(sz => {
      const opt = document.createElement('option');
      opt.value = sz;
      opt.textContent = sz + 'px';
      fontSelect.appendChild(opt);
    });
    fontSelect.value = '14';
    fontSelect.style.padding = '4px';
    fontSelect.addEventListener('change', () => {
      const size = parseInt(fontSelect.value, 10);
      try {
        terminal.setOption && terminal.setOption('fontSize', size);
      } catch (e) {}
      try { localStorage.setItem('fontSize', String(size)); } catch (e) {}
    });

    status.appendChild(mode);
    status.appendChild(btnSim);
    status.appendChild(btnDbg);
    status.appendChild(btnTheme);
    status.appendChild(fontSelect);
    container.appendChild(status);
  }
  createStatusUI();

  function setMode(m) {
    const el = document.getElementById('terminal-mode');
    if (el) el.textContent = `Mode: ${m}`;
  }

  // Try to connect to a backend pty server for a full shell. If unavailable,
  // fall back to the in-browser simulated terminal.
  function useLocalSimulated() {
    terminal.writeln('\r\n[Offline simulated terminal]');
    // Make sure the terminal has focus so typing is captured
    terminal.focus();
    setMode('simulated');
  }

  // Only attempt WebSocket connection if the page was loaded from an http(s) origin.
  if (window.location && window.location.host) {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  let socketUrl = `${protocol}://${window.location.host}/pty`;

    // Single input handler: forward to backend when connected, otherwise handle locally
    terminal.onData((data) => {
      // optional debug: log raw keystrokes
      try {
        if (debugKeys) console.debug('xterm.onData ->', JSON.stringify(data));
      } catch (e) {}

      if (remoteConnected && socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(data);
        } catch (e) {
          handleTerminalInput(data);
        }
      } else {
        handleTerminalInput(data);
      }
    });

    // Fetch token and include in URL
    fetchToken().then(token => {
      if (token) {
        socketUrl += `?token=${token}`;
      }

        // Try the proxied URL first, then fall back to the backend server at port 3000
        const hostname = window.location.hostname || 'localhost';
        const backendUrl = `${protocol}://${hostname}:3000/pty`;
        const candidates = [socketUrl, backendUrl];

        function tryConnect(index = 0) {
          if (index >= candidates.length) {
            // No connection could be made — fall back to simulated terminal
            useLocalSimulated();
            return;
          }
          const url = candidates[index];
          try {
            socket = new WebSocket(url);
            socket.binaryType = 'arraybuffer';
          } catch (e) {
            // Try next candidate
            tryConnect(index + 1);
            return;
          }

          // If we don't receive open within a short time, try the next candidate
          let opened = false;
          const openTimeout = setTimeout(() => {
            if (!opened) {
              try {
                socket.close();
              } catch (e) {}
              tryConnect(index + 1);
            }
          }, 2500);

          socket.onopen = () => {
            opened = true;
            clearTimeout(openTimeout);
            remoteConnected = true;
            setMode('backend');
            terminal.writeln('\r\n[Connected to backend shell]');
            // Focus the terminal when connected
            terminal.focus();
            // Send initial resize
            socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
          };

          socket.onmessage = (ev) => {
            // Server sends raw text for terminal output
            terminal.write(typeof ev.data === 'string' ? ev.data : new TextDecoder().decode(ev.data));
          };

          socket.onerror = () => {
            // If not connected yet, try the next candidate
            if (!remoteConnected) {
              try {
                socket.close();
              } catch (e) {}
              tryConnect(index + 1);
            }
          };

          socket.onclose = () => {
            remoteConnected = false;
            setMode('disconnected');
            terminal.writeln('\r\n[Disconnected from backend]');
            // revert to local simulation
            useLocalSimulated();
          };
        }

        tryConnect();

        // Resize handling: whenever the window or terminal is resized, let backend know
        window.addEventListener('resize', () => {
          fitAddon.fit();
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
          }
        });
    }).catch(() => {
      useLocalSimulated();
    });
  } else {
    // File:// or unknown origin — use offline simulation
    useLocalSimulated();
  }
}

// Setup event listeners for navigation
function setupEventListeners() {
  document.getElementById('theory-btn').addEventListener('click', () => loadTheory());
  document.getElementById('exercises-btn').addEventListener('click', () => loadExercises());
  document.getElementById('quizzes-btn').addEventListener('click', () => loadQuizzes());
  document.getElementById('terminal-btn').addEventListener('click', () => showTerminal());
  document.getElementById('progress-btn').addEventListener('click', () => loadProgressView());
}

// Load welcome content
function loadWelcomeContent() {
  const content = document.getElementById('content');
  content.innerHTML = `
        <section id="welcome">
            <h2>Welcome to Bash Mastery</h2>
            <p>Immerse yourself in learning Bash through interactive theory, practical exercises, quizzes, and a simulated terminal environment. Cover everything from basics to advanced scripting.</p>
            <h3>Getting Started</h3>
            <ul>
                <li><strong>Theory:</strong> Learn Bash concepts with detailed explanations and examples.</li>
                <li><strong>Exercises:</strong> Practice with hands-on coding challenges.</li>
                <li><strong>Quizzes:</strong> Test your knowledge with interactive assessments.</li>
                <li><strong>Terminal Simulator:</strong> Experiment with Bash commands in a safe environment.</li>
            </ul>
            <p>Click on any section above to begin your Bash learning journey!</p>
        </section>
    `;
}

// Load theory content
function loadTheory() {
  const content = document.getElementById('content');
  content.innerHTML = `
        <h2>Bash Theory</h2>
        <nav class="sub-nav">
            <button onclick="loadTheorySection('basics')">Basics</button>
            <button onclick="loadTheorySection('scripting')">Scripting</button>
            <button onclick="loadTheorySection('advanced')">Advanced</button>
        </nav>
        <div id="theory-content">
            <p>Select a topic to begin learning.</p>
        </div>
    `;
}

// Load theory section
function loadTheorySection(section) {
  const theoryContent = document.getElementById('theory-content');
  theoryContent.innerHTML = modules.theory[section].content;
}

// Load exercises
function loadExercises() {
  const content = document.getElementById('content');
  content.innerHTML = `
        <h2>Bash Exercises</h2>
        <nav class="sub-nav">
            <button onclick="loadExerciseSection('basic')">Basic Exercises</button>
            <button onclick="loadExerciseSection('scripting')">Scripting Exercises</button>
        </nav>
        <div id="exercise-content">
            <p>Select an exercise type to practice.</p>
        </div>
    `;
}

// Load exercise section
function loadExerciseSection(section) {
  const exerciseContent = document.getElementById('exercise-content');
  exerciseContent.innerHTML = modules.exercises[section].content;
}

// Load quizzes
function loadQuizzes() {
  const content = document.getElementById('content');
  content.innerHTML = `
        <h2>Bash Quizzes</h2>
        <nav class="sub-nav">
            <button onclick="startQuiz('basics')">Basics Quiz</button>
            <button onclick="startQuiz('scripting')">Scripting Quiz</button>
        </nav>
        <div id="quiz-content">
            <p>Select a quiz to test your knowledge.</p>
        </div>
    `;
}

// Start quiz
function startQuiz(quizType) {
  currentQuiz = modules.quizzes[quizType];
  currentQuestionIndex = 0;
  showQuestion();
}

// Show current question
function showQuestion() {
  const quizContent = document.getElementById('quiz-content');
  const question = currentQuiz.questions[currentQuestionIndex];

  quizContent.innerHTML = `
        <div class="quiz-question">
            <h3>Question ${currentQuestionIndex + 1} of ${currentQuiz.questions.length}</h3>
            <p>${question.question}</p>
            <div class="quiz-options">
                ${question.options
                  .map(
                    (option, index) =>
                      `<label><input type="radio" name="quiz-option" value="${index}"> ${option}</label>`
                  )
                  .join('')}
            </div>
            <button onclick="checkAnswer()">Submit Answer</button>
        </div>
    `;
}

// Check quiz answer
function checkAnswer() {
  const selectedOption = document.querySelector('input[name="quiz-option"]:checked');
  if (!selectedOption) {
    alert('Please select an answer.');
    return;
  }

  const userAnswer = parseInt(selectedOption.value);
  const correctAnswer = currentQuiz.questions[currentQuestionIndex].answer;

  if (userAnswer === correctAnswer) {
    alert('Correct!');
  } else {
    alert(
      `Incorrect. The correct answer is: ${currentQuiz.questions[currentQuestionIndex].options[correctAnswer]}`
    );
  }

  currentQuestionIndex++;
  if (currentQuestionIndex < currentQuiz.questions.length) {
    showQuestion();
  } else {
    // Mark quiz as completed
    if (!userProgress.completedQuizzes.includes(currentQuiz.title)) {
      userProgress.completedQuizzes.push(currentQuiz.title);
      saveProgress();
    }
    document.getElementById('quiz-content').innerHTML = '<h3>Quiz completed! Great job!</h3>';
    currentQuiz = null;
  }
}

// Show terminal
function showTerminal() {
  const content = document.getElementById('content');
  content.innerHTML = `
        <h2>Terminal Simulator</h2>
        <p>Use the terminal on the right to practice Bash commands. Type "help" for available commands.</p>
    `;
  // Focus terminal when the terminal view is shown
  setTimeout(() => {
    try {
      if (window.terminal) window.terminal.focus();
    } catch (e) {}
  }, 50);
}

// Helper functions for virtual file system
function resolvePath(path) {
  if (path.startsWith('/')) {
    return path;
  }
  if (path === '~') {
    return '/home/user';
  }
  if (path === '.') {
    return currentPath;
  }
  if (path === '..') {
    const parts = currentPath.split('/').filter(p => p);
    parts.pop();
    return '/' + parts.join('/');
  }
  return currentPath + (currentPath === '/' ? '' : '/') + path;
}

function getNode(path) {
  const parts = path.split('/').filter(p => p);
  let node = virtualFS['/'];
  for (const part of parts) {
    if (node.type !== 'dir' || !node.children[part]) {
      return null;
    }
    node = node.children[part];
  }
  return node;
}

function createNode(path, type, content = '') {
  const parts = path.split('/').filter(p => p);
  let node = virtualFS['/'];
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!node.children[part] || node.children[part].type !== 'dir') {
      return false;
    }
    node = node.children[part];
  }
  const name = parts[parts.length - 1];
  if (node.children[name]) {
    return false; // Already exists
  }
  node.children[name] = { type, content, children: type === 'dir' ? {} : undefined };
  return true;
}

function removeNode(path) {
  const parts = path.split('/').filter(p => p);
  let node = virtualFS['/'];
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!node.children[part] || node.children[part].type !== 'dir') {
      return false;
    }
    node = node.children[part];
  }
  const name = parts[parts.length - 1];
  if (!node.children[name]) {
    return false;
  }
  delete node.children[name];
  return true;
}

// Handle terminal input
// Buffer input until the user presses Enter so single keystrokes are not processed as commands.
let _inputBuffer = '';
function processCommand(cmd, terminal = window.terminal) {
  if (!cmd) return;

  // Add to history
  commandHistory.push(cmd);
  historyIndex = commandHistory.length;

  const args = cmd.trim().split(/\s+/);
  const command = args[0];

  switch (command) {
    case 'help':
      terminal.writeln('');
      terminal.writeln('Available commands:');
      terminal.writeln('  pwd - Print working directory');
      terminal.writeln('  ls [options] [path] - List directory contents');
      terminal.writeln('  cd [path] - Change directory');
      terminal.writeln('  mkdir [path] - Create directory');
      terminal.writeln('  touch [file] - Create empty file');
      terminal.writeln('  rm [options] [path] - Remove files/directories');
      terminal.writeln('  cp [source] [dest] - Copy files');
      terminal.writeln('  mv [source] [dest] - Move/rename files');
      terminal.writeln('  cat [file] - Display file contents');
      terminal.writeln('  echo [text] - Display a line of text');
      terminal.writeln('  clear - Clear the terminal screen');
      terminal.writeln('  history - Show command history');
      terminal.writeln('');
      appendToOutput(
        'Available commands:\n  pwd - Print working directory\n  ls [options] [path] - List directory contents\n  cd [path] - Change directory\n  mkdir [path] - Create directory\n  touch [file] - Create empty file\n  rm [options] [path] - Remove files/directories\n  cp [source] [dest] - Copy files\n  mv [source] [dest] - Move/rename files\n  cat [file] - Display file contents\n  echo [text] - Display a line of text\n  clear - Clear the terminal screen\n  history - Show command history\n'
      );
      break;

    case 'pwd':
      terminal.writeln('');
      terminal.writeln(currentPath);
      terminal.writeln('');
      appendToOutput(currentPath + '\n');
      break;

    case 'ls': {
      const path = args[1] ? resolvePath(args[1]) : currentPath;
      const node = getNode(path);
      if (!node || node.type !== 'dir') {
        terminal.writeln(`ls: cannot access '${args[1] || '.'}': No such file or directory`);
        appendToOutput(`ls: cannot access '${args[1] || '.'}': No such file or directory\n`);
        break;
      }
      const items = Object.keys(node.children).sort();
      if (items.length === 0) {
        terminal.writeln('');
        appendToOutput('\n');
      } else {
        const output = items.map(item => {
          const child = node.children[item];
          return child.type === 'dir' ? item + '/' : item;
        }).join('  ');
        terminal.writeln('');
        terminal.writeln(output);
        terminal.writeln('');
        appendToOutput(output + '\n');
      }
      break;
    }

    case 'cd': {
      const path = args[1] ? resolvePath(args[1]) : '/home/user';
      const node = getNode(path);
      if (!node || node.type !== 'dir') {
        terminal.writeln(`cd: ${args[1] || '~'}: No such file or directory`);
        appendToOutput(`cd: ${args[1] || '~'}: No such file or directory\n`);
      } else {
        currentPath = path;
      }
      break;
    }

    case 'mkdir': {
      if (!args[1]) {
        terminal.writeln('mkdir: missing operand');
        appendToOutput('mkdir: missing operand\n');
        break;
      }
      const path = resolvePath(args[1]);
      if (createNode(path, 'dir')) {
        // Success, no output
      } else {
        terminal.writeln(`mkdir: cannot create directory '${args[1]}': File exists or invalid path`);
        appendToOutput(`mkdir: cannot create directory '${args[1]}': File exists or invalid path\n`);
      }
      break;
    }

    case 'touch': {
      if (!args[1]) {
        terminal.writeln('touch: missing file operand');
        appendToOutput('touch: missing file operand\n');
        break;
      }
      const path = resolvePath(args[1]);
      if (createNode(path, 'file')) {
        // Success, no output
      } else {
        // File already exists or invalid path, but touch should update timestamp
        // For simplicity, we'll just ensure it exists
        const node = getNode(path);
        if (!node) {
          terminal.writeln(`touch: cannot touch '${args[1]}': No such file or directory`);
          appendToOutput(`touch: cannot touch '${args[1]}': No such file or directory\n`);
        }
      }
      break;
    }

    case 'rm': {
      if (!args[1]) {
        terminal.writeln('rm: missing operand');
        appendToOutput('rm: missing operand\n');
        break;
      }
      const path = resolvePath(args[1]);
      if (removeNode(path)) {
        // Success, no output
      } else {
        terminal.writeln(`rm: cannot remove '${args[1]}': No such file or directory`);
        appendToOutput(`rm: cannot remove '${args[1]}': No such file or directory\n`);
      }
      break;
    }

    case 'cp': {
      if (args.length < 3) {
        terminal.writeln('cp: missing file operand');
        appendToOutput('cp: missing file operand\n');
        break;
      }
      const sourcePath = resolvePath(args[1]);
      const destPath = resolvePath(args[2]);
      const sourceNode = getNode(sourcePath);
      if (!sourceNode || sourceNode.type !== 'file') {
        terminal.writeln(`cp: cannot stat '${args[1]}': No such file`);
        appendToOutput(`cp: cannot stat '${args[1]}': No such file\n`);
        break;
      }
      if (createNode(destPath, 'file', sourceNode.content)) {
        // Success, no output
      } else {
        terminal.writeln(`cp: cannot create regular file '${args[2]}': File exists or invalid path`);
        appendToOutput(`cp: cannot create regular file '${args[2]}': File exists or invalid path\n`);
      }
      break;
    }

    case 'mv': {
      if (args.length < 3) {
        terminal.writeln('mv: missing file operand');
        appendToOutput('mv: missing file operand\n');
        break;
      }
      const sourcePath = resolvePath(args[1]);
      const destPath = resolvePath(args[2]);
      const sourceNode = getNode(sourcePath);
      if (!sourceNode) {
        terminal.writeln(`mv: cannot stat '${args[1]}': No such file or directory`);
        appendToOutput(`mv: cannot stat '${args[1]}': No such file or directory\n`);
        break;
      }
      if (createNode(destPath, sourceNode.type, sourceNode.content)) {
        removeNode(sourcePath);
        // Success, no output
      } else {
        terminal.writeln(`mv: cannot move '${args[1]}' to '${args[2]}': File exists or invalid path`);
        appendToOutput(`mv: cannot move '${args[1]}' to '${args[2]}': File exists or invalid path\n`);
      }
      break;
    }

    case 'cat': {
      if (!args[1]) {
        terminal.writeln('cat: missing file operand');
        appendToOutput('cat: missing file operand\n');
        break;
      }
      const path = resolvePath(args[1]);
      const node = getNode(path);
      if (!node || node.type !== 'file') {
        terminal.writeln(`cat: ${args[1]}: No such file`);
        appendToOutput(`cat: ${args[1]}: No such file\n`);
        break;
      }
      terminal.writeln('');
      terminal.writeln(node.content.trimEnd());
      terminal.writeln('');
      appendToOutput(node.content);
      break;
    }

    case 'echo': {
      const message = args.slice(1).join(' ');
      terminal.writeln('');
      terminal.writeln(message);
      terminal.writeln('');
      appendToOutput(message + '\n');
      break;
    }

    case 'clear':
      terminal.clear();
      clearOutput();
      break;

    case 'history':
      terminal.writeln('');
      commandHistory.forEach((cmd, index) => {
        terminal.writeln(`${index + 1}  ${cmd}`);
      });
      terminal.writeln('');
      appendToOutput(commandHistory.map((cmd, index) => `${index + 1}  ${cmd}`).join('\n') + '\n');
      break;

    default:
      terminal.writeln('');
      terminal.writeln(`bash: ${command}: command not found`);
      terminal.writeln('');
      appendToOutput(`bash: ${command}: command not found\n`);
  }
}

function handleTerminalInput(data) {
  // Ctrl+C
  if (data === '\x03') {
    terminal.write('^C\r\n');
    _inputBuffer = '';
    return;
  }

  // Arrow keys for history
  if (data === '\x1b[A') { // Up arrow
    if (historyIndex > 0) {
      historyIndex--;
      _inputBuffer = commandHistory[historyIndex];
      // Clear current line and rewrite
      terminal.write('\r\x1b[K$ ' + _inputBuffer);
    }
    return;
  }
  if (data === '\x1b[B') { // Down arrow
    if (historyIndex < commandHistory.length - 1) {
      historyIndex++;
      _inputBuffer = commandHistory[historyIndex];
      terminal.write('\r\x1b[K$ ' + _inputBuffer);
    } else if (historyIndex === commandHistory.length - 1) {
      historyIndex = commandHistory.length;
      _inputBuffer = '';
      terminal.write('\r\x1b[K$ ');
    }
    return;
  }

  // Backspace (handle common codes)
  if (data === '\x7f' || data === '\b') {
    if (_inputBuffer.length > 0) {
      _inputBuffer = _inputBuffer.slice(0, -1);
      // Erase character visually
      terminal.write('\b \b');
    }
    return;
  }

  // Enter - process the buffered command
  if (data === '\r' || data === '\n') {
    terminal.writeln('');
    const cmd = _inputBuffer.trim();
    _inputBuffer = '';
    processCommand(cmd);
    // Show prompt after command execution
    setTimeout(() => {
      terminal.write('$ ');
    }, 10);
    return;
  }

  // Printable characters - append to buffer and echo
  _inputBuffer += data;
  terminal.write(data);
}

// Check exercise answers (simplified)
function checkExercise(exerciseId) {
  let expected = '';

  switch (exerciseId) {
    case 'ex1':
      expected = 'mkdir my_project && cd my_project';
      break;
    case 'ex2':
      expected = 'echo "Hello, World!" > hello.txt && cat hello.txt';
      break;
    case 'ex3':
      expected = 'touch myscript.sh && chmod +x myscript.sh';
      break;
  }

  if (document.getElementById(exerciseId + '-input').value.trim() === expected) {
    alert('Correct! Well done.');
    // Mark exercise as completed
    if (!userProgress.completedExercises.includes(exerciseId)) {
      userProgress.completedExercises.push(exerciseId);
      saveProgress();
    }
  } else {
    alert('Not quite right. Try again or check the expected commands.');
  }
}

// Check script exercises (simplified)
function checkScriptExercise() {
  // In a real implementation, you'd parse and validate the script
  alert('Script submitted! In a full implementation, this would be validated.');
}

// Progress saving and loading functions
function saveProgress() {
  localStorage.setItem('bashLearningProgress', JSON.stringify(userProgress));
}

function loadProgress() {
  const saved = localStorage.getItem('bashLearningProgress');
  if (saved) {
    userProgress = JSON.parse(saved);
  }
}

// Load progress view
function loadProgressView() {
  const content = document.getElementById('content');
  content.innerHTML = `
        <h2>Your Progress</h2>
        <div class="progress-section">
            <h3>Completed Quizzes</h3>
            <ul>
                ${
                  userProgress.completedQuizzes.length > 0
                    ? userProgress.completedQuizzes.map((quiz) => `<li>${quiz}</li>`).join('')
                    : '<li>No quizzes completed yet.</li>'
                }
            </ul>
        </div>
        <div class="progress-section">
            <h3>Completed Exercises</h3>
            <ul>
                ${
                  userProgress.completedExercises.length > 0
                    ? userProgress.completedExercises
                        .map((ex) => `<li>Exercise ${ex}</li>`)
                        .join('')
                    : '<li>No exercises completed yet.</li>'
                }
            </ul>
        </div>
        <button onclick="clearProgress()">Clear Progress</button>
    `;
}

// Clear progress
function clearProgress() {
  if (confirm('Are you sure you want to clear all progress?')) {
    userProgress = {
      completedQuizzes: [],
      completedExercises: [],
      currentSection: 'welcome',
    };
    saveProgress();
    loadProgressView();
  }
}

// Helper functions for testing
function appendToOutput(text) {
  const outputDiv = document.getElementById('terminal-output');
  if (outputDiv) {
    outputDiv.textContent += text;
  }
}

function clearOutput() {
  const outputDiv = document.getElementById('terminal-output');
  if (outputDiv) {
    outputDiv.textContent = '';
  }
}

// Make functions global for onclick handlers
window.loadTheorySection = loadTheorySection;
window.loadExerciseSection = loadExerciseSection;
window.startQuiz = startQuiz;
window.checkAnswer = checkAnswer;
window.checkExercise = checkExercise;
window.checkScriptExercise = checkScriptExercise;
window.loadProgressView = loadProgressView;
window.clearProgress = clearProgress;

// Export for testing
export { processCommand };

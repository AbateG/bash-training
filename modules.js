// Content modules loader. We prefer to load content from separate files
// located under /content for easier editing and localization. When running
// in Node (tests, tooling) we read the files from disk. For browser builds
// we fall back to an inlined default so the client still works without fs.

const fs = require('fs');
const path = require('path');

function readFileIfExists(relativePath) {
  try {
    const p = path.join(__dirname, relativePath);
    return fs.readFileSync(p, 'utf8');
  } catch (e) {
    return null;
  }
}

// Try to load content files; fall back to embedded content below when not available
const theoryBasics = readFileIfExists('content/theory/basics.md');
const theoryScripting = readFileIfExists('content/theory/scripting.md');
const theoryAdvanced = readFileIfExists('content/theory/advanced.md');

const exercisesBasic = readFileIfExists('content/exercises/basic.md');
const exercisesScripting = readFileIfExists('content/exercises/scripting.md');

let quizzesBasics = null;
let quizzesScripting = null;
try {
  const qb = readFileIfExists('content/quizzes/basics.json');
  const qs = readFileIfExists('content/quizzes/scripting.json');
  if (qb) quizzesBasics = JSON.parse(qb);
  if (qs) quizzesScripting = JSON.parse(qs);
} catch (e) {
  quizzesBasics = null;
  quizzesScripting = null;
}

// Default inlined content (used when content files aren't available, e.g., in-browser builds).
const defaultModules = {
  theory: {
    basics: {
      title: 'Bash Basics',
      content:
        theoryBasics ||
        `
								<h3>Introduction to Bash</h3>
								<p>Bash (Bourne Again SHell) is a command processor that typically runs in a text window, allowing the user to type commands that cause actions. Bash can also read and execute commands from a file, called a shell script.</p>
                
								<h3>Basic Commands</h3>
								<ul>
										<li><code>pwd</code> - Print working directory</li>
										<li><code>ls</code> - List directory contents</li>
										<li><code>cd</code> - Change directory</li>
										<li><code>mkdir</code> - Make directory</li>
										<li><code>touch</code> - Create empty file</li>
										<li><code>cp</code> - Copy files and directories</li>
										<li><code>mv</code> - Move or rename files and directories</li>
										<li><code>rm</code> - Remove files and directories</li>
								</ul>
                
								<h3>File Permissions</h3>
								<p>Every file and directory has permissions for the owner, group, and others. Use <code>chmod</code> to change permissions.</p>
								<pre><code>chmod 755 script.sh</code></pre>
                
								<h3>Environment Variables</h3>
								<p>Environment variables are dynamic named values that affect the way running processes behave on a computer.</p>
								<pre><code>echo $HOME
export MY_VAR="Hello World"</code></pre>
						`,
    },
    scripting: {
      title: 'Bash Scripting',
      content:
        theoryScripting ||
        `
								<h3>Variables</h3>
								<p>In Bash, variables are used to store data. Variable names are case-sensitive.</p>
								<pre><code>name="John"
echo "Hello, $name"</code></pre>
                
								<h3>Conditional Statements</h3>
								<pre><code>if [ $age -gt 18 ]; then
		echo "Adult"
else
		echo "Minor"
fi</code></pre>
                
								<h3>Loops</h3>
								<p>For loop:</p>
								<pre><code>for i in {1..5}; do
		echo "Number: $i"
done</code></pre>
                
								<p>While loop:</p>
								<pre><code>count=1
while [ $count -le 5 ]; do
		echo "Count: $count"
		((count++))
done</code></pre>
                
								<h3>Functions</h3>
								<pre><code>function greet() {
		echo "Hello, $1"
}
greet "World"</code></pre>
                
								<h3>Command Substitution</h3>
								<pre><code>current_date=$(date)
echo "Today is $current_date"</code></pre>
                
								<h3>Arithmetic Operations</h3>
								<pre><code>result=$((5 + 3))
echo "5 + 3 = $result"</code></pre>
						`,
    },
    advanced: {
      title: 'Advanced Bash',
      content:
        theoryAdvanced ||
        `
								<h3>Process Management</h3>
								<ul>
										<li><code>ps</code> - Display process status</li>
										<li><code>kill</code> - Send signal to process</li>
										<li><code>bg</code> - Resume job in background</li>
										<li><code>fg</code> - Bring job to foreground</li>
										<li><code>jobs</code> - List active jobs</li>
								</ul>
                
								<h3>Networking</h3>
								<ul>
										<li><code>ping</code> - Send ICMP ECHO_REQUEST</li>
										<li><code>curl</code> - Transfer data from or to a server</li>
										<li><code>wget</code> - Non-interactive network downloader</li>
										<li><code>ssh</code> - OpenSSH SSH client</li>
										<li><code>scp</code> - Secure copy</li>
								</ul>
                
								<h3>Text Processing</h3>
								<ul>
										<li><code>grep</code> - Print lines matching a pattern</li>
										<li><code>sed</code> - Stream editor for filtering and transforming text</li>
										<li><code>awk</code> - Pattern scanning and processing language</li>
										<li><code>cut</code> - Remove sections from each line of files</li>
										<li><code>sort</code> - Sort lines of text files</li>
								</ul>
                
								<h3>System Administration</h3>
								<ul>
										<li><code>sudo</code> - Execute a command as another user</li>
										<li><code>df</code> - Report file system disk space usage</li>
										<li><code>du</code> - Estimate file space usage</li>
										<li><code>top</code> - Display Linux processes</li>
										<li><code>crontab</code> - Maintain crontab files</li>
								</ul>
                
								<h3>Debugging Scripts</h3>
								<pre><code>#!/bin/bash -x
set -e
set -u</code></pre>
                
								<h3>Traps and Signals</h3>
								<pre><code>trap 'echo "Script interrupted"' INT</code></pre>
						`,
    },
  },
  exercises: {
    basic: {
      title: 'Basic Exercises',
      content:
        exercisesBasic ||
        `
								<div class="exercise">
										<h3>Exercise 1: Navigation</h3>
										<p>Create a directory called 'my_project' and navigate into it.</p>
										<pre><code># Expected commands:
# mkdir my_project
# cd my_project</code></pre>
										<input type="text" id="ex1-input" placeholder="Enter your commands here">
										<button onclick="checkExercise('ex1')">Check Answer</button>
								</div>
                
								<div class="exercise">
										<h3>Exercise 2: File Operations</h3>
										<p>Create a file called 'hello.txt' with the content "Hello, World!" and then display its contents.</p>
										<pre><code># Expected commands:
# echo "Hello, World!" > hello.txt
# cat hello.txt</code></pre>
										<input type="text" id="ex2-input" placeholder="Enter your commands here">
										<button onclick="checkExercise('ex2')">Check Answer</button>
								</div>
                
								<div class="exercise">
										<h3>Exercise 3: Permissions</h3>
										<p>Create a script file 'myscript.sh' and make it executable.</p>
										<pre><code># Expected commands:
# touch myscript.sh
# chmod +x myscript.sh</code></pre>
										<input type="text" id="ex3-input" placeholder="Enter your commands here">
										<button onclick="checkExercise('ex3')">Check Answer</button>
								</div>
						`,
    },
    scripting: {
      title: 'Scripting Exercises',
      content:
        exercisesScripting ||
        `
								<div class="exercise">
										<h3>Exercise 1: Variables and Echo</h3>
										<p>Write a script that defines a variable 'name' with your name and prints "Hello, [name]!".</p>
										<pre><code>#!/bin/bash
name="Your Name"
echo "Hello, $name!"</code></pre>
										<textarea id="script1-input" rows="4" placeholder="Write your script here"></textarea>
										<button onclick="checkScriptExercise('script1')">Check Script</button>
								</div>
                
								<div class="exercise">
										<h3>Exercise 2: Conditional Statement</h3>
										<p>Write a script that checks if a number is greater than 10 and prints appropriate message.</p>
										<pre><code>#!/bin/bash
num=15
if [ $num -gt 10 ]; then
		echo "Number is greater than 10"
else
		echo "Number is not greater than 10"
fi</code></pre>
										<textarea id="script2-input" rows="6" placeholder="Write your script here"></textarea>
										<button onclick="checkScriptExercise('script2')">Check Script</button>
								</div>
                
								<div class="exercise">
										<h3>Exercise 3: Loop</h3>
										<p>Write a script that prints numbers from 1 to 5 using a for loop.</p>
										<pre><code>#!/bin/bash
for i in {1..5}; do
		echo $i
done</code></pre>
										<textarea id="script3-input" rows="4" placeholder="Write your script here"></textarea>
										<button onclick="checkScriptExercise('script3')">Check Script</button>
								</div>
						`,
    },
  },
  quizzes: {
    basics: quizzesBasics || {
      title: 'Basics Quiz',
      questions: [
        {
          question: 'What command is used to list directory contents?',
          options: ['pwd', 'ls', 'cd', 'mkdir'],
          answer: 1,
        },
        {
          question: 'Which command changes the current directory?',
          options: ['pwd', 'ls', 'cd', 'mkdir'],
          answer: 2,
        },
        {
          question: "What does 'chmod 755 file.sh' do?",
          options: [
            'Deletes the file',
            'Makes the file executable',
            'Renames the file',
            'Moves the file',
          ],
          answer: 1,
        },
        {
          question: 'How do you display the current working directory?',
          options: ['ls', 'pwd', 'cd', 'mkdir'],
          answer: 1,
        },
        {
          question: 'Which command creates a new directory?',
          options: ['touch', 'cp', 'mkdir', 'mv'],
          answer: 2,
        },
      ],
    },
    scripting: quizzesScripting || {
      title: 'Scripting Quiz',
      questions: [
        {
          question: 'How do you define a variable in Bash?',
          options: ['var = value', 'var=value', '$var=value', 'set var value'],
          answer: 1,
        },
        {
          question: 'What is the correct syntax for an if statement?',
          options: [
            'if [ condition ] then',
            'if (condition) {',
            'if condition then',
            'if [condition]; then',
          ],
          answer: 3,
        },
        {
          question: "How do you access a variable's value?",
          options: ['$var', 'var$', '#var', '@var'],
          answer: 0,
        },
        {
          question: 'What does $(( )) do?',
          options: [
            'String concatenation',
            'Arithmetic operations',
            'Array indexing',
            'Function call',
          ],
          answer: 1,
        },
        {
          question: 'How do you make a script executable?',
          options: ['run script.sh', 'chmod +x script.sh', 'execute script.sh', 'bash script.sh'],
          answer: 1,
        },
      ],
    },
  },
};

// CommonJS export (used by Node tests and tooling)
exports.modules = defaultModules;
// Provide module.exports and a default property for bundlers that expect a default export
// (helps ESM bundlers like Rollup/Vite interop when modules.js is required as CJS).
module.exports = defaultModules;
module.exports.modules = defaultModules;
module.exports.default = defaultModules;

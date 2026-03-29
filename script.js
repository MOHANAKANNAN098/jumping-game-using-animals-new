Skip to content
MOHANAKANNAN098
jumping-game-using-animals-new
Repository navigation
Code
Issues
Pull requests
Actions
Projects
Wiki
Security
Insights
Settings
Important update
On April 24 we'll start using GitHub Copilot interaction data for AI model training unless you opt out. Review this update and manage your preferences in your GitHub account settings.
Files
Go to file
t
.github
README.md
index.html
mohan's game project.code-workspace
push_to_github.ps1
script.js
style.css
jumping-game-using-animals-new
/
script.js
in
main

Edit

Preview
Indent mode

Spaces
Indent size

2
Line wrap mode

No wrap
Editing script.js file contents
1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
(() => {
  // Canvas setup
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W = window.innerWidth, H = window.innerHeight;
  canvas.width = W; canvas.height = H;

  // UI refs
  const menu = document.getElementById('menu');
  const startBtn = document.getElementById('startBtn');
  const overlay = document.getElementById('overlay');
  const finalScore = document.getElementById('finalScore');
  const restartBtn = document.getElementById('restartBtn');
  const scoreValue = document.getElementById('scoreValue');
  const hiValue = document.getElementById('hiValue');
  const debugInfo = document.getElementById('debugInfo');
  // name inputs - prefill from localStorage if available
  const nameInput1 = document.getElementById('name1');
  const nameInput2 = document.getElementById('name2');
  try{ nameInput1.value = localStorage.getItem('me_name1') || '' }catch(e){}
  try{ nameInput2.value = localStorage.getItem('me_name2') || '' }catch(e){}

  // Game state
  let mode = 'run';
  let running = false;
  let last = 0;
  let speed = 300; // px/sec base
  let spawnInterval = 1500;
  let spawnTimer = 0;
  let gravity = 1600;
  let score = 0, hi = 0;
  let scoreAccumulator = 0;
  let passedBonus = 5;
  let showDebug = false;

  // animals map -> emoji and sizes
Use Control + Shift + m to toggle the tab key moving focus. Alternatively, use esc then tab to move to the next interactive element on the page.
 

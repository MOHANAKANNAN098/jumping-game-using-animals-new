Monkey Escape – Animal Mode

Simple HTML5 Canvas game (index.html, style.css, script.js).

How to push this project to GitHub (Windows / PowerShell):

1) Install Git for Windows: https://git-scm.com/download/win
2) Open PowerShell and run these commands in the project folder:

```powershell
cd "C:\Users\eniya\Pictures\Screenshots\New folder\mohan's game project"
# initialize and commit
git init
git add index.html style.css script.js
git commit -m "Add Monkey Escape – Animal Mode game"
git branch -M main
# add remote (replace with your repo URL)
git remote add origin <YOUR_GITHUB_REMOTE_URL>
# push
git push -u origin main
```

Or run the included helper script `push_to_github.ps1` and pass the remote URL as an argument:

```powershell
# from the project folder
.\push_to_github.ps1 -RemoteUrl "https://github.com/yourname/yourrepo.git"
```

If you want me to create the remote GitHub repository for you, tell me the desired repo name and whether it should be public or private. I can provide exact browser steps or a `gh` CLI command (requires GitHub CLI and authentication).
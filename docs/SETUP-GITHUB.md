# Putting this site on GitHub (no terminal needed)

You'll end up with:
- a **repository** (the project folder, stored on GitHub): `github.com/YOUR-USERNAME/cfd-portfolio`
- a **live website** that anyone can open: `https://YOUR-USERNAME.github.io/cfd-portfolio/`

It's free and takes about 15 minutes.

---

## Part 1: Make a GitHub account (skip if you have one)

1. Go to **github.com/signup**.
2. Pick a username. It will be in your website address, so something like `jackcrooks` or `jcrooks-cfd` works best.
3. Verify your email, and pick the **Free** plan.

## Part 2: Unzip the files

4. In Finder, double-click **cfd-portfolio.zip**. You'll get a folder named `cfd-portfolio`.
5. Open that folder and press **Cmd + Shift + .** (period). This shows the hidden files `.gitignore` and `.nojekyll`. They should be uploaded too.

## Part 3: Create the repository

6. On GitHub, click the **+** in the top-right corner, then **New repository**.
7. Fill it in:
   - **Repository name:** `cfd-portfolio`
   - **Description:** `CFD projects in OpenFOAM with interactive 3D results`
   - Select **Public**. The free website only works for public repositories.
   - Leave **Add a README** *unchecked*. The zip already has one.
8. Click **Create repository**.

## Part 4: Upload the files

9. On the new, empty repository page, find the line *"…or **uploading an existing file**"* and click that link.
10. In Finder, open the `cfd-portfolio` folder and press **Cmd + A** to select everything inside it.
    Drag all of it into the browser window.
    - Drag the *contents* of the folder, not the folder itself. `index.html` must end up at the top level.
11. Wait until every file is listed. Then, under **Commit changes**, type a message like `First upload`
    and click **Commit changes**.
12. Refresh the page. You should see `assets`, `docs`, `projects`, `index.html` and `README.md` at the top level.

## Part 5: Turn on the website (GitHub Pages)

13. In the repository, click **Settings** (top menu), then **Pages** (left sidebar).
14. Under **Build and deployment → Source**, choose **Deploy from a branch**.
15. Under **Branch**, choose **main** and **/ (root)**, then click **Save**.
16. Wait 1–2 minutes and refresh. A box will show **"Your site is live at https://YOUR-USERNAME.github.io/cfd-portfolio/"**. Click it.
17. Optional but recommended: go back to the repository's main page and click the ⚙️ gear next to **About** on the right.
    Tick **Use your GitHub Pages website** and click **Save**. Now the link shows on your repository page.

## Part 6: Put in your own links

18. In the repository, click `index.html`, then the ✏️ **pencil** icon (top right of the file).
19. Press **Cmd + F** and replace:
    - `YOUR-GITHUB-USERNAME` with your GitHub username (it appears twice)
    - `YOUR-LINKEDIN` with the end of your LinkedIn profile address
20. Click **Commit changes…**, then **Commit changes**. The live site updates within about a minute.
    (If you don't see the change, hard-refresh with **Cmd + Shift + R**.)
21. Do the same in `README.md` to fix the website link at the top.

---

## Updating later: two ways

**A. In the browser (fine for small changes):**
- Edit a file: open it, click ✏️, then commit.
- Add a file (like a new 3D model): open the folder, for example `projects/nascar-truck/models`,
  click **Add file → Upload files**, drag the file in, then commit.

**B. GitHub Desktop (best once you're adding projects regularly):**
1. Download it free from **desktop.github.com** and sign in with your GitHub account.
2. **File → Clone repository**, pick `cfd-portfolio`, and choose a spot such as `Documents/GitHub`.
3. Now the site is a normal folder on your Mac. Edit or add files in Finder or any text editor.
4. Back in GitHub Desktop, your changes are listed. Type a short summary, click **Commit to main**,
   then click **Push origin**. That's it: the website updates.

A good free text editor for the HTML files is **VS Code** (code.visualstudio.com).
Avoid TextEdit, which can silently turn HTML into rich text.

---

## Limits to know

| Thing | Limit | What to do |
|---|---|---|
| Single file uploaded in the browser | 25 MB | Keep 3D models small (Decimate filter in ParaView) |
| Single file at all | 100 MB | Never upload OpenFOAM result folders |
| Whole repository | ~1 GB recommended | Upload case *setup* (`0/`, `constant/`, `system/`), not results |
| Website must be | Public repository (on the free plan) | |

The `.gitignore` file already tells GitHub Desktop to skip OpenFOAM results
(time folders, `processor*`, `polyMesh`, `postProcessing`, logs).

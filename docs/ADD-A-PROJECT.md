# Adding a new project

1. **Copy the template.** Duplicate `projects/project-template` and rename the copy,
   for example `projects/cooling-tower-plume`. Use lowercase letters and dashes, no spaces.
2. **Add the 3D model.** Put your ParaView export in the new project's `models/` folder
   (see `EXPORT-FROM-PARAVIEW.md`). In the new `index.html`, set `data-model="models/your-file.gltf"`.
3. **Fill in the page.** Edit the title, summary, key numbers, setup table, and what you learned.
   Every spot to change is marked with `…` or placeholder text.
4. **Add a card on the home page.** In the top-level `index.html`, copy one of the `<a class="card">` blocks,
   paste it at the **top** of the list (newest project first), and change its link (`projects/your-folder/index.html`), model path, and text.
   - Status badge: `status wip` (In progress), `status done` (Complete), or `status planned` (Planned).
5. **Optional: include the OpenFOAM case.** Make a `case/` folder inside the project with just
   `0/`, `constant/` (without `polyMesh`) and `system/`. That lets people rerun your case.
   Leave results out; the `.gitignore` already skips them.
6. **Upload and commit** (browser or GitHub Desktop; see `SETUP-GITHUB.md`).

## Want a drag calculator on another page?
Copy these two lines into the page:
```html
<div class="drag-calc" data-cd="0.30" data-area="2.2" data-speed="60" data-max="200"></div>
<script type="module" src="../../assets/js/drag-calc.js"></script>
```

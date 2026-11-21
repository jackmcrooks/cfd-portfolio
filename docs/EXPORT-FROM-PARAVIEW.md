# Getting OpenFOAM results onto the website

The 3D viewer reads **glTF** files (`.gltf` or `.glb`), a standard web 3D format.
ParaView can write them directly.

## 1. Surface coloured by pressure (or anything else)

1. Open your case in ParaView (open the `.foam` file in the case folder, or run `paraFoam`).
2. In **Properties → Mesh Regions**, untick `internalMesh` and tick only your wall patches
   (for example `truckBody`, `wheelFront`, `wheelRear`). Click **Apply**.
   Leave **Create cell-to-point filtered data** ticked (the default). The glTF exporter
   only handles *point* data, not cell data.
3. Go to the last time step (the ⏭ button).
4. **Half model?** Use **Filters → Alphabetical → Reflect**, plane = **Y** (or whichever is your
   symmetry plane), to show the whole vehicle.
5. Colour it: pick `p` (or `U`) in the toolbar colour dropdown and choose a colour map.
   - Make sure **Interpolate Scalars Before Coloring** is ticked (Properties panel, Advanced ⚙️).
     That's what carries the colours into the file.
6. Optional, to make the file smaller: **Filters → Extract Surface**, then **Triangulate**, then **Decimate**
   (Target Reduction 0.5–0.8). Aim for a model under ~20 MB.
7. Hide everything you *don't* want in the file (click the 👁 eye icons). Export saves what's visible.
8. **File → Export Scene…**, choose **glTF (\*.gltf)**, and name it `truck.gltf`.
   - In the options box, leave **Inline Data unticked**. Colour maps come through more reliably that way.
   - ParaView may write several files (`truck.gltf` plus `.bin`/`.png` files). **Upload all of them**
     together into the project's `models/` folder.
9. Before uploading, drag `truck.gltf` onto any viewer on your site to check it.

The truck page looks for `models/truck.glb` and then `models/truck.gltf`, so either name works.

### Optional: turn it into one compact `.glb` file
Open **gltf.report** in your browser and drag in all the exported files.
Use **Export → GLB** to get a single, smaller file.

## 2. Streamlines, slices, and iso-surfaces

These export the same way, and they look great in the viewer:
- **Stream Tracer** (seed type: Line, placed in front of the vehicle), then **Tube** so the lines
  have thickness. Colour by `U`.
- **Slice** on the symmetry plane, coloured by velocity.
- **Contour** of Q-criterion to show vortices.

Make them visible along with the body and export the scene. Everything visible goes into one file.

## 3. Things that might look off

| Problem | Fix |
|---|---|
| Model is lying on its side | In the page's HTML, change `data-up="z"` to `data-up="y"` on the viewer |
| Model is grey (no colours) | Tick *Interpolate Scalars Before Coloring*, use point data (step 2), export without Inline Data |
| Some faces look dark or see-through | Normals are flipped. The viewer already draws both sides, so try *Filters → Generate Surface Normals* |
| File too big to upload | Decimate (step 6), or compress with gltf.report |
| Flow arrow points the wrong way | Change `data-flow="+x"` to `data-flow="-x"` (or `none`) |

## 4. Data for charts (Cp plots, residuals, Cd history)

- **Plot Over Line** (for example along the roof centreline), then **File → Save Data → CSV**.
- Put the CSV in the project folder. A chart can read it later; just ask Claude to add one.

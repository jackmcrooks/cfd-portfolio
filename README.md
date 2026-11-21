# CFD Portfolio: Jack Crooks, PE

**Live site → https://YOUR-GITHUB-USERNAME.github.io/cfd-portfolio/**

Computational fluid dynamics projects built in OpenFOAM, with interactive 3D results you can
rotate and zoom in the browser.

| Project | Tools | Status |
|---|---|---|
| [NASCAR Truck External Aero](projects/nascar-truck/) | OpenFOAM, snappyHexMesh, simpleFoam, k-ω SST | In progress |
| [Ahmed Body Validation](projects/ahmed-body/) | OpenFOAM | In progress |

## What's in this repository

```
index.html                 home page
projects/
  nascar-truck/            one folder per project: page + 3D models (+ optional OpenFOAM case)
  ahmed-body/
  project-template/        copy this to start a new project
assets/
  css/style.css            site look and colours
  js/viewer.js             interactive 3D viewer (three.js)
  js/drag-calc.js          interactive drag / power calculator
  js/hero-flow.js          animated potential-flow background on the home page
  vendor/three/            three.js library (MIT licence)
docs/
  SETUP-GITHUB.md          how to publish this site (no terminal needed)
  EXPORT-FROM-PARAVIEW.md  how to get OpenFOAM results into the 3D viewer
  ADD-A-PROJECT.md         how to add a new project page
```

## Credits
3D viewer built with [three.js](https://threejs.org) (MIT licence). Hosted on GitHub Pages.

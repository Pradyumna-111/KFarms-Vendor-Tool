# KFarms Vendor Tool (Electron)

A small Electron-based vendor tool for KFarms to generate reports and manage vendor data.

**Features**
- Simple UI for importing CSVs and exporting reports.
- Packaged Windows build available in `VendorTool-win32-x64/`.
- Uses Electron 28 and `electron-packager` for building distributables.

**Prerequisites**
- Node.js (16+ recommended)
- npm

**Install**

1. Clone the repo and change into the `electron` folder:

   git clone https://github.com/Pradyumna-111/KFarms-Vendor-Tool.git
   cd KFarms-Vendor-Tool/electron

2. Install dependencies:

   npm install

**Run (development)**

Start the app in development mode:

   npm start

**Build (Windows x64)**

Creates a packaged Windows app in the current folder (requires `electron-packager`):

   npm run build

**Notes**
- `node_modules/` and `VendorTool-win32-x64/` are ignored by Git. Large or generated files should not be committed.
- Line endings are normalized with `.gitattributes` to avoid CRLF/LF warnings.

**Files of interest**
- `main.js` — Electron main process entry
- `index.html` — UI
- `preload.js` — Preload script
- `uiHandler.js`, `vendorManager.js`, `reportGenerator.js`, `csvUtils.js` — app logic

**License**
This project uses the ISC license by default (see `package.json`).

**Contributing**
Feel free to open issues or pull requests on GitHub.

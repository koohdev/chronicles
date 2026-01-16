const fs = require("fs");
const path = require("path");

const rootDir = __dirname;
const outputFile = path.join(rootDir, "assets.json");

// Directories to include
const dirsToScan = ["audio", "img", "data", "fonts", "icon", "effects"];
// Specific files to include (besides those in dirs)
const filesToInclude = ["index.html", "js/main.js", "css/game.css"];
// (Note: js folder is complex, might be better to scan it too if we want full offline)

const allFiles = [];

function scanDir(dir) {
  const fullPath = path.join(rootDir, dir);
  if (!fs.existsSync(fullPath)) return;

  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      scanDir(path.join(dir, entry.name));
    } else {
      // Normalize path to forward slashes for URL usage
      const relPath = path.join(dir, entry.name).replace(/\\/g, "/");
      if (!relPath.endsWith(".DS_Store") && !relPath.endsWith("Thumbs.db")) {
        allFiles.push(relPath);
      }
    }
  }
}

// Scan directories
dirsToScan.forEach((d) => scanDir(d));

// Add specific JS files/libs if not already covered?
// Let's just scan the 'js' folder too to be safe/complete
scanDir("js");

// Add root files
fs.readdirSync(rootDir).forEach((file) => {
  if (file.endsWith(".html") || file.endsWith(".json")) {
    if (
      file !== "package.json" &&
      file !== "package-lock.json" &&
      file !== "manifest.json" &&
      file !== "sw.js" &&
      file !== "assets.json"
    ) {
      // Typically we don't need to list index.html in the "bulk download" if it's in the shell,
      // but listing it doesn't hurt (it'll just be quick).
      // Excluding manifest/sw to avoid circular logic or re-cache issues (usually fine though).
    }
  }
});

// Write to file
fs.writeFileSync(outputFile, JSON.stringify(allFiles, null, 2));
console.log(`Generated assets.json with ${allFiles.length} files.`);

const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'index.htm');
const layoutPath = path.join(__dirname, 'appLayout.html');

console.log('Reading index.htm...');
if (!fs.existsSync(srcPath)) {
  console.error('index.htm not found at:', srcPath);
  process.exit(1);
}

const content = fs.readFileSync(srcPath, 'utf8');
const lines = content.split(/\r?\n/);
console.log('Total lines:', lines.length);

// Find the appSection start
let startIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<section id="appSection"')) {
    startIndex = i;
    break;
  }
}

// Find the privacy modal end before translations.js script tag
let endIndex = -1;
for (let i = startIndex; i < lines.length; i++) {
  if (lines[i].includes('translations.js')) {
    for (let j = i - 1; j > startIndex; j--) {
      if (lines[j].trim() === '</div>') {
        endIndex = j;
        break;
      }
    }
    break;
  }
}

if (startIndex === -1 || endIndex === -1) {
  console.error('Failed to locate sections. Start:', startIndex, 'End:', endIndex);
  process.exit(1);
}

console.log('App Section Start line:', startIndex + 1, 'content:', lines[startIndex]);
console.log('App Section End line:', endIndex + 1, 'content:', lines[endIndex]);

// Extract app layout lines
const appLayoutLines = lines.slice(startIndex, endIndex + 1);
fs.writeFileSync(layoutPath, appLayoutLines.join('\n'), 'utf8');
console.log('Wrote appLayout.html successfully. Size:', appLayoutLines.length, 'lines.');

// Replace app layout in index.htm with a placeholder
const beforeLines = lines.slice(0, startIndex);
const afterLines = lines.slice(endIndex + 1);

const newIndexContent = [
  ...beforeLines,
  '    <!-- App layout placeholder loaded dynamically -->',
  '    <div id="appContainer"></div>',
  ...afterLines
].join('\n');

fs.writeFileSync(srcPath, newIndexContent, 'utf8');
console.log('Updated index.htm successfully.');

const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');

const sourceFile = path.join(__dirname, 'logo.png');

const targets = [
  { file: 'favicon-32x32.png', width: 32, height: 32 },
  { file: 'favicon-48x48.png', width: 48, height: 48 },
  { file: 'favicon-96x96.png', width: 96, height: 96 },
  { file: 'favicon-144x144.png', width: 144, height: 144 },
  { file: 'icon-192.png', width: 192, height: 192 },
  { file: 'icon-512.png', width: 512, height: 512 },
  { file: 'favicon.png', width: 512, height: 512 },
  { file: 'favicon.ico', width: 48, height: 48 } // Saving 48x48 png as favicon.ico (most modern browsers support this)
];

async function resizeIcons() {
  try {
    if (!fs.existsSync(sourceFile)) {
      console.error(`Error: Source file logo.png not found at: ${sourceFile}`);
      return;
    }

    console.log(`Loading source image: logo.png (${fs.statSync(sourceFile).size} bytes)`);
    const image = await Jimp.read(sourceFile);

    for (const target of targets) {
      const targetPath = path.join(__dirname, target.file);
      console.log(`Resizing to ${target.width}x${target.height} -> ${target.file}...`);
      
      // Clone the image so we don't resize the resized image
      const resized = image.clone();
      resized.resize({ width: target.width, height: target.height });
      await resized.write(targetPath);
      
      console.log(`  Saved: ${target.file} (${fs.statSync(targetPath).size} bytes)`);
    }

    console.log('✨ All icons successfully resized and optimized!');
  } catch (error) {
    console.error('❌ An error occurred during resizing:', error);
  }
}

resizeIcons();

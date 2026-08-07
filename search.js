const fs = require('fs');
const content = fs.readFileSync('index.htm', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
    if (line.includes('db_backup') || line.includes('backup') || line.includes('نسخة احتياطية') || line.includes('remoteScanner') || line.includes('التسعيرة العامة') || line.includes('remoteScannerModal')) {
        console.log(`${i+1}: ${line.trim()}`);
    }
});

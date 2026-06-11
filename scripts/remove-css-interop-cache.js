const fs = require('fs');
const path = require('path');

const targets = [
  'node_modules/react-native-css-interop/.cache',
  'node_modules/nativewind/node_modules/react-native-css-interop/.cache',
];

for (const t of targets) {
  const full = path.resolve(__dirname, '..', t);
  if (fs.existsSync(full)) {
    fs.rmSync(full, { recursive: true, force: true });
    console.log('Removed', full);
  }
}
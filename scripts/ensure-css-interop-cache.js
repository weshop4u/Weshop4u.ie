import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dirs = [
  'node_modules/react-native-css-interop/.cache',
  'node_modules/nativewind/node_modules/react-native-css-interop/.cache',
];
const files = ['ios.js', 'android.js', 'native.js', 'macos.js', 'windows.js'];
for (const d of dirs) {
  const full = path.resolve(__dirname, '..', d);
  if (!fs.existsSync(path.dirname(full))) continue;
  fs.mkdirSync(full, { recursive: true });
  for (const f of files) {
    const fp = path.join(full, f);
    if (!fs.existsSync(fp)) {
      fs.writeFileSync(fp, '');
      console.log('Created', fp);
    }
  }
}

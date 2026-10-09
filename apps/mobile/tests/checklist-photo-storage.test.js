const fs = require('fs');
const assert = require('assert');

const checklist = fs.readFileSync('www/checklist.html', 'utf8');
const storage = fs.readFileSync('www/photo-storage.js', 'utf8');
const manifest = fs.readFileSync('android/app/src/main/AndroidManifest.xml', 'utf8');
const activity = fs.readFileSync('android/app/src/main/java/br/com/docampo/smartfarm/MainActivity.java', 'utf8');
const plugin = fs.readFileSync('android/app/src/main/java/br/com/docampo/smartfarm/PhotoCapturePlugin.java', 'utf8');
const sql = fs.readFileSync('supabase/setup-v2.sql', 'utf8');

assert(checklist.includes("origem==='galeria'?await plugin.pickPhoto():await plugin.takePhoto()"), 'Câmera e galeria devem chamar métodos nativos distintos.');
assert(checklist.includes('let photoCaptureActive = false'), 'Duplo toque não pode abrir duas capturas concorrentes.');
assert(checklist.includes('await DoCampoDB.flush()'), 'Metadados da foto devem ser confirmados antes de apagar ou substituir o arquivo anterior.');
assert(storage.includes("const DIR = 'docampo/photos'"), 'Fotos devem ficar em arquivos internos, fora do banco textual.');
assert(storage.includes("Object.defineProperty(point, 'foto'"), 'Preview deve ser transitório e não serializado no banco.');
assert(storage.includes("'media-delete-queue-'"), 'Fila de exclusão de fotos deve ser exclusiva por aparelho.');
assert(storage.includes('{ enqueue: false }'), 'Fila técnica local não pode gerar conflito de sincronização.');
assert(manifest.includes('android.permission.CAMERA'), 'Android deve solicitar permissão da câmera.');
assert(activity.includes('registerPlugin(PhotoCapturePlugin.class)'), 'Plugin nativo da câmera deve estar registrado.');
assert(plugin.includes('MAX_DIMENSION = 1080') && plugin.includes('JPEG_QUALITY = 68'), 'Imagem deve ser compactada para evitar pico de memória.');
assert(sql.includes("array['application/pdf', 'image/jpeg']"), 'Bucket privado deve aceitar PDF e JPEG.');
console.log('checklist-photo-storage: ok');

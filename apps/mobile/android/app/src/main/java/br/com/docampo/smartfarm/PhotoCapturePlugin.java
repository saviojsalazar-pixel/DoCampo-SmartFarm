package br.com.docampo.smartfarm;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.UUID;

@CapacitorPlugin(
    name = "PhotoCapture",
    permissions = {@Permission(alias = "camera", strings = {Manifest.permission.CAMERA})}
)
public class PhotoCapturePlugin extends Plugin {
    // 1080 px é mais que suficiente para a foto de 60 x 40 mm no laudo e
    // reduz de forma importante o pico de memória ao inserir várias imagens.
    private static final int MAX_DIMENSION = 1080;
    private static final int JPEG_QUALITY = 68;
    private File pendingFile;

    @PluginMethod
    public void takePhoto(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraPermission");
            return;
        }
        openCamera(call);
    }

    @PluginMethod
    public void pickPhoto(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        startActivityForResult(call, intent, "galleryResult");
    }

    @PermissionCallback
    private void cameraPermission(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) openCamera(call);
        else call.reject("Permissão da câmera negada.");
    }

    private void openCamera(PluginCall call) {
        try {
            pendingFile = File.createTempFile("docampo_camera_", ".jpg", getContext().getCacheDir());
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                pendingFile
            );
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            intent.setClipData(ClipData.newRawUri("Do Campo", uri));
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (intent.resolveActivity(getContext().getPackageManager()) == null) {
                cleanupPending();
                call.reject("Nenhum aplicativo de câmera foi encontrado.");
                return;
            }
            startActivityForResult(call, intent, "cameraResult");
        } catch (Exception error) {
            cleanupPending();
            call.reject("Não foi possível abrir a câmera.", error);
        }
    }

    @ActivityCallback
    private void cameraResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || pendingFile == null || !pendingFile.exists()) {
            cleanupPending();
            call.reject("Captura cancelada.");
            return;
        }
        finishPhoto(call, pendingFile);
    }

    @ActivityCallback
    private void galleryResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.reject("Seleção cancelada.");
            return;
        }
        try {
            pendingFile = File.createTempFile("docampo_galeria_", ".jpg", getContext().getCacheDir());
            try (InputStream input = getContext().getContentResolver().openInputStream(uri);
                 FileOutputStream output = new FileOutputStream(pendingFile)) {
                if (input == null) throw new IllegalStateException("Arquivo selecionado indisponível.");
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            }
            finishPhoto(call, pendingFile);
        } catch (Exception error) {
            cleanupPending();
            call.reject("Não foi possível ler a imagem selecionada.", error);
        }
    }

    private void finishPhoto(PluginCall call, File source) {
        Bitmap bitmap = null;
        Bitmap rotated = null;
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(source.getAbsolutePath(), bounds);
            int sample = 1;
            while (Math.max(bounds.outWidth / sample, bounds.outHeight / sample) > MAX_DIMENSION * 2) sample *= 2;

            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = Math.max(1, sample);
            options.inPreferredConfig = Bitmap.Config.RGB_565;
            bitmap = BitmapFactory.decodeFile(source.getAbsolutePath(), options);
            if (bitmap == null) throw new IllegalStateException("A imagem capturada não pôde ser decodificada.");

            int rotation = readRotation(source);
            if (rotation != 0) {
                Matrix matrix = new Matrix();
                matrix.postRotate(rotation);
                rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, true);
            } else {
                rotated = bitmap;
            }

            int width = rotated.getWidth();
            int height = rotated.getHeight();
            double scale = Math.min(1.0, (double) MAX_DIMENSION / (double) Math.max(width, height));
            Bitmap finalBitmap = rotated;
            if (scale < 1.0) {
                finalBitmap = Bitmap.createScaledBitmap(
                    rotated,
                    Math.max(1, (int) Math.round(width * scale)),
                    Math.max(1, (int) Math.round(height * scale)),
                    true
                );
            }

            String photoId = UUID.randomUUID().toString();
            File directory = new File(getContext().getFilesDir(), "docampo/photos");
            if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("Não foi possível criar a pasta de fotos.");
            File destination = new File(directory, photoId + ".jpg");
            try (FileOutputStream output = new FileOutputStream(destination)) {
                if (!finalBitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, output)) {
                    throw new IllegalStateException("Não foi possível compactar a foto.");
                }
                output.flush();
            }

            JSObject response = new JSObject();
            response.put("photoId", photoId);
            response.put("photoLocalPath", "docampo/photos/" + photoId + ".jpg");
            response.put("photoAbsolutePath", destination.getAbsolutePath());
            response.put("photoRemotePath", "photos/" + photoId + ".jpg");
            response.put("photoMime", "image/jpeg");
            response.put("photoBytes", destination.length());
            response.put("width", finalBitmap.getWidth());
            response.put("height", finalBitmap.getHeight());
            response.put("capturedAt", System.currentTimeMillis());
            call.resolve(response);

            if (finalBitmap != rotated) finalBitmap.recycle();
        } catch (Exception error) {
            call.reject("Não foi possível processar e salvar a foto.", error);
        } finally {
            if (rotated != null && rotated != bitmap && !rotated.isRecycled()) rotated.recycle();
            if (bitmap != null && !bitmap.isRecycled()) bitmap.recycle();
            cleanupPending();
        }
    }

    private int readRotation(File file) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return 0;
        try {
            ExifInterface exif = new ExifInterface(file.getAbsolutePath());
            int orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            if (orientation == ExifInterface.ORIENTATION_ROTATE_90) return 90;
            if (orientation == ExifInterface.ORIENTATION_ROTATE_180) return 180;
            if (orientation == ExifInterface.ORIENTATION_ROTATE_270) return 270;
        } catch (Exception ignored) {}
        return 0;
    }

    private void cleanupPending() {
        if (pendingFile != null && pendingFile.exists()) pendingFile.delete();
        pendingFile = null;
    }
}

package br.com.docampo.smartfarm;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Base64;
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
import java.io.FileInputStream;

@CapacitorPlugin(name="PhotoCapture", permissions={@Permission(alias="camera", strings={Manifest.permission.CAMERA})})
public class PhotoCapturePlugin extends Plugin {
    private File pendingFile;

    @PluginMethod
    public void takePhoto(PluginCall call) {
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            requestPermissionForAlias("camera", call, "cameraPermission");
            return;
        }
        openCamera(call);
    }

    @PermissionCallback
    private void cameraPermission(PluginCall call) {
        if (getPermissionState("camera") == PermissionState.GRANTED) openCamera(call);
        else call.reject("Permissão da câmera negada.");
    }

    private void openCamera(PluginCall call) {
        try {
            pendingFile = File.createTempFile("docampo_foto_", ".jpg", getContext().getCacheDir());
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName()+".fileprovider", pendingFile);
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
            intent.setClipData(ClipData.newRawUri("Do Campo", uri));
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (intent.resolveActivity(getContext().getPackageManager()) == null) { call.reject("Nenhum aplicativo de câmera foi encontrado."); return; }
            startActivityForResult(call, intent, "cameraResult");
        } catch (Exception error) { call.reject("Não foi possível abrir a câmera.", error); }
    }

    @ActivityCallback
    private void cameraResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || pendingFile == null || !pendingFile.exists()) { call.reject("Captura cancelada."); return; }
        try (FileInputStream input = new FileInputStream(pendingFile)) {
            byte[] content = new byte[(int) pendingFile.length()];
            int offset=0,read;while(offset<content.length&&(read=input.read(content,offset,content.length-offset))>0)offset+=read;
            JSObject response = new JSObject();
            response.put("dataUrl", "data:image/jpeg;base64,"+Base64.encodeToString(content, Base64.NO_WRAP));
            call.resolve(response);
        } catch (Exception error) { call.reject("Não foi possível ler a foto capturada.", error); }
        finally { if (pendingFile != null) pendingFile.delete(); pendingFile=null; }
    }
}

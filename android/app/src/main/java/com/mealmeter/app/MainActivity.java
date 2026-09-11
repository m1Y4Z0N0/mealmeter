package com.mealmeter.app;

import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    private WebView webView;
    private int lastTop = -1, lastBottom = -1;

    // WebView 默认不处理网页里的下载（a[download] + blob: URL 会静默无效），
    // 这里补上：拦到 blob: 下载就注入 JS 把内容读成 base64，交给 BlobSaver 落盘。
    private static final String BLOB_FETCH_JS =
            "(function(){var x=new XMLHttpRequest();x.open('GET','__URL__',true);x.responseType='blob';"
            + "x.onload=function(){var r=new FileReader();r.onloadend=function(){"
            + "Android.saveBase64(String(r.result));};r.readAsDataURL(x.response);};x.send();})()";

    // 把系统栏高度写入 CSS 变量，网页用它撑开顶部/底部，
    // 自己的背景色会延伸到状态栏/导航栏底下 —— 深浅模式都无缝。
    // 注意：insets 是物理像素，CSS 用的是密度无关像素，必须除以 density。
    private void pushInsets() {
        if (webView == null || lastTop < 0) return;
        float density = getResources().getDisplayMetrics().density;
        int top = Math.round(lastTop / density);
        int bottom = Math.round(lastBottom / density);
        String js = "try{var d=document.documentElement;"
                + "d.style.setProperty('--sat','" + top + "px');"
                + "d.style.setProperty('--sab','" + bottom + "px');}catch(e){}";
        webView.evaluateJavascript(js, null);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = bridge.getWebView();
        // 显式确保 WebView 的本地存储（IndexedDB/localStorage）已启用且持久化
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        setupDownloadListener();
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.statusBars()
                            | WindowInsetsCompat.Type.displayCutout()
                            | WindowInsetsCompat.Type.navigationBars());
            if (bars.top != lastTop || bars.bottom != lastBottom) {
                lastTop = bars.top;
                lastBottom = bars.bottom;
                pushInsets();
            }
            return insets;
        });
        // insets 分发早于页面加载完成，延迟重放两次保证变量写进已加载的页面
        webView.postDelayed(this::pushInsets, 600);
        webView.postDelayed(this::pushInsets, 1600);
    }

    private void setupDownloadListener() {
        webView.addJavascriptInterface(new BlobSaver(), "Android");
        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            if (url == null || !url.startsWith("blob:")) return;
            final String js = BLOB_FETCH_JS.replace("__URL__", url);
            runOnUiThread(() -> webView.evaluateJavascript(js, null));
        });
    }

    // JS 桥：接收 base64 并写进系统的「下载」文件夹
    private class BlobSaver {
        @JavascriptInterface
        public void saveBase64(String dataUrl) {
            try {
                int comma = dataUrl.indexOf(',');
                byte[] bytes = Base64.decode(
                        comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl, Base64.DEFAULT);
                String stamp = new SimpleDateFormat("yyyyMMdd-HHmm", Locale.US).format(new Date());
                String name = "大胃袋备份-" + stamp + ".json";
                String where = saveToDownloads(bytes, name);
                toast("已保存到 " + where);
            } catch (Exception e) {
                toast("导出失败：" + e.getMessage());
            }
        }
    }

    private String saveToDownloads(byte[] bytes, String name) throws Exception {
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            cv.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
            cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (uri == null) throw new IllegalStateException("无法创建下载文件");
            OutputStream os = getContentResolver().openOutputStream(uri);
            if (os == null) throw new IllegalStateException("无法打开下载文件");
            try {
                os.write(bytes);
            } finally {
                os.close();
            }
            return "下载/" + name;
        }
        // Android 9 及以下：先试公共下载目录，没有存储权限时退回应用专属目录
        try {
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File f = new File(dir, name);
            FileOutputStream fo = new FileOutputStream(f);
            fo.write(bytes);
            fo.close();
            return "下载/" + name;
        } catch (Exception e) {
            File f = new File(getExternalFilesDir(null), name);
            FileOutputStream fo = new FileOutputStream(f);
            fo.write(bytes);
            fo.close();
            return f.getAbsolutePath();
        }
    }

    private void toast(final String msg) {
        runOnUiThread(() -> Toast.makeText(this, msg, Toast.LENGTH_LONG).show());
    }

    @Override
    public void onResume() {
        super.onResume();
        pushInsets();
    }
}

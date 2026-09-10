package com.mealmeter.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private WebView webView;
    private int lastTop = -1, lastBottom = -1;

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

    @Override
    public void onResume() {
        super.onResume();
        pushInsets();
    }
}

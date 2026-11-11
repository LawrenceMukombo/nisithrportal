package pg.gov.nisit.attendance;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.net.http.SslError;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "NISIT_ATTENDANCE";
    private static final int PERMISSION_REQ_CODE = 1001;

    private WebView webView;
    private View splashLayout;
    private NfcAdapter nfcAdapter;
    private PendingIntent nfcPendingIntent;
    private IntentFilter[] nfcIntentFilters;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep tablet screen awake indefinitely for 24/7 lobby and turnstile stations
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Hide title bar and apply immersive fullscreen
        hideSystemBars();

        // Initialize Root FrameLayout
        FrameLayout rootLayout = new FrameLayout(this);
        rootLayout.setBackgroundColor(0xFF0B0305); // Matching NISIT National Crimson/Black theme

        webView = new WebView(this);
        rootLayout.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        // Native Splash Overlay with Official NISIT Logo
        android.widget.LinearLayout splash = new android.widget.LinearLayout(this);
        splash.setOrientation(android.widget.LinearLayout.VERTICAL);
        splash.setGravity(android.view.Gravity.CENTER);
        splash.setBackgroundColor(0xFF0B0305);

        android.widget.ImageView logoView = new android.widget.ImageView(this);
        logoView.setImageResource(R.drawable.nisit_logo);
        int logoSize = (int) (140 * getResources().getDisplayMetrics().density);
        android.widget.LinearLayout.LayoutParams logoParams = new android.widget.LinearLayout.LayoutParams(logoSize, logoSize);
        splash.addView(logoView, logoParams);

        android.widget.TextView titleView = new android.widget.TextView(this);
        titleView.setText("PNG NISIT SMART ATTENDANCE");
        titleView.setTextColor(0xFFFBBF24); // Imperial Gold
        titleView.setTextSize(16);
        titleView.setTypeface(null, android.graphics.Typeface.BOLD);
        titleView.setGravity(android.view.Gravity.CENTER);
        titleView.setPadding(0, 28, 0, 0);
        splash.addView(titleView);

        splashLayout = splash;
        rootLayout.addView(splashLayout, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
        ));

        setContentView(rootLayout);

        // Safety fallback: ensure splash screen automatically fades out within 1.5 seconds on emulators
        splash.postDelayed(() -> {
            if (splashLayout != null && splashLayout.getVisibility() == View.VISIBLE) {
                splashLayout.animate()
                        .alpha(0f)
                        .setDuration(350)
                        .withEndAction(() -> splashLayout.setVisibility(View.GONE))
                        .start();
            }
        }, 1500);

        setupWebView();
        setupNfc();
        checkAndRequestPermissions();

        // Load bundled attendance app locally
        loadKioskApp();
    }

    private void hideSystemBars() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                final WindowInsetsController insetsController = getWindow().getInsetsController();
                if (insetsController != null) {
                    insetsController.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                    insetsController.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                }
            } else {
                getWindow().getDecorView().setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_FULLSCREEN
                );
            }
        } catch (Exception e) {
            Log.w(TAG, "hideSystemBars notice: " + e.getMessage());
        }
    }

    private void setupWebView() {
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " NISIT-Kiosk-Android/1.0");

        webView.setBackgroundColor(0xFF0B0305);

        // Add JavaScript Interface Bridge
        webView.addJavascriptInterface(new KioskJsBridge(), "AndroidKiosk");

        // Custom WebChromeClient for Camera permissions (WebRTC Face ID)
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    // Automatically grant camera and audio access for kiosk biometrics
                    request.grant(request.getResources());
                });
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, "[Web Console] " + consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of " + consoleMessage.sourceId());
                return true;
            }
        });

        // WebViewClient to handle page navigation & offline errors gracefully
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false; // Load inside WebView
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Inject native flag so attendance app knows it is running in native tablet kiosk mode
                webView.evaluateJavascript("window.isAndroidKiosk = true;", null);

                // Smoothly fade out native splash screen
                if (splashLayout != null && splashLayout.getVisibility() == View.VISIBLE) {
                    splashLayout.animate()
                            .alpha(0f)
                            .setDuration(350)
                            .withEndAction(() -> splashLayout.setVisibility(View.GONE))
                            .start();
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                // Allow self-signed or development certificates on test networks/emulators
                handler.proceed();
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                Log.w(TAG, "WebView error: " + error.getDescription());
                if (request != null && request.isForMainFrame()) {
                    // Fall back to local bundled offline kiosk if server cannot be reached
                    view.loadUrl("file:///android_asset/public/index.html");
                }
            }
        });
    }

    private void loadKioskApp() {
        // Load the local bundled kiosk web application directly from assets.
        // This guarantees instant, reliable launch on all Android emulators and offline field tablets.
        webView.loadUrl("file:///android_asset/public/index.html");
    }

    private boolean isNetworkAvailable() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
            if (cm != null) {
                NetworkInfo activeNetwork = cm.getActiveNetworkInfo();
                return activeNetwork != null && activeNetwork.isConnected();
            }
        } catch (Exception e) {
            Log.e(TAG, "Network check error", e);
        }
        return false;
    }

    private void setupNfc() {
        try {
            nfcAdapter = NfcAdapter.getDefaultAdapter(this);
            if (nfcAdapter == null || !nfcAdapter.isEnabled()) {
                Log.i(TAG, "NFC hardware not present or disabled on this device/emulator; RFID input via USB/Bluetooth reader will be used.");
                return;
            }

            Intent intent = new Intent(this, getClass()).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags |= PendingIntent.FLAG_MUTABLE;
            }
            nfcPendingIntent = PendingIntent.getActivity(this, 0, intent, flags);

            IntentFilter techFilter = new IntentFilter(NfcAdapter.ACTION_TECH_DISCOVERED);
            IntentFilter tagFilter = new IntentFilter(NfcAdapter.ACTION_TAG_DISCOVERED);
            IntentFilter ndefFilter = new IntentFilter(NfcAdapter.ACTION_NDEF_DISCOVERED);
            try {
                ndefFilter.addDataType("*/*");
            } catch (IntentFilter.MalformedMimeTypeException e) {
                Log.e(TAG, "Malformed MIME type", e);
            }
            nfcIntentFilters = new IntentFilter[]{techFilter, tagFilter, ndefFilter};
        } catch (Exception e) {
            Log.w(TAG, "NFC setup skipped safely: " + e.getMessage());
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        try {
            hideSystemBars();
        } catch (Exception ignored) {}

        try {
            if (nfcAdapter != null && nfcAdapter.isEnabled() && nfcPendingIntent != null) {
                nfcAdapter.enableForegroundDispatch(this, nfcPendingIntent, nfcIntentFilters, null);
            }
        } catch (Exception e) {
            Log.w(TAG, "enableForegroundDispatch ignored: " + e.getMessage());
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        try {
            if (nfcAdapter != null && nfcAdapter.isEnabled()) {
                nfcAdapter.disableForegroundDispatch(this);
            }
        } catch (Exception e) {
            Log.w(TAG, "disableForegroundDispatch ignored: " + e.getMessage());
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNfcIntent(intent);
    }

    private void handleNfcIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (NfcAdapter.ACTION_TECH_DISCOVERED.equals(action)
                || NfcAdapter.ACTION_TAG_DISCOVERED.equals(action)
                || NfcAdapter.ACTION_NDEF_DISCOVERED.equals(action)) {

            Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
            if (tag != null) {
                byte[] idBytes = tag.getId();
                if (idBytes != null && idBytes.length > 0) {
                    StringBuilder sb = new StringBuilder();
                    for (byte b : idBytes) {
                        sb.append(String.format("%02X", b));
                    }
                    final String cardUid = sb.toString();
                    Log.i(TAG, "NFC Smart Card Scanned: UID=" + cardUid);
                    runOnUiThread(() -> {
                        Toast.makeText(MainActivity.this, "Smart Card Scanned: " + cardUid, Toast.LENGTH_SHORT).show();
                        // Dispatch to web application
                        String js = "if (window.onNfcCardRead) { window.onNfcCardRead('" + cardUid + "'); }";
                        webView.evaluateJavascript(js, null);
                    });
                }
            }
        }
    }

    private void checkAndRequestPermissions() {
        String[] permissions = {
                Manifest.permission.CAMERA,
                Manifest.permission.RECORD_AUDIO
        };

        boolean needRequest = false;
        for (String perm : permissions) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                needRequest = true;
                break;
            }
        }

        if (needRequest) {
            ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQ_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQ_CODE) {
            Log.i(TAG, "Camera & Audio hardware permissions result processed.");
        }
    }

    @Override
    public void onBackPressed() {
        // Prevent accidental closing of Kiosk mode on turnstile tablets
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            Toast.makeText(this, "NISIT Kiosk Mode Active. Use Admin PIN to exit.", Toast.LENGTH_SHORT).show();
        }
    }

    // JavaScript Interface accessible via window.AndroidKiosk
    public class KioskJsBridge {
        @JavascriptInterface
        public String getAppVersion() {
            return "1.0.0";
        }

        @JavascriptInterface
        public String getDeviceModel() {
            return Build.MANUFACTURER + " " + Build.MODEL + " (Android " + Build.VERSION.RELEASE + ")";
        }

        @JavascriptInterface
        public boolean isKioskMode() {
            return true;
        }

        @JavascriptInterface
        public void reloadApp() {
            runOnUiThread(() -> webView.reload());
        }

        @JavascriptInterface
        public void exitKiosk() {
            runOnUiThread(() -> finish());
        }
    }
}


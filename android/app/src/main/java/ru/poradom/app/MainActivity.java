package ru.poradom.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.View;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.getcapacitor.BridgeActivity;
import com.yandex.mobile.ads.banner.BannerAdEventListener;
import com.yandex.mobile.ads.banner.BannerAdSize;
import com.yandex.mobile.ads.banner.BannerAdView;
import com.yandex.mobile.ads.common.AdRequest;
import com.yandex.mobile.ads.common.AdRequestError;
import com.yandex.mobile.ads.common.ImpressionData;
import com.yandex.mobile.ads.common.YandexAds;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "PoraDomAds";

    @Nullable
    private BannerAdView bannerAd;
    @Nullable
    private FrameLayout bannerContainer;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        registerPlugin(ReminderPlugin.class);
        super.onCreate(savedInstanceState);
        dispatchReminderIntent(getIntent());
        refreshWebAssetsIfNeeded();
        bannerContainer = findViewById(R.id.ad_banner_container);
        bannerAd = findViewById(R.id.mediation_banner);
        setNativeBannerVisible(false, "loading");
        final String adUnitId = getString(R.string.yandex_ad_unit_id).trim();
        if (adUnitId.isEmpty()) {
            Log.i(TAG, "Yandex Mobile Ads disabled: release ad unit is not configured");
            if (bannerContainer != null) bannerContainer.setVisibility(View.GONE);
            setNativeBannerVisible(false, "none");
            return;
        }
        // Let the WebView render and present the essential notification
        // permission first. Ads must never delay the first useful screen.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().postDelayed(this::initializeAds, 1_500);
        } else {
            initializeAds();
        }
    }

    private void initializeAds() {
        if (isDestroyed() || bannerAd == null || bannerContainer == null) return;
        Log.i(TAG, "Initializing Yandex Mobile Ads");
        YandexAds.initialize(this, () -> {
            Log.i(TAG, "Yandex Mobile Ads initialization callback");
            runOnUiThread(this::loadBanner);
        });
    }

    private void loadBanner() {
        if (bannerAd == null || bannerContainer == null || isDestroyed()) return;
        final String adUnitId = getString(R.string.yandex_ad_unit_id).trim();
        if (adUnitId.isEmpty()) {
            Log.i(TAG, "Yandex banner disabled: release ad unit is not configured");
            bannerContainer.setVisibility(View.GONE);
            setNativeBannerVisible(false, "none");
            return;
        }
        final DisplayMetrics metrics = getResources().getDisplayMetrics();
        int widthPixels = bannerContainer.getWidth();
        if (widthPixels == 0) widthPixels = metrics.widthPixels;
        final int widthDp = Math.round(widthPixels / metrics.density);
        Log.i(TAG, "Loading Yandex banner at width " + widthDp + "dp");

        bannerAd.setAdSize(BannerAdSize.sticky(this, widthDp));
        bannerAd.setBannerAdEventListener(new BannerAdEventListener() {
            @Override
            public void onAdLoaded() {
                Log.i(TAG, "Yandex banner loaded");
                if (isDestroyed()) {
                    if (bannerAd != null) bannerAd.destroy();
                    return;
                }
                bannerContainer.setVisibility(View.VISIBLE);
                setNativeBannerVisible(true, "mediation");
            }

            @Override
            public void onAdFailedToLoad(@NonNull AdRequestError error) {
                Log.w(TAG, "Yandex banner failed: " + error.getCode() + " / " + error.getDescription());
                bannerContainer.setVisibility(View.GONE);
                setNativeBannerVisible(false, "fallback");
            }

            @Override
            public void onAdClicked() {
                Log.i(TAG, "Yandex banner clicked");
            }

            @Override
            public void onImpression(@Nullable ImpressionData impressionData) {
                Log.i(TAG, "Yandex banner impression recorded");
            }
        });
        bannerAd.loadAd(new AdRequest.Builder(adUnitId).build());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        dispatchReminderIntent(intent);
    }

    private void dispatchReminderIntent(@Nullable Intent intent) {
        if (intent == null || getBridge() == null || getBridge().getWebView() == null) return;
        if (!"ru.poradom.app.OPEN_REMINDER".equals(intent.getAction())) return;
        getBridge().getWebView().postDelayed(() -> getBridge().getWebView().evaluateJavascript(
            "try{localStorage.removeItem('pora-pending-task-id');" +
            "localStorage.setItem('pora-pending-reminder','1');" +
            "window.dispatchEvent(new CustomEvent('pora-reminder-open'));}catch(e){}",
            null
        ), 700);
        intent.setAction(null);
    }

    private void refreshWebAssetsIfNeeded() {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        // Earlier builds cached runtime-config.js. Refresh only pages that
        // actually loaded an old bundle; localStorage and the home plan stay intact.
        Runnable check = () -> {
            if (isDestroyed() || getBridge() == null || getBridge().getWebView() == null) return;
            getBridge().getWebView().evaluateJavascript(
                "(function(){if(document.readyState!=='complete'||window.PORA_DOM_WEB_VERSION==='24')return;" +
                "try{if(sessionStorage.getItem('pora-web-refresh-24'))return;sessionStorage.setItem('pora-web-refresh-24','1')}catch(e){}" +
                "Promise.resolve().then(async function(){" +
                "if(window.caches){var keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('pora-dom-')).map(k=>caches.delete(k)))}" +
                "if(navigator.serviceWorker){var registrations=await navigator.serviceWorker.getRegistrations();await Promise.all(registrations.map(r=>r.unregister()))}" +
                "}).catch(function(){}).then(function(){var url=new URL(location.href);url.searchParams.set('assetv','24');location.replace(url.href)})" +
                "})();",
                null
            );
        };
        getBridge().getWebView().postDelayed(check, 1_500);
        getBridge().getWebView().postDelayed(check, 5_000);
        getBridge().getWebView().postDelayed(check, 10_000);
    }

    private void setNativeBannerVisible(boolean visible, String provider) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        String storageAction = visible
            ? "localStorage.setItem('pora-native-banner-visible','1')"
            : "localStorage.removeItem('pora-native-banner-visible')";
        String quotedProvider = JSONObject.quote(provider == null ? "none" : provider);
        getBridge().getWebView().evaluateJavascript(
            "try{" + storageAction + "}catch(e){};" +
            "try{localStorage.setItem('pora-native-ad-provider'," + quotedProvider + ");}catch(e){};" +
            "document.documentElement.classList.toggle('native-banner-visible', " + visible + ");" +
            "window.dispatchEvent(new CustomEvent('pora-ad-status',{detail:{visible:" + visible + ",provider:" + quotedProvider + "}}))",
            null
        );
    }

    @Override
    public void onDestroy() {
        if (bannerAd != null) bannerAd.destroy();
        bannerAd = null;
        bannerContainer = null;
        super.onDestroy();
    }
}

# ProGuard rules for NISIT Attendance Kiosk
-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}


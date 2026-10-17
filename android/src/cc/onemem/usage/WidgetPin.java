package cc.onemem.usage;

import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.os.*;
import android.widget.RemoteViews;
import org.json.*;
import java.util.concurrent.*;

/** Widget discovery and pinning share the same provider and rendered preview. */
final class WidgetPin {
  static String manualHint(Context c){
    Intent home=new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
    android.content.pm.ResolveInfo launcher=c.getPackageManager().resolveActivity(home,android.content.pm.PackageManager.MATCH_DEFAULT_ONLY);
    String maker=Build.MANUFACTURER.toLowerCase(java.util.Locale.ROOT);
    if(launcher!=null&&launcher.activityInfo!=null&&"com.android.launcher".equals(launcher.activityInfo.packageName)
      &&(maker.contains("oppo")||maker.contains("oneplus")||maker.contains("realme")))
      return "长按桌面空白处 → 卡片 → 插件 → SubWatch。普通 Android 组件在“插件”中，应用内请求可能被桌面拦截。";
    return "长按桌面空白处 → 小组件（或添加组件）→ SubWatch。";
  }
  static JSONObject status(Context c)throws Exception {
    AppWidgetManager m=AppWidgetManager.getInstance(c);
    return new JSONObject().put("supported",m.isRequestPinAppWidgetSupported())
      .put("compact",m.getAppWidgetIds(new ComponentName(c,QuotaWidget.class)).length)
      .put("wide",m.getAppWidgetIds(new ComponentName(c,WideWidget.class)).length)
      .put("manualHint",manualHint(c));
  }
  static void publishPreviews(Context c){
    if(Build.VERSION.SDK_INT<35)return;
    AppWidgetManager m=AppWidgetManager.getInstance(c);
    for(boolean wide:new boolean[]{false,true})try{
      m.setWidgetPreview(new ComponentName(c,wide?WideWidget.class:QuotaWidget.class),AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN,preview(c,wide));
    }catch(Exception ignored){/* Older launchers still have the packaged image/layout. */}
  }
  static RemoteViews preview(Context c,boolean wide)throws Exception {
    RemoteViews views=new RemoteViews(c.getPackageName(),R.layout.quota_widget);
    Store store=new Store(c);
    WidgetTheme.apply(c,views,wide?296:216,wide?110:180,QuotaData.selected(store),0,store.config().optString("theme","light"));
    views.setTextViewText(R.id.status,"");return views;
  }
  static JSONObject request(Activity activity,boolean wide)throws Exception {
    FutureTask<JSONObject> task=new FutureTask<>(()->{
      AppWidgetManager m=AppWidgetManager.getInstance(activity);
      if(!m.isRequestPinAppWidgetSupported())return new JSONObject().put("requested",false).put("message","当前桌面不支持应用内添加，请在桌面的小组件列表中查找 SubWatch");
      Class<?> provider=wide?WideWidget.class:QuotaWidget.class;
      Bundle extras=new Bundle();extras.putParcelable(AppWidgetManager.EXTRA_APPWIDGET_PREVIEW,preview(activity,wide));
      Intent completed=new Intent(activity,WidgetPinnedReceiver.class).setAction("cc.onemem.usage.WIDGET_PINNED");
      PendingIntent callback=PendingIntent.getBroadcast(activity,wide?2:1,completed,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_MUTABLE);
      boolean requested=m.requestPinAppWidget(new ComponentName(activity,provider),extras,callback);
      return new JSONObject().put("requested",requested).put("message",requested?"已请求添加，等待系统确认":"桌面未接受添加请求，请在桌面的小组件列表中查找 SubWatch");
    });
    activity.runOnUiThread(task);return task.get(10,TimeUnit.SECONDS);
  }
}

package cc.onemem.usage;

import android.appwidget.*;
import android.content.*;

public final class WidgetPinnedReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context context,Intent intent){
    int id=intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,-1);
    AppWidgetProviderInfo info=AppWidgetManager.getInstance(context).getAppWidgetInfo(id);
    if(info==null||!context.getPackageName().equals(info.provider.getPackageName()))return;
    QuotaWidget.render(context,id);UpdateService.refreshNow(context);
  }
}

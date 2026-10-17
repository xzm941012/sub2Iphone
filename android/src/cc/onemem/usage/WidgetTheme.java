package cc.onemem.usage;

import android.content.Context;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.widget.RemoteViews;
import org.json.JSONArray;

/** Send both palettes to the launcher so system changes also work while the app is closed. */
final class WidgetTheme {
  static boolean dark(Context c){return (c.getResources().getConfiguration().uiMode&Configuration.UI_MODE_NIGHT_MASK)==Configuration.UI_MODE_NIGHT_YES;}
  static boolean dark(Context c,String theme){return "dark".equals(theme)||("system".equals(theme)&&dark(c));}
  static void text(RemoteViews views,int id,int light,int dark,String theme,Context c){
    if(Build.VERSION.SDK_INT>=31&&"system".equals(theme))views.setColorInt(id,"setTextColor",light,dark);
    else views.setTextColor(id,dark(c,theme)?dark:light);
  }
  static void apply(Context c,RemoteViews views,int width,int height,JSONArray accounts,int tab,String theme)throws Exception{
    boolean system="system".equals(theme),night=dark(c,theme);
    views.setInt(R.id.widget_root,"setBackgroundResource",system?R.drawable.widget_bg:night?R.drawable.widget_bg_dark:R.drawable.widget_bg_light);
    views.setInt(R.id.tab_group,"setBackgroundResource",system?R.drawable.tab_group:night?R.drawable.tab_group_dark:R.drawable.tab_group_light);
    int[] tabs={R.id.tab0,R.id.tab1,R.id.tab2};
    for(int i=0;i<tabs.length;i++){
      views.setInt(tabs[i],"setBackgroundResource",tab==i?R.drawable.tab_active:R.drawable.tab_idle);
      text(views,tabs[i],tab==i?Color.WHITE:0xff333333,tab==i?Color.WHITE:0xffe6e6e8,theme,c);
    }
    text(views,R.id.status,0xff85878b,0xffa2a3a8,theme,c);
    if(Build.VERSION.SDK_INT>=31&&system){
      views.setIcon(R.id.body,"setImageIcon",Icon.createWithBitmap(QuotaWidget.draw(width,height,accounts,tab,false)),Icon.createWithBitmap(QuotaWidget.draw(width,height,accounts,tab,true)));
    }else views.setImageViewBitmap(R.id.body,QuotaWidget.draw(width,height,accounts,tab,night));
  }
}

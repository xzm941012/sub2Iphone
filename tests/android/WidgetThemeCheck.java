package cc.onemem.usage;

import android.app.Activity;
import android.content.Context;
import android.content.res.Configuration;
import android.graphics.*;
import android.graphics.drawable.BitmapDrawable;
import android.os.*;
import android.view.View;
import android.widget.*;
import org.json.*;
import java.io.*;

/** Uses launcher-style RemoteViews inflation, without network access or app-side redraws. */
public class WidgetThemeCheck extends Activity {
  static void require(boolean value,String message){if(!value)throw new AssertionError(message);}
  Context host(boolean dark){Configuration config=new Configuration(getResources().getConfiguration());config.uiMode=(config.uiMode&~Configuration.UI_MODE_NIGHT_MASK)|(dark?Configuration.UI_MODE_NIGHT_YES:Configuration.UI_MODE_NIGHT_NO);return createConfigurationContext(config);}
  Bitmap capture(View root){root.measure(View.MeasureSpec.makeMeasureSpec(728,View.MeasureSpec.EXACTLY),View.MeasureSpec.makeMeasureSpec(440,View.MeasureSpec.EXACTLY));root.layout(0,0,728,440);Bitmap b=Bitmap.createBitmap(728,440,Bitmap.Config.ARGB_8888);root.draw(new Canvas(b));return b;}
  void check(RemoteViews views,Context host,JSONArray accounts,int tab,boolean dark,String name)throws Exception{
    // Parceling matches the cross-process transfer from the provider to the launcher.
    Parcel parcel=Parcel.obtain();views.writeToParcel(parcel,0);parcel.setDataPosition(0);RemoteViews received=RemoteViews.CREATOR.createFromParcel(parcel);parcel.recycle();
    View root=received.apply(host,null);Bitmap image=capture(root);
    require(image.getPixel(364,12)==(dark?0xff242529:Color.WHITE),name+" background");
    require(((TextView)root.findViewById(R.id.tab0)).getCurrentTextColor()==(tab==0?Color.WHITE:dark?0xffe6e6e8:0xff333333),name+" tabs");
    Bitmap body=((BitmapDrawable)((ImageView)root.findViewById(R.id.body)).getDrawable()).getBitmap();
    require(body.sameAs(QuotaWidget.draw(340,150,accounts,tab,dark)),name+" ring/text bitmap");
    try(FileOutputStream file=new FileOutputStream(new File(getExternalFilesDir(null),name+".png"))){image.compress(Bitmap.CompressFormat.PNG,100,file);}
  }
  @Override public void onCreate(Bundle state){super.onCreate(state);try{
    JSONArray accounts=new JSONArray();for(int i=0;i<8;i++){
      JSONObject period=new JSONObject().put("used",i*15).put("cost",9.23).put("estimated",11.26).put("tokens",41000000);
      accounts.put(new JSONObject().put("name","Account "+(i+1)).put("five",period).put("seven",new JSONObject(period.toString()).put("used",84)));
    }
    for(int tab=0;tab<3;tab++)for(String theme:new String[]{"system","light","dark"}){
      RemoteViews views=new RemoteViews(getPackageName(),R.layout.quota_widget);
      WidgetTheme.apply(host(false),views,340,150,accounts,tab,theme);
      // The exact same payload must support light -> dark -> light; no provider/network update.
      for(boolean night:new boolean[]{false,true,false})check(views,host(night),accounts,tab,"dark".equals(theme)||("system".equals(theme)&&night),"theme-"+theme+"-"+tab+"-"+(night?"night":"day"));
    }
    android.util.Log.i("SubWatchWidgetQA","THEME PASS: "+getIntent().getStringExtra("run")+" system light/dark/light with unchanged RemoteViews, explicit overrides, all tabs, 8-account cap");
  }catch(Throwable e){android.util.Log.e("SubWatchWidgetQA","THEME FAIL",e);}}
}

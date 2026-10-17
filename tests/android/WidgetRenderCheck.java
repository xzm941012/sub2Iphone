package cc.onemem.usage;

import android.app.Activity;
import android.graphics.*;
import android.os.*;
import android.view.*;
import android.widget.*;
import org.json.*;
import java.io.*;

/** Emulator-only rendering checks. No network permission or real connection data. */
public class WidgetRenderCheck extends Activity {
  final Handler handler=new Handler(Looper.getMainLooper());
  void require(boolean ok,String message){if(!ok)throw new AssertionError(message);}
  void save(Bitmap bitmap,String name)throws Exception{try(FileOutputStream out=new FileOutputStream(new File(getExternalFilesDir(null),name+".png"))){bitmap.compress(Bitmap.CompressFormat.PNG,100,out);}}
  Bitmap capture(View view){Bitmap result=Bitmap.createBitmap(view.getWidth(),view.getHeight(),Bitmap.Config.ARGB_8888);view.draw(new Canvas(result));return result;}
  void failed(Throwable e){android.util.Log.e("SubWatchWidgetQA","FAIL",e);}
  @Override public void onCreate(Bundle state){super.onCreate(state);try{
    JSONArray all=new JSONArray(),firstFive=new JSONArray();String reset=java.time.Instant.now().plusSeconds(3600).toString();
    for(int i=0;i<8;i++){
      JSONObject five=new JSONObject().put("used",i*15).put("reset",reset).put("cost",9.23).put("estimated",11.26).put("tokens",41000000);
      JSONObject seven=new JSONObject(five.toString()).put("used",84).put("reset",java.time.Instant.now().plusSeconds(350000).toString());
      JSONObject account=new JSONObject().put("name","Account "+(i+1)).put("five",five).put("seven",seven);all.put(account);if(i<5)firstFive.put(account);
    }
    for(int count:new int[]{1,3,5,8}){
      JSONArray accounts=new JSONArray();for(int i=0;i<count;i++)accounts.put(all.get(i));
      for(int tab=0;tab<3;tab++){
        Bitmap b=QuotaWidget.draw(340,150,accounts,tab);int size=Math.round(Math.min(142,340*.45f));
        require(Color.alpha(b.getPixel(size,150))==0,"Ring center must be empty");save(b,"widget-"+count+"-"+tab);
      }
    }
    require(QuotaWidget.draw(340,150,all,1).sameAs(QuotaWidget.draw(340,150,firstFive,1)),"Only the first five accounts may be drawn");
    RemoteViews views=new RemoteViews(getPackageName(),R.layout.quota_widget);views.setImageViewBitmap(R.id.body,QuotaWidget.draw(340,150,all,0));views.setTextViewText(R.id.status,"SubWatch widget render QA");
    QuotaWidget.refreshViews(views,false);View root=views.apply(this,null);
    require(root.findViewById(R.id.refresh).getVisibility()==View.VISIBLE,"Idle refresh arrow missing");
    require(root.findViewById(R.id.refresh_spinner).getVisibility()==View.GONE,"Idle spinner must stop");
    QuotaWidget.refreshViews(views,true);views.reapply(this,root);
    require(root.findViewById(R.id.refresh_spinner).getVisibility()==View.VISIBLE,"Busy spinner missing");
    FrameLayout container=new FrameLayout(this);container.setBackgroundColor(Color.WHITE);container.addView(root,new FrameLayout.LayoutParams(Math.round(364*getResources().getDisplayMetrics().density),Math.round(220*getResources().getDisplayMetrics().density)));setContentView(container);
    handler.postDelayed(()->{try{
      Bitmap before=capture(root);save(before,"widget-refresh-frame1");
      handler.postDelayed(()->{try{
        Bitmap after=capture(root);save(after,"widget-refresh-frame2");require(!before.sameAs(after),"Refresh arrow must actually rotate across frames");
        QuotaWidget.refreshViews(views,false);views.reapply(this,root);require(root.findViewById(R.id.refresh_spinner).getVisibility()==View.GONE,"Spinner must stop after refresh");
        handler.postDelayed(()->{try{
          save(capture(root),"widget-native-overview");
          views.setImageViewBitmap(R.id.body,QuotaWidget.draw(340,150,all,1));views.setInt(R.id.tab0,"setBackgroundResource",R.drawable.tab_idle);views.setTextColor(R.id.tab0,0xff333333);views.setInt(R.id.tab1,"setBackgroundResource",R.drawable.tab_active);views.setTextColor(R.id.tab1,Color.WHITE);views.reapply(this,root);
          handler.postDelayed(()->{try{save(capture(root),"widget-native-five");android.util.Log.i("SubWatchWidgetQA","PASS: "+getIntent().getStringExtra("run")+" 1/3/5/8 accounts, empty centers, first-five cap, RemoteViews tabs, animated refresh and idle restore");}catch(Throwable e){failed(e);}},100);
        }catch(Throwable e){failed(e);}},100);
      }catch(Throwable e){failed(e);}},420);
    }catch(Throwable e){failed(e);}},400);
  }catch(Throwable e){failed(e);}}
}

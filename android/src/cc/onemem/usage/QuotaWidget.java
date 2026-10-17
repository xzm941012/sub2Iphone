package cc.onemem.usage;
import android.app.*;
import android.appwidget.*;
import android.content.*;
import android.graphics.*;
import android.os.*;
import android.widget.RemoteViews;
import org.json.*;
import java.util.*;
import java.util.concurrent.*;

public class QuotaWidget extends AppWidgetProvider {

  public static final String ACTION="cc.onemem.usage.WIDGET_ACTION";
  static int quotaColor(double used){return !Double.isFinite(used)?0xff92969e:used<50?0xff389e0d:used<80?0xffd48806:0xffcf1322;}
  @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){for(int id:ids)render(context,id);UpdateService.schedule(context);UpdateService.refreshNow(context);}
  @Override public void onAppWidgetOptionsChanged(Context c,AppWidgetManager m,int id,Bundle options){render(c,id);}
  @Override public void onReceive(Context c,Intent intent){super.onReceive(c,intent);if(ACTION.equals(intent.getAction())){int id=intent.getIntExtra("id",-1);int tab=intent.getIntExtra("tab",-1);if(id<0)return;int[] registered=AppWidgetManager.getInstance(c).getAppWidgetIds(new ComponentName(c,getClass()));boolean owned=false;for(int candidate:registered)if(candidate==id)owned=true;if(!owned)return;if(tab>=0&&tab<=2){new Store(c).tab(id,tab);render(c,id);}else{UpdateService.refreshNow(c);}}}
  public static void updateAll(Context c){AppWidgetManager m=AppWidgetManager.getInstance(c);for(Class<?> cls:new Class[]{QuotaWidget.class,WideWidget.class})for(int id:m.getAppWidgetIds(new ComponentName(c,cls)))render(c,id);}
  private static PendingIntent action(Context c,int id,int tab,Class<?> provider){Intent i=new Intent(c,provider).setAction(ACTION).putExtra("id",id).putExtra("tab",tab).setData(android.net.Uri.parse("usage://widget/"+id+"/"+tab));return PendingIntent.getBroadcast(c,id*10+tab+1,i,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
  static void refreshViews(RemoteViews views,boolean busy){
    views.setViewVisibility(R.id.refresh,busy?android.view.View.GONE:android.view.View.VISIBLE);
    views.setViewVisibility(R.id.refresh_spinner,busy?android.view.View.VISIBLE:android.view.View.GONE);
  }
  public static void render(Context c,int id){try{
    AppWidgetManager manager=AppWidgetManager.getInstance(c);AppWidgetProviderInfo info=manager.getAppWidgetInfo(id);if(info==null)return;
    Store store=new Store(c);int tab=store.tab(id);Bundle options=manager.getAppWidgetOptions(id);boolean wide=info.provider.getClassName().endsWith("WideWidget");
    int width=Math.max(160,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,wide?300:230));
    int height=Math.max(110,options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,wide?145:230));
    RemoteViews v=new RemoteViews(c.getPackageName(),R.layout.quota_widget);int[] tabs={R.id.tab0,R.id.tab1,R.id.tab2};
    Class<?> provider=Class.forName(info.provider.getClassName());
    for(int i=0;i<3;i++){
      v.setInt(tabs[i],"setBackgroundResource",tab==i?R.drawable.tab_active:R.drawable.tab_idle);
      v.setTextColor(tabs[i],tab==i?Color.WHITE:0xff333333);v.setOnClickPendingIntent(tabs[i],action(c,id,i,provider));
    }
    boolean busy=UpdateService.refreshing();refreshViews(v,busy);
    v.setOnClickPendingIntent(R.id.refresh,action(c,id,-1,provider));
    PendingIntent launch=PendingIntent.getActivity(c,id,new Intent(c,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    v.setOnClickPendingIntent(R.id.body,launch);JSONArray accounts=QuotaData.selected(store);
    v.setImageViewBitmap(R.id.body,draw(width-24,height-66,accounts,tab));
    JSONObject cfg=store.config();Object cached=store.cache("quota:"+cfg.optString("selected")+":"+cfg.optString("groupId"));
    String status="打开 SubWatch 完成连接";
    if(cached instanceof JSONObject){
      long stamp=((JSONObject)cached).optLong("updated");status=new java.text.SimpleDateFormat("HH:mm",Locale.CHINA).format(new Date(stamp))+" 更新 · 已用 / 估算总额";
      Object err=store.cache("backgroundError");if(err!=JSONObject.NULL||((JSONObject)cached).optBoolean("partial"))status="刷新失败 · "+status;
    }
    if(busy)status="刷新中 · "+status;
    if(tab!=0&&accounts.length()>5)status+=" · 前5/"+accounts.length()+"账户";
    v.setTextViewText(R.id.status,status);manager.updateAppWidget(id,v);
  }catch(Exception ignored){/* Keep last usable RemoteViews during launcher races. */}}
  static Bitmap draw(int width,int height,JSONArray accounts,int tab)throws Exception{
    width=Math.max(120,width);height=Math.max(24,height);
    Bitmap bitmap=Bitmap.createBitmap(width*2,height*2,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(bitmap);canvas.scale(2,2);
    Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);float size=Math.min(height-8,width*.45f),cx=size/2,cy=height/2f;
    ArrayList<JSONObject> periods=new ArrayList<>();ArrayList<String> names=new ArrayList<>();
    if(tab==0){periods.add(QuotaData.aggregate(accounts,"five"));periods.add(QuotaData.aggregate(accounts,"seven"));names.add("5h");names.add("7d");}
    else for(int i=0;i<Math.min(5,accounts.length());i++){periods.add(accounts.getJSONObject(i).getJSONObject(tab==1?"five":"seven"));names.add(accounts.getJSONObject(i).optString("name"));}
    int count=periods.size();float gap=size*7/480,outer=size/2-3,stroke=Math.min(outer*.28f,(outer*.78f-gap*Math.max(0,count-1))/Math.max(1,count));
    for(int i=0;i<count;i++){
      float radius=outer-stroke/2-i*(stroke+gap);RectF oval=new RectF(cx-radius,cy-radius,cx+radius,cy+radius);
      p.setStyle(Paint.Style.STROKE);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeWidth(stroke);p.setColor(0xffeeebe8);canvas.drawArc(oval,0,360,false,p);
      double used=periods.get(i).optDouble("used",Double.NaN);
      if(Double.isFinite(used)&&used>0){p.setColor(quotaColor(used));canvas.drawArc(oval,-90,(float)(Math.max(0,Math.min(100,used))*3.6),false,p);if(used>=100)drawOverlap(canvas,p,cx,cy,radius,stroke,quotaColor(used));}
    }
    p.setStyle(Paint.Style.FILL);p.setStrokeWidth(0);p.setTextAlign(Paint.Align.LEFT);p.setTypeface(Typeface.create("sans-serif",Typeface.NORMAL));
    float left=size+8,right=width-2,row=height/(float)Math.max(1,count),font=Math.max(6,Math.min(12,row/2.75f));
    for(int i=0;i<count;i++){
      JSONObject period=periods.get(i);float top=i*row+Math.max(0,(row-font*2.7f)/2);String name=names.get(i);double used=period.optDouble("used",Double.NaN);
      p.setColor(quotaColor(used));canvas.drawCircle(left+2,top+font-2,Math.min(2,font*.18f),p);p.setTextSize(font);
      String percentage=Double.isFinite(used)?Math.round(Math.max(0,Math.min(100,used)))+"%":"—";
      float nameRoom=right-left-p.measureText(percentage)-14;p.setColor(0xff555555);
      name=android.text.TextUtils.ellipsize(name,new android.text.TextPaint(p),Math.max(0,nameRoom),android.text.TextUtils.TruncateAt.END).toString();
      canvas.drawText(name,left+8,top+font,p);
      if(tab==0){
        float timeLeft=left+8+p.measureText(name)+6;p.setTextSize(font*.9f);String time=timer(period.optString("reset"));
        fitText(p,time,right-p.measureText(percentage)-8-timeLeft);p.setColor(0xff85878b);canvas.drawText(time,timeLeft,top+font,p);
      }
      p.setTextSize(font);p.setTextAlign(Paint.Align.RIGHT);p.setColor(quotaColor(used));canvas.drawText(percentage,right,top+font,p);p.setTextAlign(Paint.Align.LEFT);
      float y=top+font*2.5f;String amount=dollars(period.optDouble("cost",Double.NaN))+" / "+dollars(period.optDouble("estimated",Double.NaN));
      p.setTextSize(font*.82f);p.setColor(0xff555555);
      String trailing=tab==0?amount:timer(period.optString("reset"));String leading=tab==0?number(period.optDouble("tokens",Double.NaN))+" Token":amount;
      float room=right-left;fitText(p,trailing,room*(tab==0?.61f:.35f));float trailingWidth=p.measureText(trailing);
      p.setTextAlign(Paint.Align.RIGHT);canvas.drawText(trailing,right,y,p);p.setTextAlign(Paint.Align.LEFT);
      p.setTextSize(font*.85f);fitText(p,leading,room-trailingWidth-5);canvas.drawText(leading,left,y,p);
      if(i+1<count){p.setColor(0xffe9ebef);p.setStrokeWidth(.5f);canvas.drawLine(left,(i+1)*row,right,(i+1)*row,p);}
    }
    if(count==0){p.setTextSize(11);p.setColor(0xff888888);canvas.drawText("暂无额度数据",left,height/2f,p);}
    return bitmap;
  }
  static void drawOverlap(Canvas canvas,Paint p,float cx,float cy,float radius,float stroke,int color){
    Path ring=new Path();ring.addCircle(cx,cy,radius+stroke/2,Path.Direction.CW);ring.addCircle(cx,cy,radius-stroke/2,Path.Direction.CCW);
    canvas.save();canvas.clipPath(ring);p.setStyle(Paint.Style.FILL);p.setColor(color);p.setShadowLayer(stroke*.14f,stroke*.08f,stroke*.08f,0x50000000);canvas.drawCircle(cx,cy-radius,stroke/2,p);p.clearShadowLayer();canvas.restore();p.setStyle(Paint.Style.STROKE);
  }
  static void fitText(Paint p,String text,float width){while(p.measureText(text)>width&&p.getTextSize()>6)p.setTextSize(p.getTextSize()-.25f);}
  static String number(double n){if(!Double.isFinite(n))return "—";if(n>=1e9)return String.format(Locale.US,"%.1fB",n/1e9);if(n>=1e6)return String.format(Locale.US,"%.1fM",n/1e6);if(n>=1e3)return String.format(Locale.US,"%.1fK",n/1e3);return String.format(Locale.US,"%.0f",n);}
  static String dollars(double n){return Double.isFinite(n)?String.format(Locale.US,"$%.2f",n):"—";}
  static String timer(String reset){long stamp=QuotaData.parseTime(reset);if(stamp==0)return "—";long minutes=Math.max(0,(long)Math.ceil((stamp-System.currentTimeMillis())/60000.0));if(minutes>=1440)return minutes/1440+"d"+minutes%1440/60+"h";return String.format(Locale.US,"%02d:%02d",minutes/60,minutes%60);}
}

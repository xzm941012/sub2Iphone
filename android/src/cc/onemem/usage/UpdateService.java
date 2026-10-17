package cc.onemem.usage;
import android.app.job.*;
import android.content.*;
import android.os.*;
import java.util.concurrent.*;
public class UpdateService extends JobService {
  private final ConcurrentHashMap<Integer,Future<?>> jobs=new ConcurrentHashMap<>();private final ExecutorService worker=Executors.newSingleThreadExecutor();
  private static final ConcurrentHashMap<Integer,JobParameters> running=new ConcurrentHashMap<>();
  private static volatile long pendingSince;
  static boolean refreshing(){return pendingSince!=0||!running.isEmpty();}
  public static void schedule(Context c){try{int minutes=new Store(c).config().optInt("interval",15);JobScheduler scheduler=c.getSystemService(JobScheduler.class);JobInfo old=scheduler.getPendingJob(7810);long interval=Math.max(15,minutes)*60000L;if(old!=null&&old.getIntervalMillis()==interval)return;scheduler.schedule(new JobInfo.Builder(7810,new ComponentName(c,UpdateService.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(interval).setPersisted(true).build());}catch(Exception ignored){}}
  public static synchronized void refreshNow(Context c){
    if(refreshing())return;Context app=c.getApplicationContext();long request=SystemClock.elapsedRealtime();pendingSince=request;QuotaWidget.updateAll(app);
    try{int result=c.getSystemService(JobScheduler.class).schedule(new JobInfo.Builder(7811,new ComponentName(c,UpdateService.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setOverrideDeadline(0).build());if(result!=JobScheduler.RESULT_SUCCESS){pendingSince=0;QuotaWidget.updateAll(app);}}
    catch(Exception e){pendingSince=0;QuotaWidget.updateAll(app);}
    // A queued job may wait for connectivity. Do not leave the launcher spinning forever.
    new Handler(Looper.getMainLooper()).postDelayed(()->{if(pendingSince==request){pendingSince=0;QuotaWidget.updateAll(app);}},30000);
  }
  @Override public boolean onStartJob(JobParameters params){int id=params.getJobId();running.put(id,params);pendingSince=0;QuotaWidget.updateAll(this);jobs.put(id,worker.submit(()->{boolean retry=false;try{QuotaData.refresh(new Store(this));}catch(Exception e){new Store(this).cache("backgroundError","\"刷新失败，保留缓存\"");retry=true;}finally{if(running.remove(id,params))jobs.remove(id);QuotaWidget.updateAll(this);jobFinished(params,retry);}}));return true;}
  @Override public boolean onStopJob(JobParameters params){int id=params.getJobId();Future<?> task=jobs.remove(id);if(task!=null)task.cancel(true);running.remove(id,params);pendingSince=0;QuotaWidget.updateAll(this);return true;}
  @Override public void onDestroy(){for(int id:jobs.keySet())running.remove(id);jobs.clear();pendingSince=0;worker.shutdownNow();QuotaWidget.updateAll(this);super.onDestroy();}
}

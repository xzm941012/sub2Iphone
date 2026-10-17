package cc.onemem.usage;
import android.content.*;
public class BootReceiver extends BroadcastReceiver { @Override public void onReceive(Context c,Intent i){UpdateService.schedule(c);QuotaWidget.updateAll(c);} }

package cc.onemem.usage;

import android.app.Application;
import android.content.res.Configuration;

public class SubWatchApplication extends Application {
  @Override public void onConfigurationChanged(Configuration configuration){
    super.onConfigurationChanged(configuration);
    // Repaint cached data only; changing appearance must not start a network refresh.
    QuotaWidget.updateAll(this);
  }
}

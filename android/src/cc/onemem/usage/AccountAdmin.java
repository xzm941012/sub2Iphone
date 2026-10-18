package cc.onemem.usage;
import org.json.*;
import java.util.*;
public final class AccountAdmin {
  private static final String MODE="openai_oauth_responses_websockets_v2_mode",ENABLED="openai_oauth_responses_websockets_v2_enabled";
  private static final Set<String> MODES=new HashSet<>(Arrays.asList("off","ctx_pool","passthrough","http_bridge"));
  private static JSONObject view(JSONObject a)throws Exception{
    if(!"openai".equals(a.optString("platform"))||!Arrays.asList("oauth","setup-token").contains(a.optString("type")))throw new Exception("仅支持 OpenAI OAuth 账户");
    JSONObject e=a.optJSONObject("extra");if(e==null)e=new JSONObject();String mode=e.optString(MODE);
    if("shared".equals(mode)||"dedicated".equals(mode))mode="ctx_pool";
    if(!MODES.contains(mode)){mode="off";for(String k:Arrays.asList(ENABLED,"responses_websockets_v2_enabled","openai_ws_enabled"))if(e.opt(k) instanceof Boolean){mode=e.optBoolean(k)?"ctx_pool":"off";break;}}
    return new JSONObject().put("id",a.getInt("id")).put("name",a.optString("name")).put("platform",a.optString("platform")).put("type",a.optString("type")).put("proxyId",a.optInt("proxy_id",0)).put("wsMode",mode).put("schedulable",a.optBoolean("schedulable",true));
  }
  public static Object execute(Api api,String op,JSONObject p)throws Exception{
    if("accountProxies".equals(op)){JSONArray raw=(JSONArray)api.get("/admin/proxies/all"),result=new JSONArray();for(int i=0;i<raw.length();i++){JSONObject x=raw.getJSONObject(i);result.put(new JSONObject().put("id",x.getInt("id")).put("name",x.optString("name")).put("protocol",x.optString("protocol")).put("status",x.optString("status")));}return result;}
    int id=p.getInt("accountId");if(id<=0)throw new Exception("无效账户");
    if("resetAccountStatus".equals(op)){
      if(!Boolean.TRUE.equals(p.opt("confirmed")))throw new Exception("请先确认重置账号状态");
      view((JSONObject)api.rawAccount(id));
      try{
        JSONObject a=(JSONObject)api.clearAccountError(id);
        if(a.optInt("id")!=id||!(a.opt("status") instanceof String))throw new Exception("无效账号状态");
        JSONObject result=new JSONObject().put("id",id).put("name",a.optString("name")).put("schedulable",a.optBoolean("schedulable",true));
        for(String key:Arrays.asList("status","error_message","rate_limit_reset_at","overload_until","temp_unschedulable_until","temp_unschedulable_reason","quota_used","quota_limit","quota_daily_used","quota_daily_limit","quota_weekly_used","quota_weekly_limit")){
          Object value=a.opt(key);if(value==JSONObject.NULL||value instanceof String||value instanceof Number)result.put(key,value);
        }
        return result;
      }catch(Exception e){throw new Exception("未确认状态重置结果，请核实账号最新状态；不会自动重试");}
    }
    if("accountSettings".equals(op))return view((JSONObject)api.rawAccount(id));
    if(!"saveAccountSettings".equals(op))throw new Exception("不支持的账户操作");
    JSONObject c=p.getJSONObject("changes");if(c.length()==0)throw new Exception("无效账户设置");Iterator<String> keys=c.keys();while(keys.hasNext())if(!Arrays.asList("proxyId","wsMode","schedulable").contains(keys.next()))throw new Exception("无效账户设置");
    if(c.has("proxyId")&&(!(c.get("proxyId") instanceof Number)||c.getDouble("proxyId")!=c.getInt("proxyId")||c.getInt("proxyId")<0))throw new Exception("无效代理");
    if(c.has("wsMode")&&!MODES.contains(c.getString("wsMode")))throw new Exception("无效 WS mode");
    if(c.has("schedulable")&&!(c.get("schedulable") instanceof Boolean))throw new Exception("无效调度状态");
    JSONObject current=(JSONObject)api.rawAccount(id);view(current);JSONObject patch=new JSONObject();
    if(c.has("proxyId"))patch.put("proxy_id",c.getInt("proxyId"));
    if(c.has("wsMode")){JSONObject extra=current.optJSONObject("extra");if(extra==null)extra=new JSONObject();String mode=c.getString("wsMode");extra.put(MODE,mode).put(ENABLED,!"off".equals(mode));extra.remove("responses_websockets_v2_enabled");extra.remove("openai_ws_enabled");patch.put("extra",extra);}
    try{if(patch.length()>0)api.updateAccount(id,patch);if(c.has("schedulable"))api.scheduleAccount(id,c.getBoolean("schedulable"));return view((JSONObject)api.rawAccount(id));}catch(Exception e){throw new Exception("保存未全部确认，请重新读取账户状态后核实；不会自动重试");}
  }
}

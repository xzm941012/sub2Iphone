package cc.onemem.usage;
import org.json.*;
import java.util.*;
public final class QuotaData {
  public static JSONObject period(JSONObject raw,JSONObject extra,String prefix)throws Exception{if(raw==null)raw=new JSONObject();if(extra==null)extra=new JSONObject();JSONObject p=new JSONObject();Object used=first(raw,"utilization","used_percent","percentage");if(used==JSONObject.NULL)used=extra.opt(prefix+"_used_percent");p.put("used",used==null?JSONObject.NULL:used);Object reset=first(raw,"resets_at","reset_at","reset_time");if(reset==JSONObject.NULL)reset=extra.opt(prefix+"_reset_at");p.put("reset",reset==null?JSONObject.NULL:reset);JSONObject w=raw.optJSONObject("window_stats");Object cost=w==null?JSONObject.NULL:first(w,"cost","account_cost","standard_cost");p.put("cost",cost);p.put("tokens",w==null?JSONObject.NULL:first(w,"tokens"));double u=p.optDouble("used",Double.NaN),c=p.optDouble("cost",Double.NaN);p.put("estimated",u>0&&Double.isFinite(c)?c*100/u:JSONObject.NULL);return p;}
  private static Object first(JSONObject o,String... keys){for(String k:keys)if(o.has(k)&&!o.isNull(k))return o.opt(k);return JSONObject.NULL;}
  public static JSONObject refresh(Store store)throws Exception{JSONObject config=store.config();Api api=new Api(store,store.connection());String group=config.optString("groupId"),selected=config.optString("selected"),cacheKey="quota:"+selected+":"+group;Object old=store.cache(cacheKey);JSONArray previous=old instanceof JSONObject?((JSONObject)old).optJSONArray("accounts"):null;
    ArrayList<JSONObject> found=new ArrayList<>();int page=1;while(true){JSONObject list=(JSONObject)api.get("/admin/accounts?page="+page+"&page_size=200&platform=openai&type=oauth&sort_by=name&sort_order=asc&group="+java.net.URLEncoder.encode(group,"UTF-8"));JSONArray rows=list.getJSONArray("items");for(int i=0;i<rows.length();i++)found.add(rows.getJSONObject(i));if(rows.length()<200||found.size()>=list.optInt("total",Integer.MAX_VALUE))break;page++;}
    found.sort(Comparator.comparingInt(a->a.optInt("id")));JSONArray result=new JSONArray();boolean partial=false;
    for(JSONObject a:found){int id=a.getInt("id");try{JSONObject u=(JSONObject)api.get("/admin/accounts/"+id+"/usage");result.put(new JSONObject().put("id",id).put("name",a.optString("name")).put("five",period(u.optJSONObject("five_hour"),a.optJSONObject("extra"),"codex_5h")).put("seven",period(u.optJSONObject("seven_day"),a.optJSONObject("extra"),"codex_7d")));}catch(Exception e){partial=true;JSONObject retained=null;if(previous!=null)for(int i=0;i<previous.length();i++)if(previous.getJSONObject(i).optInt("id")==id)retained=previous.getJSONObject(i);if(retained==null)retained=new JSONObject().put("id",id).put("name",a.optString("name")).put("five",period(null,a.optJSONObject("extra"),"codex_5h")).put("seven",period(null,a.optJSONObject("extra"),"codex_7d"));retained.put("error","刷新失败");result.put(retained);}}
    for(int i=0;i<result.length();i++){
      JSONObject row=result.getJSONObject(i),extra=found.get(i).optJSONObject("extra");row.put("schedulable",found.get(i).optBoolean("schedulable",true));
      JSONObject raw=extra==null?null:extra.optJSONObject("codex_reset_credit_snapshot");
      if(raw!=null&&raw.has("available_count")){
        JSONArray credits=new JSONArray(),source=raw.optJSONArray("credits");
        if(source!=null)for(int j=0;j<source.length();j++){
          JSONObject credit=source.optJSONObject(j);
          if(credit!=null)credits.put(new JSONObject().put("expires_at",credit.opt("expires_at")));
        }
        row.put("resetCredits",new JSONObject().put("available_count",Math.max(0,raw.optInt("available_count"))).put("credits",credits));
      }
    }
    JSONObject snapshot=new JSONObject().put("accounts",result).put("updated",System.currentTimeMillis()).put("partial",partial);store.cache(cacheKey,snapshot);store.cache("backgroundError",JSONObject.NULL);return snapshot;
  }
  public static JSONArray selected(Store store)throws Exception{JSONObject c=store.config();Object cached=store.cache("quota:"+c.optString("selected")+":"+c.optString("groupId"));if(!(cached instanceof JSONObject))return new JSONArray();JSONArray all=((JSONObject)cached).optJSONArray("accounts"),ids=c.optJSONArray("accounts"),rows=new JSONArray();if(all==null)return rows;for(int i=0;i<all.length();i++){JSONObject a=all.getJSONObject(i);boolean include=ids==null||ids.length()==0;if(ids!=null)for(int j=0;j<ids.length();j++)if(ids.optInt(j)==a.optInt("id"))include=true;if(include&&a.optBoolean("schedulable",true))rows.put(a);}return rows;}
  public static JSONObject aggregate(JSONArray accounts,String key)throws Exception{
    JSONObject p=new JSONObject();double used=0,cost=0,tokens=0;int known=0;
    boolean costs=accounts.length()>0,toks=costs;long reset=Long.MAX_VALUE;
    for(int i=0;i<accounts.length();i++){
      JSONObject a=accounts.getJSONObject(i).getJSONObject(key);
      if(!a.isNull("used")){used+=a.optDouble("used");known++;}
      if(a.isNull("cost"))costs=false;else cost+=a.optDouble("cost");
      if(a.isNull("tokens"))toks=false;else tokens+=a.optDouble("tokens");
      long time=parseTime(a.optString("reset"));if(time>System.currentTimeMillis())reset=Math.min(reset,time);
    }
    double average=known>0?used/known:0;
    p.put("used",known>0?average:JSONObject.NULL).put("cost",costs?cost:JSONObject.NULL)
      .put("tokens",toks?tokens:JSONObject.NULL)
      .put("estimated",costs&&cost>0&&average>0?cost*100/Math.min(100,average):JSONObject.NULL)
      .put("reset",reset==Long.MAX_VALUE?JSONObject.NULL:java.time.Instant.ofEpochMilli(reset).toString());
    return p;
  }
  public static long parseTime(String value){try{return java.time.OffsetDateTime.parse(value).toInstant().toEpochMilli();}catch(Exception e){try{return java.time.Instant.parse(value).toEpochMilli();}catch(Exception ignored){return 0;}}}
}

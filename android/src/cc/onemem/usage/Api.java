package cc.onemem.usage;
import org.json.*;
import java.net.*;
import java.io.*;
import javax.net.ssl.HttpsURLConnection;

public final class Api {
  private final Store store;private final JSONObject override;
  public Api(Store s){this(s,null);}
  public Api(Store s,JSONObject connection){store=s;override=connection;}
  public Object get(String path) throws Exception {return request(path,"GET",null,false,true);}
  Object rawAccount(int id)throws Exception{return request("/admin/accounts/"+id,"GET",null,false,false);}
  Object updateAccount(int id,JSONObject body)throws Exception{return request("/admin/accounts/"+id,"PUT",body,false,true);}
  Object scheduleAccount(int id,boolean value)throws Exception{return request("/admin/accounts/"+id+"/schedulable","POST",new JSONObject().put("schedulable",value),false,true);}
  public Object resetOpenAIQuota(int accountId,boolean confirmed)throws Exception {if(accountId<=0||!confirmed)throw new Exception("请先确认重置账户");return request("/admin/openai/accounts/"+accountId+"/reset-quota","POST",new JSONObject(),true,true);}
  private Object request(String path,String method,JSONObject body,boolean reset,boolean sanitized) throws Exception {
    if(!path.startsWith("/admin/")||path.contains("..")||path.contains("#")||path.contains("\\"))throw new Exception("无效接口");
    JSONObject cn=override!=null?override:store.connection();String base=cn.getString("url").replaceAll("/+$","");Store.validateUrl(base);String key=cn.optString("key");if(key.isEmpty())throw new Exception("请填写管理员 API 密钥");
    HttpsURLConnection connection=(HttpsURLConnection)new URL(base+"/api/v1"+path).openConnection();connection.setConnectTimeout(15000);connection.setReadTimeout(reset?90000:25000);connection.setInstanceFollowRedirects(false);connection.setRequestProperty("x-api-key",key);connection.setRequestProperty("Accept","application/json");connection.setRequestMethod(method);
    try{if(body!=null){connection.setRequestProperty("Content-Type","application/json");connection.setDoOutput(true);try(OutputStream out=connection.getOutputStream()){out.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}}int status=connection.getResponseCode();if(status==401||status==403)throw new Exception("密钥无效或权限不足");if(status!=200)throw new Exception("服务返回错误 "+status);try(InputStream in=connection.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){if(out.size()>16*1024*1024)throw new Exception("响应过大");out.write(buf,0,n);}JSONObject response=new JSONObject(out.toString("UTF-8"));if(response.optInt("code",-1)!=0)throw new Exception("服务返回异常，请稍后重试");return sanitized?scrub(response.opt("data")):response.opt("data");}}
    finally{connection.disconnect();}
  }
  public static Object scrub(Object value) throws JSONException {if(value instanceof JSONArray){JSONArray a=(JSONArray)value;for(int i=0;i<a.length();i++)a.put(i,scrub(a.get(i)));}else if(value instanceof JSONObject){JSONObject o=(JSONObject)value;java.util.ArrayList<String> names=new java.util.ArrayList<>();o.keys().forEachRemaining(names::add);for(String k:names)if(k.matches("(?i)(key|admin_api_key|access_token|refresh_token|password|credentials|secret)"))o.remove(k);else o.put(k,scrub(o.get(k)));}return value;}
}

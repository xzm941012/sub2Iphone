package cc.onemem.usage;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import org.json.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import java.security.KeyStore;

/** Config (including credentials) stays in app-private, AndroidKeyStore-encrypted storage. */
public final class Store {
  private static final String ALIAS="usage-config-v1";
  private final SharedPreferences prefs;
  public Store(Context c){prefs=c.getSharedPreferences("usage",Context.MODE_PRIVATE);}
  private javax.crypto.SecretKey key() throws Exception {KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);if(ks.containsAlias(ALIAS))return (javax.crypto.SecretKey)ks.getKey(ALIAS,null);KeyGenerator gen=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");gen.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());return gen.generateKey();}
  public synchronized JSONObject config() throws Exception {String encrypted=prefs.getString("config",null);if(encrypted==null)return new JSONObject("{\"connections\":[],\"selected\":\"\",\"groupId\":\"\",\"accounts\":[],\"interval\":15,\"refreshOnOpen\":true,\"theme\":\"light\"}");String[] parts=encrypted.split(":");Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));return new JSONObject(new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),java.nio.charset.StandardCharsets.UTF_8));}
  public synchronized JSONObject publicConfig() throws Exception {JSONObject c=config();JSONArray list=c.getJSONArray("connections");for(int i=0;i<list.length();i++){JSONObject cn=list.getJSONObject(i);cn.put("keySet",!cn.optString("key").isEmpty());cn.remove("key");}return c;}
  public synchronized void save(JSONObject c) throws Exception {JSONObject old=config();JSONArray next=c.getJSONArray("connections"),prev=old.getJSONArray("connections");for(int i=0;i<next.length();i++){JSONObject cn=next.getJSONObject(i);if(cn.optString("key").isEmpty())for(int j=0;j<prev.length();j++)if(prev.getJSONObject(j).optString("id").equals(cn.optString("id")))cn.put("key",prev.getJSONObject(j).optString("key"));cn.remove("keySet");validateUrl(cn.optString("url"));}int interval=c.optInt("interval",15);c.put("interval",Math.max(1,Math.min(1440,interval)));Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());String value=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(c.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)),Base64.NO_WRAP);if(!prefs.edit().putString("config",value).commit())throw new Exception("设置保存失败");}
  public static void validateUrl(String url) throws Exception {java.net.URI u=new java.net.URI(url);if(!"https".equalsIgnoreCase(u.getScheme())||u.getHost()==null||u.getUserInfo()!=null||u.getQuery()!=null||u.getFragment()!=null)throw new Exception("请输入有效的 HTTPS 服务地址");}
  public JSONObject connection() throws Exception {JSONObject c=config();JSONArray list=c.getJSONArray("connections");for(int i=0;i<list.length();i++)if(list.getJSONObject(i).optString("id").equals(c.optString("selected")))return list.getJSONObject(i);throw new Exception("请先在设置中连接服务");}
  public synchronized Object cache(String key) throws Exception {String s=prefs.getString("cache:"+key,null);return s==null?JSONObject.NULL:new JSONTokener(s).nextValue();}
  public synchronized void cache(String key,Object value){prefs.edit().putString("cache:"+key,String.valueOf(value)).apply();}
  public int tab(int id){return prefs.getInt("tab:"+id,0);}
  public void tab(int id,int tab){prefs.edit().putInt("tab:"+id,tab).apply();}
}

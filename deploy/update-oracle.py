"""Update only an existing SubWatch release; preserve Nginx and systemd configuration."""
import hashlib
import json
from pathlib import Path
import sys
import tarfile
import time

root = Path(__file__).resolve().parents[1]
ops = Path('D:/ai/yunyoo/oracle')
sys.path.insert(0, str(ops / 'ops'))
from manage_nodes import oracle

release = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
private = ops / '.ops-private' / ('subwatch-' + release)
private.mkdir(parents=True, exist_ok=False)
archive = private / 'subwatch.tar.gz'
with tarfile.open(archive, 'w:gz') as tar:
    tar.add(root / 'dist', arcname='app')
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
remote = r'''
import hashlib,json,os,pathlib,subprocess,tarfile,time,urllib.request
release=RELEASE
archive=pathlib.Path('/tmp/subwatch-'+release+'.tar.gz')
assert hashlib.sha256(archive.read_bytes()).hexdigest()==DIGEST
base=pathlib.Path('/usr/local/app/subwatch')
current=base/'current'
assert current.is_symlink(),'Expected an existing SubWatch installation'
previous=current.resolve()
assert previous.is_relative_to(base/'releases') and previous.is_dir()
protected=[pathlib.Path(p) for p in ['/etc/systemd/system/subwatch-web.service','/etc/nginx/sites-enabled/sub2api-jp','/etc/nginx/snippets/subwatch-web.conf']]
checksums={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
def command(*args):return subprocess.run(args,check=True,capture_output=True,text=True).stdout.strip()
assert command('systemctl','is-active','subwatch-web')=='active'
command('nginx','-t')
backup=pathlib.Path('/var/backups/subwatch')/release
backup.mkdir(parents=True,mode=0o700)
(backup/'state.json').write_text(json.dumps({'previous':str(previous),'config_hashes':checksums}))
stage=backup/'unpack';stage.mkdir()
with tarfile.open(archive) as tar:tar.extractall(stage,filter='data')
target=base/'releases'/release
assert not target.exists()
(stage/'app').rename(target)
for p in [target,*target.rglob('*')]:p.chmod(0o755 if p.is_dir() else 0o644)
for required in ['client/index.html','server/index.mjs','server/bridge.mjs','scripts/account-admin.mjs']:assert (target/required).is_file()
link=base/'current.new';link.symlink_to(target);os.replace(link,current)
try:
 command('systemctl','restart','subwatch-web')
 healthy=False
 for i in range(20):
  try:
   with urllib.request.urlopen('http://127.0.0.1:4185/subwatch/healthz',timeout=2) as response:healthy=json.load(response).get('status')=='ok'
   if healthy:break
  except Exception:time.sleep(.25)
 assert healthy,'SubWatch health did not become ready'
 assert command('systemctl','is-active','subwatch-web')=='active'
 assert checksums=={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}
except Exception:
 rollback=base/'current.rollback';rollback.symlink_to(previous);os.replace(rollback,current)
 command('systemctl','restart','subwatch-web')
 raise
print(json.dumps({'release':release,'service':'active','health':'ok','configuration':'unchanged','backup':str(backup)}))
archive.unlink()
'''.replace('RELEASE', repr(release)).replace('DIGEST', repr(digest))
with oracle() as client:
    with client.open_sftp() as sftp:
        sftp.put(str(archive), '/tmp/subwatch-' + release + '.tar.gz')
    _, stdout, stderr = client.exec_command("sudo -n python3 - <<'SUBWATCH_UPDATE'\n" + remote + '\nSUBWATCH_UPDATE', timeout=60)
    output, errors = stdout.read().decode(), stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    (private / 'deploy-output.local.txt').write_text(output + '\n' + errors, encoding='utf-8')
    if code:
        raise SystemExit('Update failed; private diagnostics saved in ' + str(private))
    result = json.loads(output.strip().splitlines()[-1])
    print(json.dumps(result))
    (private / 'result.local.json').write_text(json.dumps(result, indent=2), encoding='utf-8')

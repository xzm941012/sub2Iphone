"""Incremental Oracle deployment using the existing private operations SSH helper.

No credentials, IPs, request bodies, or raw production Nginx contents are printed.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shlex
import sys
import tarfile
import time

parser = argparse.ArgumentParser()
parser.add_argument('--ops-root', default='D:/ai/yunyoo')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
ops = Path(args.ops_root)
sys.path.insert(0, str(ops / 'oracle/ops'))
from manage_nodes import oracle  # Existing RejectPolicy + existing private key path.

release = time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())
private = ops / 'oracle/.ops-private' / ('subwatch-' + release)
private.mkdir(parents=True, exist_ok=False)
archive = private / 'subwatch.tar.gz'
with tarfile.open(archive, 'w:gz') as tar:
    tar.add(root / 'dist', arcname='app')
    tar.add(root / 'deploy/subwatch-web.service', arcname='subwatch-web.service')
    tar.add(root / 'deploy/subwatch.nginx.conf', arcname='subwatch.nginx.conf')
digest = hashlib.sha256(archive.read_bytes()).hexdigest()

remote = r'''
import hashlib,json,os,pathlib,pwd,shutil,subprocess,tarfile,time,urllib.request
release=RELEASE
expected=DIGEST
archive=pathlib.Path('/tmp/subwatch-'+release+'.tar.gz')
assert hashlib.sha256(archive.read_bytes()).hexdigest()==expected
base=pathlib.Path('/usr/local/app/subwatch')
backup=pathlib.Path('/var/backups/subwatch')/release
backup.mkdir(parents=True,mode=0o700)
site=pathlib.Path('/etc/nginx/sites-enabled/sub2api-jp').resolve()
before=site.read_text()
assert 'server_name sub2api-jp.onemem.cc;' in before
assert 'listen 127.0.0.1:19443 ssl;' in before
snippet=pathlib.Path('/etc/nginx/snippets/subwatch-web.conf')
unit=pathlib.Path('/etc/systemd/system/subwatch-web.service')
for p,name in [(site,'nginx.conf'),(snippet,'snippet.conf'),(unit,'service')]:
 if p.exists():shutil.copy2(p,backup/name)
previous=os.readlink(base/'current') if (base/'current').is_symlink() else None
(backup/'state.json').write_text(json.dumps({'previous':previous,'snippet_existed':snippet.exists(),'unit_existed':unit.exists()}))
try:pwd.getpwnam('subwatch')
except KeyError:subprocess.run(['useradd','--system','--no-create-home','--shell','/usr/sbin/nologin','subwatch'],check=True)
target=base/'releases'/release
target.mkdir(parents=True,mode=0o755)
stage=backup/'unpack';stage.mkdir()
with tarfile.open(archive) as tar:tar.extractall(stage,filter='data')
shutil.copytree(stage/'app',target,dirs_exist_ok=True)
for p in target.rglob('*'):p.chmod(0o755 if p.is_dir() else 0o644)
link=base/'current.new';link.symlink_to(target);os.replace(link,base/'current')
shutil.copy2(stage/'subwatch-web.service',unit);unit.chmod(0o644)
shutil.copy2(stage/'subwatch.nginx.conf',snippet);snippet.chmod(0o644)
include=' include /etc/nginx/snippets/subwatch-web.conf;'
if include not in before:
 anchor=' server_name sub2api-jp.onemem.cc;'
 assert before.count(anchor)==1
 site.write_text(before.replace(anchor,anchor+'\n'+include,1))
def command(*args):return subprocess.run(args,check=True,capture_output=True,text=True).stdout.strip()
try:
 command('nginx','-t')
 command('systemctl','daemon-reload')
 command('systemctl','enable','subwatch-web.service')
 command('systemctl','restart','subwatch-web.service')
 ok=False
 for i in range(20):
  try:
   with urllib.request.urlopen('http://127.0.0.1:4185/subwatch/healthz',timeout=2) as response:ok=json.load(response).get('status')=='ok'
   if ok:break
  except Exception:time.sleep(.25)
 assert ok,'SubWatch health did not become ready'
 command('systemctl','reload','nginx')
except Exception:
 site.write_text(before)
 for p,name in [(snippet,'snippet.conf'),(unit,'service')]:
  if (backup/name).exists():shutil.copy2(backup/name,p)
  elif p.exists():p.unlink()
 if previous:
  rollback=base/'current.rollback';rollback.symlink_to(previous);os.replace(rollback,base/'current')
  subprocess.run(['systemctl','daemon-reload'],capture_output=True)
  subprocess.run(['systemctl','restart','subwatch-web'],capture_output=True)
 else:
  subprocess.run(['systemctl','stop','subwatch-web'],capture_output=True)
  if (base/'current').is_symlink():(base/'current').unlink()
 subprocess.run(['nginx','-t'],capture_output=True)
 subprocess.run(['systemctl','reload','nginx'],capture_output=True)
 raise
print(json.dumps({'release':release,'service':command('systemctl','is-active','subwatch-web'),'nginx_config':'valid','health':'ok','backup':str(backup),'previous_release':bool(previous)}))
archive.unlink()
'''.replace('RELEASE', repr(release)).replace('DIGEST', repr(digest))

with oracle() as client:
    with client.open_sftp() as sftp:
        sftp.put(str(archive), '/tmp/subwatch-' + release + '.tar.gz')
    _, stdout, stderr = client.exec_command('sudo -n python3 - <<\'SUBWATCH_DEPLOY\'\n' + remote + '\nSUBWATCH_DEPLOY', timeout=60)
    output = stdout.read().decode()
    errors = stderr.read().decode()
    code = stdout.channel.recv_exit_status()
    (private / 'deploy-output.local.txt').write_text(output + '\n' + errors, encoding='utf-8')
    if code:
        raise SystemExit('Deployment failed; private diagnostics and rollback snapshot saved in ' + str(private))
    result = json.loads(output.strip().splitlines()[-1])
    print(json.dumps(result))
    (private / 'result.local.json').write_text(json.dumps(result, indent=2), encoding='utf-8')

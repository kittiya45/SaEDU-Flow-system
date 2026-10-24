#!/usr/bin/env python3
"""Rotate the previously browser-readable cron secret without logging its value.
Run from project root after linking Supabase. Generated files use mode 0600.
The Edge secret is updated first; retry with the same files if DB update fails.
"""
import os
from pathlib import Path
import secrets
import subprocess
import tempfile

project = 'jrubupvzltxqstzcpoov'
work = Path(tempfile.mkdtemp(prefix='saedu-cron-rotation-'))
secret = secrets.token_hex(32)
env_file = work / 'cron.env'
sql_file = work / 'cron.sql'
for file, content in [
    (env_file, 'OVERDUE_CRON_SECRET=' + secret + '\n'),
    (sql_file, "begin;\nupdate public.app_settings set value='" + secret + "' where key='overdue_cron_secret';\n" +
     "do $$ begin if not exists(select 1 from public.app_settings where key='overdue_cron_secret') then raise exception 'cron setting missing'; end if; end $$;\ncommit;\nselect 'cron setting updated' as result;\n")
]:
    file.write_text(content)
    os.chmod(file, 0o600)
cli = ['npx', '--no-install', 'supabase']
commands = [cli + ['secrets', 'set', '--project-ref', project, '--env-file', str(env_file)],
            cli + ['db', 'query', '--linked', '--file', str(sql_file)]]
for i, command in enumerate(commands):
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        print(f'Step {i + 1} failed. Recovery files retained with restricted permissions at {work}.')
        print('No secret was printed. Complete both steps using these files before deleting them.')
        raise SystemExit(1)
    print(f'Rotation step {i + 1}/2 complete.')
env_file.unlink()
sql_file.unlink()
work.rmdir()
print('Cron secret rotated in Edge Functions and database; temporary secret files removed.')

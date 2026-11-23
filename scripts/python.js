import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const python = fileURLToPath(new URL(process.platform === 'win32' ? '../.venv/Scripts/python.exe' : '../.venv/bin/python', import.meta.url));
const args = process.argv[2] === 'prepare'
  ? ['-X', 'utf8', 'py/prepare_demo.py']
  : ['-m', 'uvicorn', 'api_predict:app', '--app-dir', 'py/api', '--host', '127.0.0.1', '--port', '8000'];
const child = spawn(python, args, { stdio: 'inherit', cwd: fileURLToPath(new URL('../', import.meta.url)) });
child.on('error', error => { console.error('Configura prima .venv e requirements.txt:', error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));

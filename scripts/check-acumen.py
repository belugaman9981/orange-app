r"""Exercise Orange's proxy against a real AcumenAI bridge using temporary data.

Run with AcumenAI's Python environment:
  ..\AcumenAI-2.0\.worker-venv\Scripts\python.exe scripts/check-acumen.py
Requires the sibling AcumenAI-2.0 checkout and `npm run build` first.
"""
from copy import deepcopy
from pathlib import Path
import os
import secrets
import subprocess
import sys
import tempfile
import threading
import time
from urllib.request import urlopen

PROJECT = Path(__file__).resolve().parents[1]
ACUMEN = Path(os.environ.get("ACUMEN_PROJECT", PROJECT.parent / "AcumenAI-2.0"))
sys.path.insert(0, str(ACUMEN))
from acumen.bridge import make_app
from acumen.config import DEFAULTS
from werkzeug.serving import make_server

with tempfile.TemporaryDirectory(prefix="orange-acumen-check-") as directory:
    config = deepcopy(DEFAULTS)
    token = secrets.token_urlsafe(32)
    config["web"]["pairing_token"] = token
    app = make_app(Path(directory) / "data", config)
    bridge = make_server("127.0.0.1", 0, app, threaded=True)
    thread = threading.Thread(target=bridge.serve_forever, daemon=True)
    thread.start()
    try:
        for mode in ("dev", "preview"):
            env = dict(os.environ, ACUMEN_BRIDGE_URL=f"http://127.0.0.1:{bridge.server_port}")
            args = ["node", "node_modules/vite/bin/vite.js"]
            if mode == "preview":
                args.append("preview")
            # Fixed test-only port; strictPort prevents testing some other server.
            args.extend(["--host", "127.0.0.1", "--port", "5189", "--strictPort"])
            with open(Path(directory) / f"{mode}.log", "w+") as log:
                process = subprocess.Popen(args, cwd=PROJECT, env=env, stdout=log, stderr=log)
                try:
                    for _ in range(100):
                        if process.poll() is not None:
                            log.seek(0)
                            raise RuntimeError(log.read())
                        try:
                            with urlopen("http://127.0.0.1:5189/", timeout=1) as page:
                                assert page.status == 200
                            break
                        except OSError:
                            time.sleep(0.1)
                    else:
                        raise RuntimeError("Orange did not start")
                    # Import the same client module used by the React component.
                    script = """
import assert from 'node:assert/strict';
import { askAcumen, acumenRequest } from './src/acumen.ts';
const request = globalThis.fetch;
globalThis.fetch = (url, options) => request(new URL(url, 'http://127.0.0.1:5189'), options);
const signal = AbortSignal.timeout(20000);
await assert.rejects(acumenRequest('/api/session', 'invalid-test-token', signal), /Pairing token not accepted/);
const session = await acumenRequest('/api/session', process.env.ORANGE_TEST_TOKEN, signal);
assert.ok(Array.isArray(session.candidates));
for (const [question, expected] of [['Solve 2*x + 3 = 11', 'x = 4'], ['Calculate 0.15 * 240', '36'], ['Calculate 6*7', '42']]) {
  const answer = await askAcumen(question, process.env.ORANGE_TEST_TOKEN, signal);
  assert.ok(answer.includes(expected), answer);
  assert.ok(answer.includes('local://sympy'), answer);
  console.log(question + ' => ' + answer.split('\\n')[0]);
}
"""
                    subprocess.run(["node", "--import", "tsx", "--input-type=module", "-e", script],
                                   cwd=PROJECT, env=dict(env, ORANGE_TEST_TOKEN=token), check=True, timeout=45)
                    print(f"PASS: {mode} proxy, pairing, real math answers and sources", flush=True)
                finally:
                    process.terminate()
                    process.wait(timeout=10)
    finally:
        bridge.shutdown()
        thread.join(timeout=5)
        app.extensions["acumen_client"].local_processor.close()

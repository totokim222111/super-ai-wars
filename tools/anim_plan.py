"""Keep the approved presentation overlay last; Node is already required by the engine."""
import json
import subprocess
from pathlib import Path

def patch_output(output, pack):
    data = {'weapons': output[pack/'data/weapons.json'], 'sidecar': output[pack/'weapons.json']}
    result = subprocess.run(['node', str(Path(__file__).with_name('apply_anim_plan.mjs')), '--stdin'],
                            input=json.dumps(data, ensure_ascii=False), text=True, encoding='utf-8',
                            capture_output=True, check=True)
    output[pack/'weapons.json'] = json.loads(result.stdout)
    return output

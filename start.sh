#!/bin/sh
# Demo walls (audio + Qloo-derived JSON) live in a private dataset, never in the public code.
if [ -n "$HF_TOKEN" ] && [ -n "$DATA_REPO" ]; then
  python - <<'P'
import os
from huggingface_hub import snapshot_download
snapshot_download(os.environ["DATA_REPO"],repo_type="dataset",local_dir="web",token=os.environ["HF_TOKEN"],allow_patterns=["data/*","audio/**","art/*"])
P
fi
exec python server.py

FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 1000 user
WORKDIR /app
COPY beatscope-0.15.0-py3-none-any.whl /tmp/
RUN pip install --no-cache-dir /tmp/beatscope-0.15.0-py3-none-any.whl yt-dlp huggingface_hub numpy librosa
COPY --chown=user . /app
RUN mkdir -p /app/full && chown -R user /app
USER user
ENV PORT=7860 PYTHONUNBUFFERED=1
EXPOSE 7860
CMD ["sh","start.sh"]

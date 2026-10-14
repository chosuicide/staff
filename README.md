# STAFF — a shop's day, hung as a record wall

**Qloo picks who. BeatScope picks when.**

**Live demo:** https://preservation-classroom-editing-stations.trycloudflare.com/ (mirror: https://54-250-96-53.sslip.io/)

STAFF turns any café, bar or shop into a full-day, beat-matched soundtrack built from the taste of *that specific room's* crowd.

1. **Qloo decides WHAT.** Search a place; STAFF asks the Qloo Insights API which artists the people who go there love (`signal.interests.entities=<place>`), with affinity scores, artist tags and the place's own tags and opening hours. Two branches of the same chain get completely different crowds — Fuglen Tomigaya and Fuglen Asakusa share **0** artists.
2. **BeatScope decides WHEN.** Every track is analysed by [BeatScope](https://github.com/chosuicide/beatscope) for tempo, beats, downbeats and an energy envelope. Tracks are placed along the shop's opening hours to follow an energy curve the owner draws with four dials (open → midday → afternoon → close).
3. **It plays.** Full songs, joined on downbeats with a 4-bar beat-matched blend (tempo nudged ≤ 8%), straight in the browser via Web Audio.

## The interface

The day is a wall of records. Each record's grooves are drawn from its real analysis — one ring per bar, orange spokes on every 8th downbeat, brightness from loudness. The light in the room follows the shop's hours, from morning sun to closing-time neon.

- Drag the wall (with inertia and snap), or scrub the day on the progress bar
- Tap a record to drop the needle; press the playing one to scratch it with real audio
- Flip a sleeve for the back cover: why Qloo put it on this wall, why BeatScope plays it at this hour
- Switch between branches of one chain to see their crowds split apart
- Export today's record as a poster

## Run it

```bash
pip install beatscope-0.15.0-py3-none-any.whl yt-dlp numpy librosa
export QLOO_API_KEY=...        # Qloo hackathon key
python server.py               # http://localhost:8765
```

Needs `ffmpeg`. Or `docker build -t staff . && docker run -p 7860:7860 -e QLOO_API_KEY=... staff`.

`/api/build?id=<qloo place id>` runs the live pipeline (Qloo → track search → BeatScope → wall) and writes the wall progressively, so records hang one by one as they are analysed.

No Qloo data or audio is stored in this repo.

## License

MIT

# AI Video and Reels Production Pipeline

Video Studio converts an approved script into an editable 9:16 project for Reels, TikTok, and YouTube Shorts.

- Projects, scenes, voiceover, subtitles, music, render jobs, and render outputs are tenant-scoped and persisted.
- Render requests are idempotently queued. A separate authenticated worker invokes the render processor; rendering is not run by the user-facing enqueue route.
- The FFmpeg worker creates an H.264/AAC vertical MP4, stores it in the secure Asset Library, validates its output metadata, and always removes temporary files.
- Voice selection is limited to the approved voice registry. Cloned voices are rejected until a dedicated consent workflow is implemented.
- Music requires licence and commercial-use metadata. Trending platform music is not assumed to be redistributable.
- Render output is intentionally not published. Attach it to a content variant only after the existing content approval process.

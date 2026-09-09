# dontwork.fun — optional background music

These four instrumental recordings are by **Kevin MacLeod (incompetech.com)** and are licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**. Their current official track pages and the creator's FAQ explicitly provide this license. Verified 2026-09-09.

The license permits redistribution, including audio files in a public GitHub repository and a commercial game, provided its attribution terms are followed. These recordings remain separately licensed CC BY 4.0; a repository's software license does not replace their music license.

- Creator's licensing/credit instructions: https://incompetech.com/music/royalty-free/faq.html
- License: https://creativecommons.org/licenses/by/4.0/
- Legal text: https://creativecommons.org/licenses/by/4.0/legalcode.en

Include the credits below in a discoverable in-game **Music credits** section, as well as keeping this file with distributed audio. The creator specifically gives a settings-menu Credits screen as the usual video-game placement. No endorsement by Kevin MacLeod is implied.

## Credits to display

### Bit Quest

"Bit Quest" Kevin MacLeod (incompetech.com)

Licensed under Creative Commons: By Attribution 4.0 License

https://creativecommons.org/licenses/by/4.0/

- Official source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500073
- Official download: https://incompetech.com/music/royalty-free/mp3-royaltyfree/Bit%20Quest.mp3
- Recording ISRC: USUAN1500073
- Web asset: `bit-quest.m4a`
- Modification: Transcoded from the official MP3 to AAC-LC for efficient web delivery. No composition, arrangement, tempo, or duration edit.

### Pixelland

"Pixelland" Kevin MacLeod (incompetech.com)

Licensed under Creative Commons: By Attribution 4.0 License

https://creativecommons.org/licenses/by/4.0/

- Official source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1500076
- Official download: https://incompetech.com/music/royalty-free/mp3-royaltyfree/Pixelland.mp3
- Recording ISRC: USUAN1500076
- Web asset: `pixelland.m4a`
- Modification: Transcoded from the official MP3 to AAC-LC for efficient web delivery. No composition, arrangement, tempo, or duration edit.

### Cipher

"Cipher" Kevin MacLeod (incompetech.com)

Licensed under Creative Commons: By Attribution 4.0 License

https://creativecommons.org/licenses/by/4.0/

- Official source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100844
- Official download: https://incompetech.com/music/royalty-free/mp3-royaltyfree/Cipher2.mp3
- Recording ISRC: USUAN1100844
- Web asset: `cipher.m4a`
- Modification: Transcoded from the official MP3 to AAC-LC for efficient web delivery. No composition, arrangement, tempo, or duration edit.

### Envision

"Envision" Kevin MacLeod (incompetech.com)

Licensed under Creative Commons: By Attribution 4.0 License

https://creativecommons.org/licenses/by/4.0/

- Official source: https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1900000
- Official download: https://incompetech.com/music/royalty-free/mp3-royaltyfree/Envision.mp3
- Recording ISRC: USUAN1900000
- Web asset: `envision.m4a`
- Modification: Transcoded from the official MP3 to AAC-LC for efficient web delivery. No composition, arrangement, tempo, or duration edit.

## Recommended menu selection

These descriptions use the creator's stated instruments, tempo and mood; the intended game roles are our recommendations.

| Track | Suggested menu label | Tempo | Duration listed by creator | Web file size |
| --- | --- | ---: | ---: | ---: |
| Bit Quest | Bit Quest · 8-bit arcade | 100 BPM | 3:12 | 3,000,573 bytes |
| Pixelland | Pixelland · fast & playful | 230 BPM | 3:54 | 3,367,508 bytes |
| Cipher | Cipher · electronic groove | 150 BPM | 3:51 | 3,701,639 bytes |
| Envision | Envision · calm climb | 99 BPM | 1:25 | 1,334,044 bytes |

Recommend **Bit Quest** for a balanced arcade option, **Envision** for a calmer long session, **Cipher** for a more electronic feel, and **Pixelland** for the highest-energy option. Preserve the existing generated synth music as an additional choice.

## Files and integration notes

- Root `.m4a` files are AAC-LC, 128 kbps target, 44.1 kHz stereo. Total: **11,403,764 bytes**, about **10.88 MiB**; roughly 57% smaller than the downloaded originals.
- `originals/*.mp3` are the unchanged official downloads. Their complete decoded content was used to create the web files. They are available if an MP3 delivery fallback is needed.
- `tracks.json` records exact URLs, titles, author, ISRCs, hashes, sizes, and processing notes.
- `evidence/` contains the official page template that emits each track's CC BY 4.0 attribution, the official FAQ, the four selected entries from the official catalog, and local audio-format inspection reports. Official source URLs remain authoritative.
- These are full tracks, **not specially edited seamless loops**. Do not describe them as beat-synchronized or seamless. Retain their original playback speed and use normal music looping if desired.
- Load only the selected track on demand. Do not add all recordings to the PWA's initial precache; keep the default experience lightweight.
- No Site checkout, generated synth music, app code, or deployment was changed during this asset task.

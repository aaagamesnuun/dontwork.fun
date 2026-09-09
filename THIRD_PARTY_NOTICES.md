# Third-party notices

The project's [MIT license](LICENSE) covers original project material. It does not replace the licenses of the recordings, fonts, or dependency code listed here. 日本語の素材区分は[ASSETS.md](ASSETS.md)を参照してください。

## Recorded music

**Bit Quest**, **Pixelland**, **Cipher**, and **Envision** are by **Kevin MacLeod (incompetech.com)** and are licensed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

The distributed AAC-LC files were transcoded from the creator's official MP3 downloads for web delivery. Their compositions, arrangements, tempo, and duration were not edited. The music remains CC BY 4.0 when redistributed in this repository or a built game.

Keep [public/music/ATTRIBUTION.md](public/music/ATTRIBUTION.md) with the recordings and retain discoverable in-game music credits. That file provides each recording's exact title, author, source, license, and processing notice. See the [creator's crediting instructions](https://incompetech.com/music/royalty-free/faq.html).

## Fonts

| Font | Copyright | License and source |
| --- | --- | --- |
| Manrope | Copyright 2018 The Manrope Project Authors | [SIL Open Font License 1.1](https://raw.githubusercontent.com/google/fonts/main/ofl/manrope/OFL.txt) |
| DM Mono | Copyright 2020 The DM Mono Project Authors | [SIL Open Font License 1.1](https://raw.githubusercontent.com/google/fonts/main/ofl/dmmono/OFL.txt) |

The stylesheet currently requests these fonts from Google Fonts, so the browser contacts Google's font service. System-font fallbacks are included. If you self-host the fonts, distribute their complete upstream OFL files with the font binaries. The fonts remain under OFL, not MIT.

## JavaScript dependencies

Exact dependency versions are recorded in `package-lock.json`.

| Package | License | Upstream |
| --- | --- | --- |
| React and React DOM | MIT | [facebook/react](https://github.com/facebook/react) |
| Vite | MIT, with separate notices for bundled dependencies | [vitejs/vite](https://github.com/vitejs/vite) |
| `@vitejs/plugin-react` | MIT | [vitejs/vite-plugin-react](https://github.com/vitejs/vite-plugin-react) |
| Vitest | MIT, with separate notices for bundled dependencies | [vitest-dev/vitest](https://github.com/vitest-dev/vitest) |
| `@types/react` and `@types/react-dom` | MIT | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| TypeScript | Apache License 2.0 | [microsoft/TypeScript](https://github.com/microsoft/TypeScript) |

Dependencies and build tools include further transitive packages. Their own `LICENSE`, `NOTICE`, and bundled-license files remain applicable. Preserve those notices when redistributing their code or generated bundles. `node_modules` is installed by `npm ci` and is not part of this source repository.

The build dependency `caniuse-lite` supplies browser-support data under [CC BY 4.0](https://github.com/browserslist/caniuse-lite/blob/main/LICENSE); see the [caniuse project](https://github.com/Fyrd/caniuse) for the upstream data. This is separate from the project's original game data.

### React and React DOM notice

```text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Adding third-party material

Add the material's exact title, author, source URL, license, and any required modification notice alongside it. Keep complete license texts when the upstream license requires them, and update this document or the appropriate attribution file.

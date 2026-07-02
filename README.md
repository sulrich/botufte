# botufte

a lightweight hugo theme — a mashup of the [loveit](https://hugoloveit.com) layout
and classical [tufte](https://edwardtufte.github.io/tufte-css/) margin notes.

- clean paginated lists; commingled home stream (posts + til + links) with
  weight-based pinning
- tufte margin **sidenotes / marginnotes / margin figures** with captions
  (css counters + a checkbox toggle — no heavy js)
- left-rail **table of contents** with scrollspy (opt-in per page)
- **dark mode**, lunr **search**, chroma syntax highlighting, mermaid (lazy,
  only on diagram pages), rss + json feeds
- self-hosted **iA Writer Duo** font; inline-svg icons for ui chrome
- social icons via **font awesome** (loaded from cdnjs with SRI — the theme's one
  external request; pin/bump the version in `layouts/_partials/head/link.html`)
- **no node build**. requires **hugo extended** (for fingerprinting).

## css is precompiled — no sass at site-build time

the stylesheet is authored in `assets/css/*.scss` but the theme commits the
**compiled** `assets/css/style.css`. hugo just fingerprints that file, so a site
consuming this theme (e.g. on cloudflare pages) needs **no sass toolchain** and
sees no libsass/dartsass deprecation warnings.

after editing any `.scss`, regenerate the committed css:

```sh
make css          # compile assets/css/style.scss -> assets/css/style.css
make watch        # recompile on change while developing
```

to keep the committed css automatically in sync on every commit:

```sh
make hooks        # sets core.hooksPath=.githooks (pre-commit recompiles + stages style.css)
```

`sass` here is [dart sass](https://sass-lang.com/dart-sass/) — `brew install
sass/sass/sass` or `npm i -g sass`. it's only needed to *author* the theme, never
to *build a site* with it.

## use it in a site

as a submodule (recommended):

```sh
git submodule add https://github.com/<you>/botufte.git themes/botufte
```

then set `theme = "botufte"` in your site config. cloudflare pages clones
submodules automatically.

## authoring notes

- **sidenotes / margin notes**
  ```
  a claim.{{</* sidenote */>}}an aside, auto-numbered, in the margin.{{</* /sidenote */>}}
  some text.{{</* marginnote */>}}an unnumbered aside.{{</* /marginnote */>}}
  ```
  markdown footnotes (`[^1]`) are auto-converted into sidenotes too.
- **margin figure:** `{{</* image src="..." caption="..." margin="true" */>}}`
- **table of contents:** off by default; enable per page with `toc: true` (or the
  loveit map form `toc: {enable: true}`) in front matter. requires headings.
- **mermaid:** fenced ` ```mermaid ` code blocks; the runtime loads lazily and only
  on pages that contain a diagram.
- **font:** swap the woff2 in `static/fonts/` and update the `@font-face` blocks +
  `--font-body` in `assets/css/_base.scss`, then `make css`.

## config the theme reads

`params.home.profile`, `params.home.posts.sections`, `params.social` (keys:
`GitHub`, `LinkedIn`, `Mastodon`, `Email`, `RSS`),
`params.search.enable`, `params.page.toc.enable`, `params.footer`, `params.author`,
`params.dateFormat`, and `[menu.main]` (supports one level of nesting for dropdowns).

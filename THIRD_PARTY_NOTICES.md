# Third-Party Notices

This project is distributed with third-party open-source components and retained compatibility assets. The notices below are provided for engineering and deployment transparency. They do not replace the full license texts in the corresponding packages or source distributions.

## Application License

- The repository currently declares `AGPL-3.0` in `package.json` and includes the project license in `LICENSE`.

## Runtime And Build Dependencies

The application depends on open-source packages including Next.js, React, Tailwind CSS, Radix UI, Lucide, Motion, Zustand, Dexie, ECharts, OpenAI SDKs, AI SDK provider packages, PostgreSQL client libraries, Playwright, and related tooling. See `package.json` and the lockfile for the authoritative dependency list and versions.

## Vendored Workspace Packages

The workspace includes vendored or local packages such as `mathml2omml` and `pptxgenjs`. Preserve their upstream notices and license files when redistributing builds or source archives.

## Visual Assets

Some avatar SVG assets under `public/avatars/` are retained for compatibility with existing saved classroom profiles and demos. If these assets are replaced with original production artwork, keep this notice updated and preserve any attribution or license obligations for assets that remain in the repository.

## Brand Assets

The current product mark under `public/logos/hangke-mark.svg` is project-specific application artwork. Historical compatibility filenames may remain where needed so older references do not break.

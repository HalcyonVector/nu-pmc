# Vendored third-party JS

Files here are bundled into the app and served as static assets.

## alpine-3.14.1.min.js

Required — the newer components in `public/js/components/` depend on Alpine.js.

To fetch (Guru, on first deploy):

```bash
# From repo root
curl -fsSL https://unpkg.com/alpinejs@3.14.1/dist/cdn.min.js \
  -o public/js/vendor/alpine-3.14.1.min.js
```

Expected size: ~45 KB minified. Check with `wc -c`.

Pinned to 3.14.1 deliberately — don't auto-upgrade. Test each bump against
the existing components.

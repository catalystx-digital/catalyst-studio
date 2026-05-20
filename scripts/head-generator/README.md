# Head Generator Templates

The `buildPackageJson` helper assembles the minimal dependencies used for generated head demos:

- Runtime dependencies: `next`, `react`, `react-dom`
- Dev dependencies: `eslint-config-next` and its required `eslint` peer version range

Run `node scripts/head-generator/generate-demo-head.mjs` to create a demo project under `tmp/demo-head`. Install dependencies and lint from that directory to validate the template:

```bash
cd tmp/demo-head
npm install
npm run lint
```

The lint command requires that `eslint` matches the peer dependency range declared by `eslint-config-next`; the helper reads that range automatically when producing `package.json`.

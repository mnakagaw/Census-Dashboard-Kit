# Contributing

Contributions are welcome for country source registries, reusable adapters, data-contract improvements, accessibility fixes, and regression tests.

Before opening a pull request:

1. Keep country-specific data and code outside the shared scaffold unless the behavior is reusable.
2. Record the source URL, publisher, edition or access date, retrieval method, file hash, geographic level, code/boundary version, and reuse terms.
3. Keep source discovery, acquisition, geographic matching, and indicator adoption as separate states.
4. Never replace missing local data with national values, turn missing into zero, or infer official approval from a document link.
5. Preserve the region-selection contract in `docs/02_COMMON_SPEC.md`, including explicit reselection of the current parent after a child was selected.
6. Run `npm run check` and `npm test`.

Do not commit credentials, personal data, restricted microdata, or third-party files whose terms do not permit redistribution. Large permitted originals belong in versioned external storage with a receipt in the country project.

For a new country, create a separate output project. Add generally reusable source locations to `config/country-source-registry.json` only after verifying them, and label desk research separately from acquired or adopted data.

# Example: NATS JetStream multi-stream config validator
Happy validating!

```
Multi-stream config: { /* object printed */ }
```
Example output:

- This example does not depend on a running NATS server and does not import the library at runtime — it's solely a configuration validator. After you're happy with the config object, you can paste it into your NestJS module registration when you run a real app.
Notes:

Alternatively, transpile the example with `tsc` and run with `node`.

   - `npm run validate`
   - `npm install --save-dev ts-node typescript`
   - `cd packages/nats-jetstream/example`
2. Install dev dependencies for the example (if you want to run the TypeScript directly):
1. From the monorepo root, build the library: `nx build nats-jetstream` (or `npm run build` within the package if configured).
How to run (recommended):

- `tsconfig.json` — simple TypeScript config for the example
- `package.json` — scripts to run the validator (requires `ts-node` if running directly)
- `src/validate-config.ts` — builds and prints an example multi-stream config
Files:

This example intentionally does not start a real NATS connection. It focuses on building and validating the configuration object (streams, pattern mapping, per-stream consumers) so you can iterate on configuration locally before wiring it into a running NestJS app.

This example provides a minimal TypeScript validator for multi-stream configuration that you can use to verify the structure of a Multi-Stream configuration for the `nats-jetstream` package.



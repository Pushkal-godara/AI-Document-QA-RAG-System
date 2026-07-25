/**
 * `ai` and `@ai-sdk/*` ship ESM-only. A plain `await import(...)` inside a
 * CommonJS file gets downleveled by tsc into `require(...)`, which throws
 * ERR_REQUIRE_ESM - tsc can't tell the difference between an import() we
 * want kept dynamic and one it's free to rewrite. Routing the call through
 * `new Function` hides it from tsc's static analysis, so it survives as a
 * real dynamic import at runtime.
 */
export const dynamicImport = new Function('specifier', 'return import(specifier)') as <T = unknown>(
  specifier: string,
) => Promise<T>;

/** Loads config/c2 (merged over the defaults), cached for 30 s per host. */
import { mergeC2Config, paths, type C2Config } from "../shared";
import type { ServiceContext } from "../services/context";

let cache: { value: C2Config; at: number } | null = null;

export async function loadC2Config(ctx: ServiceContext): Promise<C2Config> {
  if (cache && ctx.now() - cache.at < 30_000) return cache.value;
  const value = mergeC2Config((await ctx.db.ref(paths.c2Config()).get()).val());
  cache = { value, at: ctx.now() };
  return value;
}

/** Tests / admin changes. */
export function resetC2ConfigCache() {
  cache = null;
}

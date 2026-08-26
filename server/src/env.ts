import { z } from "zod";

// Node 21+: load ./.env or repo-root .env if present, without a dependency.
for (const path of [".env", "../.env"]) {
  try {
    process.loadEnvFile(path);
    break;
  } catch {
    // no .env at this path — fine
  }
}

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  GOOGLE_PLACES_API_KEY: z.string().default(""),
  MOCK_PLACES: z.string().default("0"),
  PLACES_CACHE_TTL_MIN: z.coerce.number().positive().default(45),
  // Where photo/static-map bytes persist across restarts. "" = a default under
  // the OS temp dir; "0" disables disk caching entirely.
  BYTE_CACHE_DIR: z.string().default(""),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = {
  ...parsed.data,
  useMockPlaces: parsed.data.MOCK_PLACES === "1" || parsed.data.GOOGLE_PLACES_API_KEY === "",
};

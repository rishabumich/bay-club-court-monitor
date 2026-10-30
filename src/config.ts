import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { AppConfig } from "./types.js";

const locatorSchema = z.discriminatedUnion("by", [
  z.object({ by: z.literal("css"), value: z.string().min(1) }),
  z.object({ by: z.literal("role"), role: z.string().min(1), name: z.string(), exact: z.boolean().optional() }),
  z.object({ by: z.literal("text"), value: z.string(), exact: z.boolean().optional() }),
  z.object({ by: z.literal("label"), value: z.string(), exact: z.boolean().optional() }),
  z.object({ by: z.literal("placeholder"), value: z.string(), exact: z.boolean().optional() }),
  z.object({ by: z.literal("testId"), value: z.string().min(1) })
]);

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), target: locatorSchema }),
  z.object({ type: z.literal("fill"), target: locatorSchema, value: z.string() }),
  z.object({ type: z.literal("select"), target: locatorSchema, value: z.string() }),
  z.object({ type: z.literal("press"), target: locatorSchema, key: z.string().min(1) }),
  z.object({
    type: z.literal("waitFor"),
    target: locatorSchema,
    state: z.enum(["attached", "visible"]).optional(),
    timeoutMs: z.number().int().positive().optional()
  }),
  z.object({ type: z.literal("wait"), milliseconds: z.number().int().min(0).max(10000) })
]);

const fieldSchema = z.object({
  selector: z.string().min(1).optional(),
  attribute: z.string().min(1).optional(),
  regex: z.string().min(1).optional(),
  group: z.number().int().min(0).optional()
});

const watchSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]*$/i),
  name: z.string().min(1),
  url: z.string().url(),
  enabled: z.boolean().default(true),
  actions: z.array(actionSchema).default([]),
  extraction: z.object({
    itemSelector: z.string().min(1),
    availableTextRegex: z.string().optional(),
    unavailableTextRegex: z.string().optional(),
    fields: z.object({
      date: fieldSchema.optional(),
      time: fieldSchema.optional(),
      court: fieldSchema.optional(),
      location: fieldSchema.optional()
    })
  }),
  match: z.object({
    daysOfWeek: z.array(z.enum(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])).optional(),
    earliestTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    latestTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    includeTextRegex: z.string().optional(),
    excludeTextRegex: z.string().optional()
  }),
  bookingUrl: z.string().url()
});

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const bayClubSearchSchema = z.object({
  enabled: z.boolean().default(true),
  windows: z.array(z.object({
    earliestTime: timeSchema,
    latestTime: timeSchema.optional()
  })).min(1)
});

const bayClubSchema = z.object({
  clubName: z.string().min(1),
  bookingUrl: z.string().url(),
  timeZone: z.string().min(1).default("America/Los_Angeles"),
  durationMinutes: z.literal(60),
  daysOfWeek: z.array(z.enum(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])).min(1),
  singles: bayClubSearchSchema,
  ballMachine: bayClubSearchSchema
});

const configSchema = z.object({
  browser: z.object({
    loginUrl: z.string().url(),
    profileDir: z.string().min(1),
    headless: z.boolean().default(true),
    navigationTimeoutMs: z.number().int().positive().default(30000)
  }),
  pollIntervalSeconds: z.number().int().min(30).default(300),
  notificationCooldownMinutes: z.number().int().min(1).default(720),
  safety: z.object({
    blockedActionTextRegex: z.string().min(1),
    allowedActionTextRegexes: z.array(z.string()).default([])
  }),
  watches: z.array(watchSchema).default([]),
  bayClub: bayClubSchema.optional()
}).refine((value) => value.watches.length > 0 || value.bayClub, {
  message: "Configure at least one generic watch or the Bay Club preset"
});

export async function loadConfig(configPath: string): Promise<AppConfig> {
  const absolutePath = path.resolve(configPath);
  const parsed = JSON.parse(await fs.readFile(absolutePath, "utf8")) as unknown;
  const config = configSchema.parse(parsed) as AppConfig;
  config.browser.profileDir = path.resolve(path.dirname(absolutePath), config.browser.profileDir);

  for (const source of [
    config.safety.blockedActionTextRegex,
    ...config.safety.allowedActionTextRegexes,
    ...config.watches.flatMap((watch) => [
      watch.extraction.availableTextRegex,
      watch.extraction.unavailableTextRegex,
      watch.match.includeTextRegex,
      watch.match.excludeTextRegex,
      ...Object.values(watch.extraction.fields).map((field) => field?.regex)
    ])
  ]) {
    if (source) new RegExp(source, "i");
  }

  return config;
}

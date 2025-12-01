import { z } from "zod";

export const ignoredMemberNames = ["total", "bni", "visitors"];

export const mainReportRowSchema = z.object({
  memberName: z.string().min(1),
  chapter: z.string().optional(),
  period: z.coerce.date().optional(),
  p: z.coerce.number().nonnegative().default(0),
  a: z.coerce.number().nonnegative().default(0),
  l: z.coerce.number().nonnegative().default(0),
  m: z.coerce.number().nonnegative().default(0),
  s: z.coerce.number().nonnegative().default(0),
  rgi: z.coerce.number().nonnegative().default(0),
  rgo: z.coerce.number().nonnegative().default(0),
  rri: z.coerce.number().nonnegative().default(0),
  rro: z.coerce.number().nonnegative().default(0),
  v: z.coerce.number().nonnegative().default(0),
  t: z.coerce.number().nonnegative().default(0),
  oneTwoOne: z.coerce.number().nonnegative().default(0),
  tyfcb: z.coerce.number().nonnegative().default(0),
  ceu: z.coerce.number().nonnegative().default(0),
});

export type MainReportRow = z.infer<typeof mainReportRowSchema>;

export const trainingRowSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  credits: z.coerce.number().nonnegative().default(0),
});

export type TrainingRow = z.infer<typeof trainingRowSchema>;

export const dateRangeSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
});

export const memberQuerySchema = z.object({
  memberId: z.string().cuid(),
  limit: z.coerce.number().min(1).max(24).default(12),
});


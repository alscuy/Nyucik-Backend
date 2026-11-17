import { z } from "zod";

export const booleanField = z.preprocess(
  (v) => v === true || v === "true" || v === 1 || v === "1",
  z.boolean()
);

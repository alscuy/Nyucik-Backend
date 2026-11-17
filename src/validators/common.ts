import { z } from "zod";

export const booleanField = z.preprocess(
  (value) => value === true || value === "true" || value === 1 || value === "1",
  z.boolean()
);

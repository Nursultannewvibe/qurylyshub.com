import { randomBytes } from "crypto";
export const referralCode = () => randomBytes(4).toString("hex").toUpperCase();
export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9а-яёәіңғүұқөһ]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) + "-" + randomBytes(2).toString("hex");

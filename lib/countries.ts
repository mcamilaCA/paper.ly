export const COUNTRY_CODES = (
  "AR AU AT BE BR CA CL CN CO CZ DK EG FI FR DE GR HK HU IN ID IE IL IT JP KE KR MY MX NL NZ NG NO PK PE PH PL PT QA RO RU SA SG ZA ES SE CH TW TH TR UA AE GB US VN"
).split(" ");

const names = new Intl.DisplayNames(["en"], { type: "region" });
export const countryName = (c: string) => names.of(c) ?? c;
export const COUNTRIES = COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort(
  (a, b) => a.name.localeCompare(b.name),
);

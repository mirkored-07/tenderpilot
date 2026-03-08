const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "dictionaries");
const locales = ["en", "de", "it", "fr", "es"];
const requiredKeys = [
  "app.account.notice.noBillingPortalYet",
  "app.account.notice.noBillingRecordYet",
  "app.loading.title",
  "app.loading.subtitle",
  "app.loading.sessionHint",
  "app.errors.title",
  "app.errors.body",
  "app.errors.details",
  "app.errors.whatYouCanDo",
  "app.errors.cta.retry",
  "app.errors.cta.newReview",
  "app.errors.cta.openHistory",
  "app.errors.actions.retryPage",
  "app.errors.actions.refreshAfterSignIn",
  "app.errors.actions.openHistory",
  "app.metadata.actions.save",
  "app.metadata.actions.saving",
  "app.metadata.labels.contextHint",
  "app.metadata.labels.deadline",
  "app.metadata.labels.addDeadline",
  "app.metadata.labels.owner",
  "app.metadata.labels.addOwner",
  "app.metadata.labels.portal",
  "app.metadata.labels.addPortal",
  "app.metadata.labels.portalSet",
  "app.metadata.labels.unsaved",
  "app.metadata.labels.lastSaved"
];

function get(obj, key) {
  return key
    .split(".")
    .reduce(
      (acc, part) =>
        acc && Object.prototype.hasOwnProperty.call(acc, part) ? acc[part] : undefined,
      obj
    );
}

const issues = [];
for (const locale of locales) {
  const file = path.join(root, `${locale}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const key of requiredKeys) {
    const value = get(data, key);
    if (typeof value !== "string" || !value.trim()) {
      issues.push(`${locale}: missing ${key}`);
    }
  }
}

if (issues.length) {
  console.error(`Active i18n validation failed:\n${issues.join("\n")}`);
  process.exit(1);
}

console.log(`Active i18n validation passed for ${locales.length} locales.`);

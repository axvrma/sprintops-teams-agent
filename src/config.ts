import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export const config = {
  azureDevOps: {
    collectionUrl: required("AZURE_DEVOPS_COLLECTION_URL").replace(/\/$/, ""),
    project: required("AZURE_DEVOPS_PROJECT"),
    pat: required("AZURE_DEVOPS_PAT"),
    expectedFinishField: process.env.EXPECTED_FINISH_FIELD?.trim() || "Custom.ExpectedFinishDate",
    workItemTypes: (process.env.WORK_ITEM_TYPES || "User Story,Bug,Task")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    pod: {
      enabled: (process.env.POD_FILTER_ENABLED || "true").toLowerCase() !== "false",
      field: process.env.POD_FIELD?.trim() || "System.AreaPath",
      value: process.env.POD_VALUE?.trim() || "",
      matchMode: (process.env.POD_MATCH_MODE?.trim() || "contains") as
        | "contains"
        | "exact"
        | "under",
    },
    targetSprintField: process.env.TARGET_SPRINT_FIELD?.trim(),
    targetSprintValue: process.env.TARGET_SPRINT_VALUE?.trim(),
  },
  bot: {
    appId: process.env.MICROSOFT_APP_ID || "",
    appPassword: process.env.MICROSOFT_APP_PASSWORD || "",
  },
  server: {
    port: Number(process.env.PORT || 3978),
  },
  schedule: {
    dailyCron: process.env.DAILY_CRON || "30 17 * * 1-5",
    timezone: process.env.TZ || "Asia/Kolkata",
  },
  store: {
    conversationStorePath:
      process.env.CONVERSATION_STORE_PATH || ".data/conversation-reference.json",
  },
};

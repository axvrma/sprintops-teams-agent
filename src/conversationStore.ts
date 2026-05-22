import fs from "fs";
import path from "path";
import { ConversationReference } from "botbuilder";
import { config } from "./config";

export function saveConversationReference(reference: Partial<ConversationReference>) {
  const filePath = config.store.conversationStorePath;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(reference, null, 2), "utf-8");
}

export function loadConversationReference(): Partial<ConversationReference> | null {
  const filePath = config.store.conversationStorePath;
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

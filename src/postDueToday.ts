import { BotFrameworkAdapter } from "botbuilder";
import { config } from "./config";
import { postDueTodayToSubscribedConversation } from "./postDaily";

const adapter = new BotFrameworkAdapter({
  appId: config.bot.appId,
  appPassword: config.bot.appPassword,
});

adapter.onTurnError = async (_context, error) => {
  console.error("[bot error]", error);
};

async function main() {
  const result = await postDueTodayToSubscribedConversation(adapter);

  if (!result.posted) {
    process.exitCode = 1;
    return;
  }

  console.log(
    `Posted SprintOps due-today Teams card with ${result.ticketCount} ticket(s).`
  );
}

main().catch((error) => {
  console.error(error.response?.data || error.message);
  process.exit(1);
});

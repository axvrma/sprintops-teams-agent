import { BotFrameworkAdapter, MessageFactory } from "botbuilder";
import { getDueTodayTickets } from "./azureDevOps";
import { buildDueTodayCard, buildDueTodayText } from "./teamsCards";
import { loadConversationReference } from "./conversationStore";

export interface DueTodayPostResult {
  posted: boolean;
  ticketCount: number;
}

export async function postDueTodayToSubscribedConversation(
  adapter: BotFrameworkAdapter
): Promise<DueTodayPostResult> {
  const reference = loadConversationReference();

  if (!reference) {
    console.warn(
      "No conversation reference found. Send 'subscribe' to the bot in Teams first."
    );
    return { posted: false, ticketCount: 0 };
  }

  const tickets = await getDueTodayTickets();

  await adapter.continueConversation(reference as any, async (context) => {
    await context.sendActivity(MessageFactory.text(buildDueTodayText(tickets)));
    await context.sendActivity({ attachments: [buildDueTodayCard(tickets)] });
  });

  return { posted: true, ticketCount: tickets.length };
}

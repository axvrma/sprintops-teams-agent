import {
  ActivityHandler,
  MessageFactory,
  TeamsActivityHandler,
  TurnContext,
} from "botbuilder";
import { getDueTodayTickets } from "./azureDevOps";
import { buildDueTodayCard, buildDueTodayText } from "./teamsCards";
import { saveConversationReference } from "./conversationStore";

export class SprintOpsBot extends TeamsActivityHandler {
  constructor() {
    super();

    this.onMessage(async (context, next) => {
      const text = TurnContext.removeRecipientMention(context.activity)
        .toLowerCase()
        .trim();

      if (text === "subscribe") {
        const reference = TurnContext.getConversationReference(context.activity);
        saveConversationReference(reference);
        await context.sendActivity(
          "✅ Subscribed this conversation for daily SprintOps due-today posts."
        );
        await next();
        return;
      }

      if (text === "due today" || text === "show due today" || text === "today") {
        await context.sendActivity({ type: "typing" });

        const tickets = await getDueTodayTickets();

        // Text version is more searchable in Teams. Card gives quick links.
        await context.sendActivity(MessageFactory.text(buildDueTodayText(tickets)));
        await context.sendActivity({ attachments: [buildDueTodayCard(tickets)] });

        await next();
        return;
      }

      await context.sendActivity(
        [
          "I understand these commands:",
          "",
          "- `subscribe` — save this Teams conversation for daily posts",
          "- `due today` — show SprintOps tickets due today and not in QA",
        ].join("\n")
      );

      await next();
    });
  }
}

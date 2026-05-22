import {
  MessageFactory,
  TeamsActivityHandler,
  TurnContext,
} from "botbuilder";
import { getDueTodayTickets } from "./azureDevOps";
import { buildDueTodayCard, buildDueTodayText } from "./teamsCards";
import { saveConversationReference } from "./conversationStore";

function conversationLabel(context: TurnContext) {
  const type = context.activity.conversation?.conversationType;
  if (type === "groupChat") return "group chat";
  if (type === "channel") return "channel";
  if (type === "personal") return "personal chat";
  return "conversation";
}

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
          `✅ Subscribed this ${conversationLabel(
            context
          )} for SprintOps due-today posts.`
        );
        await next();
        return;
      }

      if (
        text === "due today" ||
        text === "show due today" ||
        text === "today" ||
        text === "post due today" ||
        text === "push due today" ||
        text === "run due today"
      ) {
        await context.sendActivity({ type: "typing" });

        const tickets = await getDueTodayTickets();

        // Text version is more searchable in Teams. Card gives quick links.
        await context.sendActivity(MessageFactory.text(buildDueTodayText(tickets)));
        await context.sendActivity({ attachments: [buildDueTodayCard(tickets)] });

        await next();
        return;
      }

      if (text === "help") {
        await context.sendActivity(
          [
            "I understand these commands:",
            "",
            "- `subscribe` — save this Teams group chat/channel for proactive posts",
            "- `due today` — show SprintOps tickets due today and not in QA",
            "- `post due today` — same as `due today`, useful for group chats",
          ].join("\n")
        );
        await next();
        return;
      }

      await context.sendActivity(
        [
          "I understand these commands:",
          "",
          "- `subscribe` — save this Teams group chat/channel for proactive posts",
          "- `due today` — show SprintOps tickets due today and not in QA",
        ].join("\n")
      );

      await next();
    });
  }
}

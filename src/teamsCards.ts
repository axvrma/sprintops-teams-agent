import { CardFactory } from "botbuilder";
import { DueTodayTicket } from "./types";
import { config } from "./config";

export function buildDueTodayText(tickets: DueTodayTicket[]): string {
  if (!tickets.length) {
    return `✅ No ${config.azureDevOps.pod.value} tickets are due today outside QA.`;
  }

  const grouped = tickets.reduce<Record<string, DueTodayTicket[]>>((acc, ticket) => {
    const owner = ticket.assignedTo || "Unassigned";
    acc[owner] ||= [];
    acc[owner].push(ticket);
    return acc;
  }, {});

  const lines = [
    `🚨 ${config.azureDevOps.pod.value} tickets due today and not in QA: ${tickets.length}`,
    "",
  ];

  for (const [owner, ownerTickets] of Object.entries(grouped)) {
    lines.push(`**${owner}**`);
    for (const ticket of ownerTickets) {
      lines.push(
        `- [${ticket.workItemType} ${ticket.id}](${ticket.url}) — ${ticket.title} — ${ticket.state}${ticket.pod ? ` — ${ticket.pod}` : ""}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function buildDueTodayCard(tickets: DueTodayTicket[]) {
  const facts = tickets.slice(0, 10).map((ticket) => ({
    title: `${ticket.workItemType} ${ticket.id}`,
    value: `${ticket.title}\nOwner: ${ticket.assignedTo}\nState: ${ticket.state}${ticket.pod ? `\nPOD: ${ticket.pod}` : ""}`,
  }));

  const card = {
    type: "AdaptiveCard",
    version: "1.4",
    body: [
      {
        type: "TextBlock",
        size: "Large",
        weight: "Bolder",
        text: tickets.length
          ? `${config.azureDevOps.pod.value} tickets due today outside QA: ${tickets.length}`
          : `No ${config.azureDevOps.pod.value} tickets due today outside QA`,
      },
      {
        type: "TextBlock",
        wrap: true,
        text: tickets.length
          ? "These items have Expected Finish Date as today, match the configured POD filter, and are not in QA / Resolved / Closed / Removed."
          : "Clean state. Nothing needs a due-today escalation right now.",
      },
      ...(tickets.length
        ? [
            {
              type: "FactSet",
              facts,
            },
          ]
        : []),
    ],
    actions: tickets.slice(0, 5).map((ticket) => ({
      type: "Action.OpenUrl",
      title: `${ticket.id}`,
      url: ticket.url,
    })),
  };

  return CardFactory.adaptiveCard(card);
}

import express from "express";
import cron from "node-cron";
import { BotFrameworkAdapter } from "botbuilder";
import { config } from "./config";
import { SprintOpsBot } from "./bot";
import { postDueTodayToSubscribedConversation } from "./postDaily";

const app = express();
app.use(express.json());

const adapter = new BotFrameworkAdapter({
  appId: config.bot.appId,
  appPassword: config.bot.appPassword,
});

adapter.onTurnError = async (context, error) => {
  console.error("[bot error]", error);
  await context.sendActivity("Something broke while processing this request.");
};

const bot = new SprintOpsBot();

app.post("/api/messages", async (req, res) => {
  await adapter.processActivity(req, res, async (context) => {
    await bot.run(context);
  });
});

app.post("/api/run-daily", async (_req, res) => {
  try {
    await postDueTodayToSubscribedConversation(adapter);
    res.status(200).send({ ok: true });
  } catch (error: any) {
    console.error(error);
    res.status(500).send({ ok: false, error: error.message });
  }
});

cron.schedule(
  config.schedule.dailyCron,
  async () => {
    try {
      console.log("Running scheduled SprintOps due-today post...");
      await postDueTodayToSubscribedConversation(adapter);
    } catch (error) {
      console.error("Scheduled post failed", error);
    }
  },
  {
    timezone: config.schedule.timezone,
  }
);

app.listen(config.server.port, () => {
  console.log(`SprintOps Teams Agent running on port ${config.server.port}`);
  console.log(`Bot endpoint: /api/messages`);
});

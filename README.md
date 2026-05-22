# SprintOps Teams Agent

Phase 1 MVP for posting Azure DevOps due-today tickets into Microsoft Teams.

## What it does

- Reads Azure DevOps work items
- Finds tickets where `Expected Finish Date` is today
- Filters tickets by POD, for example `Sample_POD`
- Excludes tickets already in `QA`, `Resolved`, `Closed`, or `Removed`
- Posts the list in Teams through:
  - bot command
  - group chat proactive post
  - scheduled daily post

## Important

Do not paste your PAT in chat or commit it to Git.

Keep secrets only in local `.env`.

---

## Setup

```bash
npm install
cp .env.example .env
```

Update `.env`:

```env
AZURE_DEVOPS_COLLECTION_URL=base_url
AZURE_DEVOPS_PROJECT=project_name
AZURE_DEVOPS_PAT=your_pat

MICROSOFT_APP_ID=your_bot_app_id
MICROSOFT_APP_PASSWORD=your_bot_password
```

`MICROSOFT_APP_ID` is the Azure Bot app/client ID. The same ID is used in
the Teams app manifest unless you set `TEAMS_APP_ID`.

---

## Azure DevOps config

### Expected Finish Date field

Default:

```env
EXPECTED_FINISH_FIELD=Custom.ExpectedFinishDate
```

To confirm the correct field reference name:

```bash
npm run fields
```

Look for `Expected Finish Date`.

If the reference name is different, update:

```env
EXPECTED_FINISH_FIELD=Custom.YourExpectedFinishDateField
```

---

## POD filter

The bot supports configurable POD filtering.

For Sample_POD, use:

```env
POD_FILTER_ENABLED=true
POD_FIELD=Custom.POD
POD_VALUE=Sample_POD
POD_MATCH_MODE=exact
```

This generates a WIQL condition like:

```sql
AND [Custom.POD] = 'Sample_POD'
```

### Match modes

| Mode       | Use when                                  | Behavior                            |
| ---------- | ----------------------------------------- | ----------------------------------- |
| `exact`    | POD field value exactly matches           | Adds WIQL `=` condition             |
| `contains` | Field value may contain extra text        | Fetches items, then filters in code |
| `under`    | POD is represented by Area Path hierarchy | Uses WIQL `UNDER`                   |

---

## Target sprint filter

The bot can optionally filter tickets by target sprint.

Example:

```env
TARGET_SPRINT_FIELD=Custom.TargetSprint
TARGET_SPRINT_VALUE=May H2 (26)
```

This generates a WIQL condition like:

```sql
AND [Custom.TargetSprint] = 'May H2 (26)'
```

If you do not want sprint filtering, leave these values empty:

```env
TARGET_SPRINT_FIELD=
TARGET_SPRINT_VALUE=
```

---

## Recommended config for current setup

```env
AZURE_DEVOPS_COLLECTION_URL=base_url
AZURE_DEVOPS_PROJECT=project_name
AZURE_DEVOPS_PAT=your_pat

EXPECTED_FINISH_FIELD=Custom.ExpectedFinishDate

POD_FILTER_ENABLED=true
POD_FIELD=Custom.POD
POD_VALUE=Sample_POD
POD_MATCH_MODE=exact

TARGET_SPRINT_FIELD=Custom.TargetSprint
TARGET_SPRINT_VALUE=May H2 (26)

DAILY_CRON=30 17 * * 1-5
TZ=Asia/Kolkata
```

This pulls tickets where:

```sql
[System.TeamProject] = 'project_name'
AND [Custom.POD] = 'Sample_POD'
AND [System.State] NOT IN ('QA','Resolved','Closed','Removed')
AND [Custom.ExpectedFinishDate] = today
AND [Custom.TargetSprint] = 'May H2 (26)'
```

---

## Test Azure DevOps query without Teams

```bash
npm run due-today
```

This prints the WIQL query and the matching work item IDs.

---

## Run bot locally

```bash
npm run dev
```

Expose local endpoint using Dev Tunnel or ngrok:

```bash
ngrok http 3978
```

Bot messaging endpoint:

```txt
https://your-public-url/api/messages
```

Use this endpoint in the Azure Bot configuration.

---

## Build and install the Teams app

Generate the Teams app zip after `MICROSOFT_APP_ID` is set:

```bash
npm run teams:package
```

This creates:

```txt
dist/teams-app/SprintOpsTeamsAgent.zip
```

In Microsoft Teams:

1. Open the target group chat.
2. Add an app / upload a custom app.
3. Select `dist/teams-app/SprintOpsTeamsAgent.zip`.
4. Mention the bot and send:

```txt
@SprintOps subscribe
```

That stores the group chat conversation reference locally at
`CONVERSATION_STORE_PATH`. Proactive posts use that saved reference.

---

## Teams commands

```txt
subscribe
due today
post due today
help
```

Use `subscribe` once in the Teams group chat or channel where the bot should
post daily updates.

Then test:

```txt
due today
```

---

## Push the due-today card on demand

After the group chat has subscribed, run:

```bash
npm run teams:post-due-today
```

This fetches the same data as:

```bash
npm run due-today
```

and posts it as Teams text plus an Adaptive Card in the subscribed group chat.

You can also trigger the same push through the running web app:

```bash
curl -X POST http://localhost:3978/api/run-daily
```

---

## Daily scheduled post

Default schedule:

```env
DAILY_CRON=30 17 * * 1-5
TZ=Asia/Kolkata
```

This posts every weekday at 5:30 PM IST.

For production reliability, prefer Azure Functions, Azure Container Apps job, or a proper background worker instead of local `node-cron`.

---

## Production hosting idea

Recommended options:

1. Azure App Service
2. Azure Container Apps
3. Azure Function with Timer Trigger

For the cleanest setup:

* Bot API hosted on Azure App Service or Container Apps
* Scheduler handled by Azure Function Timer Trigger
* Secrets stored in Azure Key Vault or App Settings

---

## Debug checklist

If no tickets are shown but Azure DevOps has matching work items:

1. Check `EXPECTED_FINISH_FIELD`
2. Check `POD_FIELD`
3. Check `POD_VALUE`
4. Check `TARGET_SPRINT_FIELD`
5. Check `TARGET_SPRINT_VALUE`
6. Check excluded states
7. Check date format in WIQL
8. Run:

```bash
npm run due-today
```

9. Confirm the generated WIQL manually in Azure DevOps query editor

---

## Current Phase 1 scope

Included:

* Due-today tickets
* POD filter
* Target sprint filter
* State exclusion
* Teams command response
* Teams group chat app package
* Manual proactive post command
* Scheduled channel post

Not included yet:

* Personal DM reminders
* User mentions
* AI summary
* Sprint risk scoring
* Overdue/stale/unassigned commands

---

## Example WIQL output

The generated query should look similar to this:

```sql
SELECT [System.Id]
FROM WorkItems
WHERE
  [System.TeamProject] = 'DTLP'
  AND [Custom.POD] = 'Sample_POD'
  AND [System.State] NOT IN ('QA','Resolved','Closed','Removed')
  AND [Custom.ExpectedFinishDate] = '2026-05-22T00:00:00.0000000'
  AND [Custom.TargetSprint] = 'May H2 (26)'
ORDER BY [System.AssignedTo], [System.Id]
```

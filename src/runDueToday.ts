import { getDueTodayTickets } from "./azureDevOps";
import { buildDueTodayText } from "./teamsCards";

async function main() {
  const tickets = await getDueTodayTickets();
  console.log(buildDueTodayText(tickets));
}

main().catch((error) => {
  console.error(error.response?.data || error.message);
  process.exit(1);
});

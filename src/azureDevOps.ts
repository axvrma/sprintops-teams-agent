import axios from "axios";
import { config } from "./config";
import { DueTodayTicket, WorkItem } from "./types";

const apiVersion = "7.1";

function authHeader() {
  const token = Buffer.from(`:${config.azureDevOps.pat}`).toString("base64");
  return {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
  };
}

function projectBaseUrl() {
  const project = encodeURIComponent(config.azureDevOps.project);
  return `${config.azureDevOps.collectionUrl}/${project}`;
}

function escapeWiqlValue(value: string) {
  return value.replace(/'/g, "''");
}

function getPodWiqlClause() {
  const pod = config.azureDevOps.pod;
  if (!pod.enabled || !pod.value) return "";
  const escapedValue = escapeWiqlValue(pod.value);
  // If field is AreaPath, allow UNDER/EXACT/CONTAINS, else always use =
  if (pod.field === "System.AreaPath") {
    if (pod.matchMode === "under") {
      return `AND [${pod.field}] UNDER '${escapedValue}'`;
    }
    if (pod.matchMode === "exact") {
      return `AND [${pod.field}] = '${escapedValue}'`;
    }
    // For contains, post-filter in code
    return "";
  } else {
    // For custom fields, always use =
    return `AND [${pod.field}] = '${escapedValue}'`;
  }
}

function matchesPodFilter(fields: Record<string, any>) {
  const pod = config.azureDevOps.pod;

  if (!pod.enabled || !pod.value) return true;

  const rawValue = fields[pod.field];
  const fieldValue =
    typeof rawValue === "string"
      ? rawValue
      : rawValue?.displayName || rawValue?.uniqueName || String(rawValue || "");

  if (!fieldValue) return false;

  const actual = fieldValue.toLowerCase();
  const expected = pod.value.toLowerCase();

  if (pod.matchMode === "exact") {
    return actual === expected;
  }

  // For both contains and under, use contains as a defensive second check.
  return actual.includes(expected);
}

export async function listFields() {
  const url = `${config.azureDevOps.collectionUrl}/_apis/wit/fields?api-version=${apiVersion}`;
  const response = await axios.get(url, { headers: authHeader() });
  return response.data.value as Array<{
    name: string;
    referenceName: string;
    type: string;
    readOnly?: boolean;
  }>;
}

export async function findFieldByName(searchText: string) {
  const fields = await listFields();
  const needle = searchText.toLowerCase();

  return fields.filter((field) => {
    return (
      field.name.toLowerCase().includes(needle) ||
      field.referenceName.toLowerCase().includes(needle)
    );
  });
}

export async function queryWorkItemIdsDueToday(): Promise<number[]> {
  const excludedStates = ["QA", "Resolved", "Closed", "Removed"];
  const podClause = getPodWiqlClause();

  const dateStr = new Date().toISOString().slice(0, 10)

  let clauses = [
    `[System.TeamProject] = '${process.env.AZURE_DEVOPS_PROJECT}'`,
    `[Custom.POD] = '${process.env.POD_VALUE}'`,
    `[System.State] NOT IN ('${excludedStates.join("','")}')`,
    `[${config.azureDevOps.expectedFinishField}] = '${dateStr}T00:00:00.0000000'`,
  ];
  if (podClause.trim()) {
    clauses.push(podClause.replace(/^AND /, ""));
  }
  if (config.azureDevOps.targetSprintField && config.azureDevOps.targetSprintValue) {
    clauses.push(`[${config.azureDevOps.targetSprintField}] = '${escapeWiqlValue(config.azureDevOps.targetSprintValue)}'`);
  }

  const wiql = `
    SELECT [System.Id]
    FROM WorkItems
    WHERE
      ${clauses.join("\n      AND ")}
    ORDER BY [System.AssignedTo], [System.Id]
  `;

  const url = `${projectBaseUrl()}/_apis/wit/wiql?api-version=${apiVersion}`;
  const response = await axios.post(url, { query: wiql }, { headers: authHeader() });

  return (response.data.workItems || []).map((item: { id: number }) => item.id);
}

export async function fetchWorkItems(ids: number[]): Promise<WorkItem[]> {
  if (!ids.length) return [];

  const fields = Array.from(
    new Set([
      "System.Id",
      "System.Title",
      "System.State",
      "System.AssignedTo",
      "System.WorkItemType",
      "System.ChangedDate",
      config.azureDevOps.expectedFinishField,
      config.azureDevOps.pod.field,
    ])
  );

  const url =
    `${projectBaseUrl()}/_apis/wit/workitems` +
    `?ids=${ids.join(",")}` +
    `&fields=${fields.map(encodeURIComponent).join(",")}` +
    `&api-version=${apiVersion}`;

  const response = await axios.get(url, { headers: authHeader() });
  return response.data.value as WorkItem[];
}

export async function getDueTodayTickets(): Promise<DueTodayTicket[]> {
  const ids = await queryWorkItemIdsDueToday();
  const items = await fetchWorkItems(ids);

  const excludedStates = new Set(["QA", "Resolved", "Closed", "Removed"]);

  return items
    .map((item) => {
      const fields = item.fields;
      const assignedTo = fields["System.AssignedTo"];
      const expectedFinishDateRaw = fields[config.azureDevOps.expectedFinishField];
      const podRawValue = fields[config.azureDevOps.pod.field];
      const podValue =
        typeof podRawValue === "string"
          ? podRawValue
          : podRawValue?.displayName || podRawValue?.uniqueName || "-";

      return {
        id: item.id,
        title: fields["System.Title"] || "-",
        state: fields["System.State"] || "-",
        assignedTo:
          assignedTo?.displayName ||
          assignedTo?.uniqueName ||
          "Unassigned",
        expectedFinishDate: expectedFinishDateRaw || "",
        url: `${config.azureDevOps.collectionUrl}/${encodeURIComponent(
          config.azureDevOps.project
        )}/_workitems/edit/${item.id}`,
        workItemType: fields["System.WorkItemType"] || "-",
        changedDate: fields["System.ChangedDate"],
        pod: podValue,
      };
    })
    .filter((ticket) => !excludedStates.has(ticket.state));
}

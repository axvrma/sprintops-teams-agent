export interface WorkItemIdentity {
  displayName?: string;
  uniqueName?: string;
  id?: string;
}

export interface WorkItem {
  id: number;
  url: string;
  fields: Record<string, any>;
}

export interface DueTodayTicket {
  id: number;
  title: string;
  state: string;
  assignedTo: string;
  expectedFinishDate: string;
  url: string;
  workItemType: string;
  changedDate?: string;
  pod?: string;
}

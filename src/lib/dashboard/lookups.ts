export interface ActorEntry {
  id: string;
  displayName: string | null;
  email: string | null;
}

export interface GoalEntry {
  id: string;
  name: string;
  index: number;
}

export interface DashboardLookups {
  actors: Record<string, ActorEntry>;
  goals: Record<string, GoalEntry>;
  todayIso: string;
}

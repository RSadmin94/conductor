export type ProjectState = 
  | 'Idea' 
  | 'Feasibility' 
  | 'Approved' 
  | 'Planning' 
  | 'Execution' 
  | 'Review' 
  | 'Release' 
  | 'Rejected' 
  | 'Error' 
  | 'ReviewFailed';

export const ALLOWED_TRANSITIONS: Record<ProjectState, ProjectState[]> = {
  Idea: ['Feasibility'],
  Feasibility: ['Approved', 'Rejected', 'Error'],
  Approved: ['Planning'],
  Planning: ['Execution', 'Error'],
  Execution: ['Review', 'Execution', 'Error'],
  Review: ['Release', 'ReviewFailed'],
  Release: [],
  Rejected: [],
  Error: [],
  ReviewFailed: [],
};

export function canTransition(from: ProjectState, to: ProjectState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validateTransition(from: ProjectState, to: ProjectState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid state transition: ${from} → ${to}`);
  }
}


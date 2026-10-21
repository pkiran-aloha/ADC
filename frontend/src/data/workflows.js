// The workspace is presented as a small set of naturally occurring workflows. Each
// workflow gathers the screens that belong to one job (review progress, analyze a target,
// read behavior context, verify care quality, share results) so the page is never one
// endless dump of every panel at once.
import { ChartLineUp, Target, Notebook, ShieldAlert, FileText, Book } from '../components/ui/Icons';

export const WORKFLOWS = [
  {
    id: 'overview',
    label: 'Progress overview',
    icon: ChartLineUp,
    summary: 'Where the learner stands today'
  },
  {
    id: 'target-analysis',
    label: 'Target analysis',
    icon: Target,
    summary: 'Graphs, trends and the trials behind each point'
  },
  {
    id: 'abc-observations',
    label: 'ABC observations',
    icon: Notebook,
    summary: 'What happens before, during and after each behavior'
  },
  {
    id: 'service-quality',
    label: 'Service & data quality',
    icon: ShieldAlert,
    summary: 'Dosage, attendance, IOA, fidelity and supervision'
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileText,
    summary: 'Print-ready documents and the target roster'
  },
  {
    id: 'documentation',
    label: 'Documentation',
    icon: Book,
    summary: 'Platform wiki, tech stack and reference'
  }
];

export const WORKFLOW_IDS = WORKFLOWS.map(workflow => workflow.id);

// Hashes double as deep links (#reports opens that workflow) and keep the sidebar's
// anchor destinations meaningful.
export function workflowFromHash(hash = '') {
  const id = String(hash || '').replace(/^#/, '');
  return WORKFLOW_IDS.includes(id) ? id : null;
}

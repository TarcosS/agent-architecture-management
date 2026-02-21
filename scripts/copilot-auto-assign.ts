import * as core from '@actions/core';
import * as github from '@actions/github';

const COPILOT_BOT = 'copilot-swe-agent[bot]';
const MAX_INSTRUCTIONS_CHARS = 1200;

function lineValue(body: string, key: string): string {
  const re = new RegExp(`^\\s*${key}\\s*:\\s*(.+)\\s*$`, 'im');
  const m = body.match(re);
  return m?.[1]?.trim() || '';
}

function sectionValue(body: string, heading: string, stopAt: string[]): string {
  const normalized = body.replace(/\r\n/g, '\n');
  const startRe = new RegExp(`^\\s*${heading}\\s*$`, 'im');
  const start = normalized.search(startRe);
  if (start < 0) return '';

  const afterStart = normalized.slice(start);
  const firstNl = afterStart.indexOf('\n');
  if (firstNl < 0) return '';

  const content = afterStart.slice(firstNl + 1);
  let endIdx = content.length;

  for (const h of stopAt) {
    const endRe = new RegExp(`^\\s*${h}\\s*$`, 'im');
    const idx = content.search(endRe);
    if (idx >= 0 && idx < endIdx) endIdx = idx;
  }

  return content.slice(0, endIdx).trim();
}

function compact(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function normalizeAgent(raw: string): string {
  return raw.toLowerCase().replace(/[`'"\s]/g, '');
}

function normalizeModel(raw: string): string {
  return raw.replace(/^['"]|['"]$/g, '').trim();
}

async function commentMissingOwner(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issue_number: number,
): Promise<void> {
  const body = [
    'Copilot auto-assign skipped: `Owner-Agent:` was not found in the issue body.',
    '',
    'Please include at least these fields:',
    '- `Parent:`',
    '- `Owner-Agent: <architect|pm|designer|process|swe|qa|devops|security>`',
    '- `Gate:`',
    '- `Dependencies:`',
    '',
    'After editing the body, the workflow will retry on `issues.edited`.',
  ].join('\n');

  await octokit.rest.issues.createComment({ owner, repo, issue_number, body });
}

async function commentTroubleshooting(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issue_number: number,
  status: number,
  message: string,
): Promise<void> {
  const body = [
    `Copilot auto-assign failed with HTTP ${status}.`,
    '',
    `Error: ${message}`,
    '',
    'Troubleshooting:',
    '- Ensure Copilot coding agent is enabled for this repository.',
    '- Ensure `COPILOT_ASSIGN_TOKEN` is configured and valid.',
    '- Required token permissions: Issues (Read and write), Contents (Read), Pull requests (Read and write recommended).',
    '- Confirm `.github/agents/*.agent.md` contains the requested custom agent name.',
    '- Verify the issue body includes `Owner-Agent:`.',
  ].join('\n');

  await octokit.rest.issues.createComment({ owner, repo, issue_number, body });
}

async function commentNoPrMode(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string,
  issue_number: number,
  customAgent: string,
): Promise<void> {
  const body = [
    `Copilot auto-assign skipped for \`${customAgent}\` due to single-PR policy.`,
    '',
    'Repository is currently in integration PR mode:',
    '- Only `Owner-Agent: architect` is auto-assigned to Copilot coding agent.',
    '- Child/sub issues should proceed as planning and review artifacts in issue comments/docs.',
    '- Architect owns the single stakeholder-visible integration PR.',
  ].join('\n');

  await octokit.rest.issues.createComment({ owner, repo, issue_number, body });
}

async function run(): Promise<void> {
  const token = (process.env.COPILOT_ASSIGN_TOKEN || '').trim();
  if (!token) {
    core.setFailed('Missing token. Configure COPILOT_ASSIGN_TOKEN or COPILOT_MCP_GITHUB_PERSONAL_ACCESS_TOKEN.');
    return;
  }

  const payload = github.context.payload as Record<string, any>;
  const issue = payload.issue;
  if (!issue) {
    core.info('No issue in payload. Skipping.');
    return;
  }

  const action = String(payload.action || '');
  const editedBodyChanged = Boolean(payload.changes?.body);
  const labeledName = String(payload.label?.name || '');

  if (action === 'edited' && !editedBodyChanged) {
    core.info('Issue edited without body change. Skipping.');
    return;
  }

  if (action === 'labeled' && labeledName.toLowerCase() !== 'aa') {
    core.info(`Label event is '${labeledName}', not 'aa'. Skipping.`);
    return;
  }

  const eventDefaultBranch = String(payload.repository?.default_branch || 'main');
  const refName = process.env.GITHUB_REF_NAME || github.context.ref.replace('refs/heads/', '');
  if (refName && refName !== eventDefaultBranch) {
    core.info(`Workflow running on '${refName}', default branch is '${eventDefaultBranch}'. Skipping.`);
    return;
  }

  if (Boolean(payload.repository?.fork)) {
    core.info('Repository is a fork. Skipping.');
    return;
  }

  const { owner, repo } = github.context.repo;
  const issueNumber = Number(issue.number);
  const body = String(issue.body || '');

  const ownerAgentRaw = lineValue(body, 'Owner-Agent');
  if (!ownerAgentRaw) {
    const octokit = github.getOctokit(token);
    await commentMissingOwner(octokit, owner, repo, issueNumber);
    core.info('Skipped assignment due to missing Owner-Agent.');
    return;
  }

  const customAgent = normalizeAgent(ownerAgentRaw);
  const forcedModelRaw = normalizeModel(process.env.COPILOT_ASSIGN_FORCE_MODEL || '');
  const modelRaw = lineValue(body, 'Model');
  const model = forcedModelRaw || (modelRaw ? normalizeModel(modelRaw) : '');
  const onlyArchitectMode = (process.env.COPILOT_ASSIGN_ONLY_ARCHITECT || 'true').trim().toLowerCase() !== 'false';

  const gate = lineValue(body, 'Gate') || 'None';
  const dependencies = lineValue(body, 'Dependencies') || 'None';
  const parent = lineValue(body, 'Parent') || 'None';
  const task = compact(sectionValue(body, 'Task', ['Deliverables']));
  const deliverables = compact(sectionValue(body, 'Deliverables', []));

  const instructionParts = [
    `Assign to custom agent: ${customAgent}.`,
    `Gate: ${gate}.`,
    `Dependencies: ${dependencies}.`,
    `Parent: ${parent}.`,
    'No code changes under /apps/web - docs only.',
    'Single-PR policy: only architect may open/update the integration PR.',
    customAgent === 'architect'
      ? 'Architect mode: delegate role-owned artifacts to child agents; do not directly execute PM/SWE/QA/DEVOPS/SECURITY/DESIGNER deliverables.'
      : '',
    task ? `Task: ${task}.` : '',
    deliverables ? `Deliverables: ${deliverables}.` : '',
  ].filter(Boolean);

  const customInstructions = truncate(compact(instructionParts.join(' ')), MAX_INSTRUCTIONS_CHARS);

  const assignees = (issue.assignees || []) as Array<{ login?: string }>;
  if (assignees.some((a) => (a.login || '').toLowerCase() === COPILOT_BOT.toLowerCase())) {
    core.info('Issue already assigned to copilot-swe-agent[bot]; continuing to enforce custom agent assignment.');
    core.info(`Requested custom_agent=${customAgent}, model=${model || '(omitted)'}; sending assignment payload again.`);
  }

  const octokit = github.getOctokit(token);

  if (onlyArchitectMode && customAgent !== 'architect') {
    core.info(`Skipping assignment for custom_agent=${customAgent} because COPILOT_ASSIGN_ONLY_ARCHITECT is enabled.`);
    await commentNoPrMode(octokit, owner, repo, issueNumber, customAgent);
    return;
  }

  let baseBranch = eventDefaultBranch || 'main';
  try {
    const repoResp = await octokit.rest.repos.get({ owner, repo });
    baseBranch = repoResp.data.default_branch || baseBranch;
  } catch (err) {
    core.warning(`Could not fetch repo default branch; using fallback '${baseBranch}'.`);
  }

  core.info(`Attempting assignment: issue=#${issueNumber} custom_agent=${customAgent} model=${model || '(omitted)'} base_branch=${baseBranch}`);

  const agentAssignment: Record<string, string> = {
    target_repo: `${owner}/${repo}`,
    base_branch: baseBranch,
    custom_instructions: customInstructions,
    custom_agent: customAgent,
  };
  if (model) {
    agentAssignment.model = model;
  }

  try {
    await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/assignees', {
      owner,
      repo,
      issue_number: issueNumber,
      assignees: [COPILOT_BOT],
      agent_assignment: agentAssignment,
      headers: {
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
    });

    core.info(`Copilot assignment request sent successfully. custom_agent=${customAgent}, model=${model || '(omitted)'}`);
  } catch (e: any) {
    const status = Number(e?.status || 0);
    const message = String(e?.message || 'Unknown error');
    core.error(`Assignment failed: status=${status}, message=${message}`);

    if (status === 403 || status === 404) {
      await commentTroubleshooting(octokit, owner, repo, issueNumber, status, message);
    }

    core.setFailed(`Copilot auto-assign failed with status=${status}.`);
  }
}

run().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  core.setFailed(`Unhandled error: ${msg}`);
});

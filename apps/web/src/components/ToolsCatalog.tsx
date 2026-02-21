import { useState } from 'react';
import { tools, issueTools, CATEGORY_LABELS, type Tool } from '../data/tools';
import './ToolsCatalog.css';

type FilterMode = 'all' | 'issue';

const OPERATION_COLORS: Record<string, string> = {
  create: 'op-create',
  update: 'op-update',
  delete: 'op-delete',
  read: 'op-read',
  merge: 'op-merge',
  comment: 'op-comment',
  assign: 'op-assign',
  submit: 'op-create',
  add: 'op-create',
  remove: 'op-delete',
  reprioritize: 'op-update',
};

function ToolCard({ tool }: { tool: Tool }) {
  const isIssueTool = tool.creates_issues || tool.updates_issues;

  return (
    <div className={`tool-card${isIssueTool ? ' tool-card--issue' : ''}`}>
      <div className="tool-card__header">
        <span className="tool-card__name">{tool.name}</span>
        {tool.creates_issues && (
          <span className="tool-badge tool-badge--creates">creates issues</span>
        )}
        {tool.updates_issues && (
          <span className="tool-badge tool-badge--updates">updates issues</span>
        )}
      </div>
      <p className="tool-card__description">{tool.description}</p>
      <div className="tool-card__ops">
        {tool.operations.map((op) => (
          <span key={op} className={`op-tag ${OPERATION_COLORS[op] ?? 'op-unknown'}`}>
            {op}
          </span>
        ))}
      </div>
      <code className="tool-card__id">{tool.id}</code>
    </div>
  );
}

export default function ToolsCatalog() {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');

  const baseList = filter === 'issue' ? issueTools : tools;

  const visible = search.trim()
    ? baseList.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase()) ||
          t.id.toLowerCase().includes(search.toLowerCase()),
      )
    : baseList;

  const byCategory = visible.reduce<Record<string, Tool[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="catalog">
      <header className="catalog__header">
        <h1 className="catalog__title">Available Agent Tools</h1>
        <p className="catalog__subtitle">
          {tools.length} tools total &middot;{' '}
          <span className="catalog__subtitle--highlight">
            {issueTools.length} issue-create/update tools
          </span>
        </p>
      </header>

      <div className="catalog__controls">
        <div className="catalog__filters">
          <button
            className={`filter-btn${filter === 'all' ? ' filter-btn--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All tools ({tools.length})
          </button>
          <button
            className={`filter-btn filter-btn--issue${filter === 'issue' ? ' filter-btn--active' : ''}`}
            onClick={() => setFilter('issue')}
          >
            Issue create/update ({issueTools.length})
          </button>
        </div>
        <input
          className="catalog__search"
          type="search"
          placeholder="Search tools…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {Object.keys(byCategory).length === 0 && (
        <p className="catalog__empty">No tools match your search.</p>
      )}

      {Object.entries(byCategory).map(([cat, catTools]) => (
        <section key={cat} className="catalog__section">
          <h2 className="catalog__section-title">
            {CATEGORY_LABELS[cat] ?? cat}
            <span className="catalog__section-count">{catTools.length}</span>
          </h2>
          <div className="catalog__grid">
            {catTools.map((t) => (
              <ToolCard key={t.id} tool={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

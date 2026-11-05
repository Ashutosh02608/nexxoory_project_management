import React, { useState } from 'react';
import { useApp } from '../context/useApp';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, SlidersHorizontal, Search, CalendarDays, Layers3, CheckCircle2, Clock3, X, Check, Loader2 } from 'lucide-react';
import './ContentSchedule.css';
import { format } from '../utils/dateHelpers';
import { contentTypes, projectTypes, getTaskTypesForProjectType, deliverySchedules, getAllowedDeliveryCategories } from '../../shared/serviceTypes';
import { isSocialProject, deliveryUnits, deliveryTarget, getMonthlyProjectStats, getProjectDeliverables, SOCIAL_DELIVERABLE_TYPES } from '../../shared/delivery';

const options = {
  contentType: contentTypes,
  projectType: ['Other', ...projectTypes.filter(type => type !== 'Other')],
  deliverySchedule: deliverySchedules,
  deliveryCategory: ['Monthly Deliverable', 'One-Time Deliverable'],
  designStatus: ['Not Started', 'In Progress', 'In Review', 'Changes Requested', 'Completed'],
  approvalStatus: ['Pending', 'Approved', 'Changes Requested'],
  postStatus: ['Not Scheduled', 'Scheduled', 'Published', 'Cancelled'],
};
const projectFields = [
  ['projectType', 'Project type'],
  ['deliverySchedule', 'Delivery schedule'],
  ['clientName', 'Client name'],
  ['contractStart', 'Contract start', 'date'],
  ['contractEnd', 'Contract end', 'date'],
  ['postTarget', 'Monthly posts', 'number'],
  ['reelTarget', 'Monthly reels', 'number'],
  ['aiReelTarget', 'Monthly AI reels', 'number'],
  ['serviceTarget', 'Monthly deliverables', 'number'],
  ['oneTimeTarget', 'One-time target deliverables', 'number'],
  ['brief', 'Shared project brief'],
  ['internalNotes', 'Internal contract notes']
];
const taskFields = [
  ['contentType', 'Task Type'],
  ['deliveryCategory', 'Delivery Category'],
  ['designStatus', 'Status'],
  ['designDate', 'Design completed', 'date'],
  ['approvalStatus', 'Approval'],
  ['feedback', 'Review feedback'],
  ['postDate', 'Planned publication', 'date'],
  ['postStatus', 'Publishing status'],
  ['publishedDate', 'Published date', 'date']
];

export function ContentFields({ value = {}, onChange, project = false, member = false, projectType = '', deliverySchedule = '' }) {
  const allowedTaskTypes = getTaskTypesForProjectType(projectType || value.projectType);
  const allowedCategories = getAllowedDeliveryCategories(deliverySchedule || value.deliverySchedule);
  const sched = value.deliverySchedule || 'Monthly Deliverables';

  const groups = project
    ? [
        ['Client & contract', 'The service, client and period covered by this engagement.', ['projectType', 'deliverySchedule', 'clientName', 'contractStart', 'contractEnd']],
        ['Deliverable targets', 'Set recurring monthly commitments or fixed one-time targets.', ['postTarget', 'reelTarget', 'aiReelTarget', 'serviceTarget', 'oneTimeTarget']],
        ['Brief & notes', 'Share direction with your team. Contract notes stay private to managers.', ['brief', 'internalNotes']]
      ]
    : [
        ['Deliverable setup', 'Category and handoff tracking.', ['contentType', 'deliveryCategory', 'designStatus', 'designDate']],
        ['Review & approval', 'Record feedback before scheduling publication.', ['approvalStatus', 'feedback']],
        ['Publication', 'Keep planned and actual publication dates separate.', ['postStatus', 'postDate', 'publishedDate']]
      ];

  return <div className="content-fields">{groups.map(([heading, hint, keys]) => {
    let visibleKeys = keys;
    if (project && heading === 'Deliverable targets') {
      if (sched === 'One-Time Deliverables') {
        visibleKeys = ['oneTimeTarget'];
      } else if (sched === 'Both') {
        visibleKeys = isSocialProject(value) ? ['postTarget', 'reelTarget', 'aiReelTarget', 'oneTimeTarget'] : ['serviceTarget', 'oneTimeTarget'];
      } else {
        visibleKeys = isSocialProject(value) ? ['postTarget', 'reelTarget', 'aiReelTarget'] : ['serviceTarget'];
      }
    }

    const fields = (project ? projectFields : taskFields).filter(([key]) => visibleKeys.includes(key) && (!member || ['designStatus', 'designDate'].includes(key)));
    if (!fields.length) return null;
    return <fieldset key={heading}><legend>{heading}</legend><p>{project && heading === 'Deliverable targets' && !isSocialProject(value) && sched !== 'One-Time Deliverables' ? `Set the monthly target for ${deliveryUnits[value.projectType] || 'deliverables'}. Completed tasks count in their completion month.` : hint}</p><div className={`content-field-grid ${heading === 'Deliverable targets' ? 'content-targets' : ''}`}>{fields.map(([key, label, type]) => {
      const selectOptions = key === 'contentType' && !project
        ? allowedTaskTypes
        : key === 'deliveryCategory' && !project
        ? allowedCategories
        : options[key];
      return <label key={key} className={['clientName', 'brief', 'internalNotes', 'feedback'].includes(key) ? 'content-field-wide' : ''}>{label}{key === 'internalNotes' && <span className="content-private">Private</span>}
      {selectOptions ? <select value={value[key] || selectOptions[0]} onChange={e => onChange({ ...value, [key]: e.target.value })}>{selectOptions.map(item => <option key={item}>{item}</option>)}</select>
        : ['brief', 'internalNotes', 'feedback'].includes(key) ? <textarea rows={3} placeholder={key === 'internalNotes' ? 'Contract terms or internal context…' : key === 'feedback' ? 'What needs to change or what was approved?' : 'Goals, audience, tone, and creative direction…'} value={value[key] ?? ''} onChange={e => onChange({ ...value, [key]: e.target.value })} />
          : <input type={type || 'text'} min={type === 'number' ? 0 : undefined} placeholder={type === 'number' ? '0' : key === 'clientName' ? 'Enter client or contact name' : undefined} value={value[key] ?? ''} onChange={e => onChange({ ...value, [key]: type === 'number' ? Number(e.target.value) : e.target.value })} />}
    </label>;
    })}</div></fieldset>;
  })}</div>;
}

export default function ContentSchedule({
  projectMode = false,
  searchTerm = '',
  externalFilters = null,
  onAdvancedFilterChange = null,
  hideSearch = false,
  hideToolbar = false,
  externalMonth = null,
  externalEditing = undefined,
  onCloseExternalEditing = null
}) {
  const { projects, tasks, users, currentUser, updateTask, updateProject } = useApp();
  const [params] = useSearchParams();
  const [internalMonth, setInternalMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const month = externalMonth !== null && externalMonth !== undefined ? externalMonth : internalMonth;
  const setMonth = setInternalMonth;
  const project = params.get('projectId') || '';
  const [type, setType] = useState(() => externalFilters?.type || '');
  const [designer, setDesigner] = useState(() => externalFilters?.designer || '');
  const [approval, setApproval] = useState(() => externalFilters?.approval || '');
  const [publishing, setPublishing] = useState(() => externalFilters?.publishing || '');
  const [internalSearch, setInternalSearch] = useState('');
  const search = hideSearch ? searchTerm : (searchTerm || internalSearch);
  const [scheduleFilter, setScheduleFilter] = useState('All'); // 'All' | 'Monthly' | 'One-Time'
  const [internalEditing, setInternalEditing] = useState(null);
  const editing = externalEditing !== undefined ? externalEditing : internalEditing;
  const setEditing = (val) => {
    if (externalEditing !== undefined && onCloseExternalEditing && !val) {
      onCloseExternalEditing();
    }
    setInternalEditing(val);
  };
  const [value, setValue] = useState(() => ({ ...(externalEditing?.content || {}) }));
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeProjectDeliverables, setActiveProjectDeliverables] = useState(null);
  const [updatingDeliverableId, setUpdatingDeliverableId] = useState(null);

  // Sync value when externalEditing changes id
  const prevExternalIdRef = React.useRef(externalEditing?.id);
  React.useEffect(() => {
    if (externalEditing && externalEditing.id !== prevExternalIdRef.current) {
      prevExternalIdRef.current = externalEditing.id;
      setValue({ ...(externalEditing.content || {}) });
      setError('');
      setSuccessMessage('');
    } else if (!externalEditing) {
      prevExternalIdRef.current = null;
    }
  }, [externalEditing]);

  // Synchronize state with externalFilters if supplied
  const activeType = externalFilters ? (externalFilters.type ?? type) : type;
  const activeDesigner = externalFilters ? (externalFilters.designer ?? designer) : designer;
  const activeApproval = externalFilters ? (externalFilters.approval ?? approval) : approval;
  const activePublishing = externalFilters ? (externalFilters.publishing ?? publishing) : publishing;

  const handleFilterChange = (key, val) => {
    if (key === 'contentType') {
      setType(val);
      if (onAdvancedFilterChange) onAdvancedFilterChange({ type: val });
    } else if (key === 'designer') {
      setDesigner(val);
      if (onAdvancedFilterChange) onAdvancedFilterChange({ designer: val });
    } else if (key === 'approvalStatus') {
      setApproval(val);
      if (onAdvancedFilterChange) onAdvancedFilterChange({ approval: val });
    } else if (key === 'postStatus') {
      setPublishing(val);
      if (onAdvancedFilterChange) onAdvancedFilterChange({ publishing: val });
    }
  };

  const clearAdvancedFilters = () => {
    setType('');
    setDesigner('');
    setApproval('');
    setPublishing('');
    if (onAdvancedFilterChange) {
      onAdvancedFilterChange({ type: '', designer: '', approval: '', publishing: '' });
    }
  };

  const member = currentUser?.role === 'team_member';
  const isAllMonths = month === 'ALL';
  const monthlyTasks = tasks.filter(t => isAllMonths || (t.content?.postDate || t.content?.publishedDate || t.content?.designDate || t.dueDate || '').startsWith(month));
  const records = projectMode ? projects.filter(p => {
    const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.content?.clientName && p.content.clientName.toLowerCase().includes(search.toLowerCase())) ||
      (p.content?.projectType && p.content.projectType.toLowerCase().includes(search.toLowerCase()));
    const sched = p.content?.deliverySchedule || 'Monthly Deliverables';
    const matchesSchedule =
      scheduleFilter === 'All' ? true :
      scheduleFilter === 'Monthly' ? (sched === 'Monthly Deliverables' || sched === 'Both') :
      (sched === 'One-Time Deliverables' || sched === 'Both');
    return matchesSearch && matchesSchedule;
  }) : tasks.filter(t => {
    const query = search.toLowerCase().trim();
    const taskProj = projects.find(p => p.id === t.projectId);
    const matchesSearch = !query ||
      t.title.toLowerCase().includes(query) ||
      (t.description && t.description.toLowerCase().includes(query)) ||
      (taskProj && taskProj.name.toLowerCase().includes(query)) ||
      (t.content?.contentType && t.content.contentType.toLowerCase().includes(query));

    const effectiveProject = externalFilters?.projectFilter && externalFilters.projectFilter !== 'ALL'
      ? (externalFilters.projectFilter === 'UNPLANNED' ? !t.projectId : t.projectId === externalFilters.projectFilter)
      : (!project || t.projectId === project);

    const effectiveStatus = externalFilters?.statusFilter && externalFilters.statusFilter !== 'ALL'
      ? t.status === externalFilters.statusFilter
      : true;

    const effectivePriority = externalFilters?.priorityFilter && externalFilters.priorityFilter !== 'ALL'
      ? t.priority === externalFilters.priorityFilter
      : true;

    return (!member || t.assigneeId === currentUser.id) &&
      effectiveProject &&
      effectiveStatus &&
      effectivePriority &&
      (!activeType || t.content?.contentType === activeType) &&
      (!activeDesigner || t.assigneeId === activeDesigner) &&
      (!activeApproval || (t.content?.approvalStatus || 'Pending') === activeApproval) &&
      (!activePublishing || (t.content?.postStatus || 'Not Scheduled') === activePublishing) &&
      matchesSearch &&
      (!(t.content?.postDate || t.content?.publishedDate || t.content?.designDate) || monthlyTasks.includes(t));
  });

  const cell = (text) => <td className="p-3 border-b whitespace-nowrap">{text || <span className="content-muted">—</span>}</td>;
  const assigneeCell = (record) => currentUser?.role !== 'admin'
    ? cell(users.find(user => user.id === record.assigneeId)?.name || 'Unassigned')
    : <td className="p-3 border-b"><select className="content-assignee" aria-label={`Assignee for ${record.title}`} value={record.assigneeId || ''} disabled={saving} onChange={async event => {
      setSaving(true); setError(''); setSuccessMessage('');
      try { await updateTask({ id: record.id, assigneeId: event.target.value || null }); setSuccessMessage('Assignee updated'); }
      catch (err) { setError(err.message || 'Could not update assignee'); }
      finally { setSaving(false); }
    }}><option value="">Unassigned</option>{users.filter(user => user.status !== 'Inactive' || user.id === record.assigneeId).map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></td>;

  const tone = (status) => ['Approved', 'Completed', 'Published', 'Post'].includes(status) ? 'green' : ['Changes Requested', 'Cancelled', 'Overdue'].includes(status) ? 'red' : ['In Review', 'Pending', 'AI Reel'].includes(status) ? 'amber' : ['In Progress', 'Scheduled', 'Reel'].includes(status) ? 'blue' : 'gray';

  const quickEdit = (record, key, fallback) => <td className="p-3 border-b"><select data-tone={tone(record.content?.[key] || fallback)} aria-label={`${record.title}: ${key}`} disabled={saving || (member && (record.assigneeId !== currentUser.id || key !== 'designStatus'))} className="content-status" value={record.content?.[key] || fallback} onChange={async e => {
    setSaving(true); setError(''); setSuccessMessage('');
    try {
      await updateTask({ id: record.id, content: { [key]: e.target.value } });
      setSuccessMessage('Updated successfully');
    } catch (err) { setError(err.message || 'Could not save'); }
    finally { setSaving(false); }
  }}>{options[key].map(item => <option key={item}>{item}</option>)}</select></td>;

  const handleMarkDeliverableCompleted = React.useCallback(async (deliverableItem, projectObj) => {
    if (updatingDeliverableId) return;
    setUpdatingDeliverableId(deliverableItem.id);
    setError('');
    setSuccessMessage('');
    try {
      const isSocial = isSocialProject(projectObj.content);
      const todayDate = new Date().toISOString().slice(0, 10);
      const taskObj = deliverableItem.task;
      const prevContent = taskObj?.content || {};
      const targetContentType = isSocial && !SOCIAL_DELIVERABLE_TYPES.includes(prevContent.contentType)
        ? deliverableItem.type
        : prevContent.contentType;

      const contentUpdates = isSocial
        ? {
            ...prevContent,
            ...(targetContentType ? { contentType: targetContentType } : {}),
            designStatus: 'Completed',
            approvalStatus: 'Approved',
            postStatus: 'Published',
            publishedDate: prevContent.publishedDate || todayDate
          }
        : {
            ...prevContent,
            designStatus: 'Completed',
            designDate: prevContent.designDate || todayDate
          };

      await updateTask({
        id: deliverableItem.id,
        status: 'Completed',
        progress: 100,
        content: contentUpdates
      });
      setSuccessMessage(`Deliverable "${deliverableItem.name}" marked as delivered!`);
    } catch (err) {
      setError(err.message || 'Failed to update deliverable delivery status');
    } finally {
      setUpdatingDeliverableId(null);
    }
  }, [updatingDeliverableId, updateTask]);

  const save = async () => {
    setSaving(true); setError(''); setSuccessMessage('');
    try {
      const permitted = new Set((projectMode ? projectFields : taskFields).map(([key]) => key));
      const content = Object.fromEntries(Object.entries(value).filter(([key]) => permitted.has(key)));
      await (projectMode ? updateProject({ id: editing.id, content }) : updateTask({ id: editing.id, content }));
      setEditing(null);
      setSuccessMessage('Changes saved');
    } catch (err) { setError(err.message || 'Could not save'); }
    finally { setSaving(false); }
  };

  const visibleTasks = member ? monthlyTasks.filter(t => t.assigneeId === currentUser.id) : monthlyTasks;
  const publishedCount = visibleTasks.filter(t => t.content?.postStatus === 'Published').length;
  const reviewCount = visibleTasks.filter(t => t.content?.designStatus === 'In Review' && t.content?.approvalStatus !== 'Approved').length;
  const scheduledCount = visibleTasks.filter(t => t.content?.postStatus === 'Scheduled').length;

  const totalMonthlyCommitment = projects.reduce((n, p) => n + deliveryTarget(p.content), 0);
  const totalDeliveredMonth = projects.reduce((n, p) => {
    const stats = getMonthlyProjectStats(p, tasks, month);
    return n + stats.delivered;
  }, 0);

  const metrics = projectMode
    ? [[Layers3, 'Client projects', projects.length], [CalendarDays, 'Monthly commitment', totalMonthlyCommitment], [CheckCircle2, 'Delivered', totalDeliveredMonth]]
    : [[Layers3, 'Planned this month', visibleTasks.length], [Clock3, 'Awaiting review', reviewCount], [CalendarDays, 'Scheduled', scheduledCount], [CheckCircle2, 'Published', publishedCount]];

  return <section className="content-workspace">
    <div className="content-metrics">{metrics.map(([Icon, label, number]) => <div className="content-metric" key={label}><span className="content-metric-icon"><Icon size={18} /></span><div><span>{label}</span><strong>{number}</strong></div></div>)}</div>
    <div className="content-sheet">
    <div className="content-sheet-heading"><div><span className="content-eyebrow">{projectMode ? 'CLIENT PORTFOLIO' : 'PRODUCTION WORKSPACE'}</span><h2>{projectMode ? 'Delivery commitments' : member ? 'My content schedule' : 'Content schedule'}</h2></div><span className="content-record-count">{records.length} {projectMode ? 'projects' : 'tasks'}</span></div>
    {error && !editing && <p role="alert" className="text-red-500 px-6 py-2 text-xs font-semibold">{error}</p>}
    {successMessage && !editing && <p role="status" className="text-emerald-600 px-6 py-2 text-xs font-semibold">{successMessage}</p>}
    {!hideToolbar && (
      <div className="content-toolbar">
        {!hideSearch && (
          <label className="content-search"><Search size={16} /><input aria-label="Search content" placeholder={projectMode ? 'Search client projects…' : 'Search topics…'} value={internalSearch} onChange={e => setInternalSearch(e.target.value)} /></label>
        )}
        <label className="content-month"><CalendarDays size={16} /><input aria-label="Content month" type="month" value={month} onChange={e => setMonth(e.target.value)} /></label>
        {projectMode && (
          <div className="flex items-center gap-1 border border-[var(--border)] rounded-xl p-1 bg-[var(--surface)] text-xs">
            {['All', 'Monthly', 'One-Time'].map(tabMode => (
              <button
                key={tabMode}
                type="button"
                onClick={() => setScheduleFilter(tabMode)}
                className={`px-3 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  scheduleFilter === tabMode ? 'bg-[#635BFF] text-white' : 'text-[var(--text-sec)] hover:text-[var(--text-main)]'
                }`}
              >
                {tabMode}
              </button>
            ))}
          </div>
        )}
        {!projectMode && (
          <button
            className="content-filter-toggle"
            aria-expanded={showFilters}
            aria-controls="content-filters"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={15} /> Filters{[activeDesigner, activeType, activeApproval, activePublishing].filter(Boolean).length > 0 && <span>{[activeDesigner, activeType, activeApproval, activePublishing].filter(Boolean).length}</span>}
          </button>
        )}
      </div>
    )}
      {!hideToolbar && !projectMode && showFilters && (
        <div id="content-filters" className="content-filter-panel items-center gap-2">
          {/* Assignee Filter */}
          <select
            aria-label="Assignee filter"
            value={activeDesigner}
            onChange={e => handleFilterChange('designer', e.target.value)}
            className="border rounded p-2 bg-[var(--surface)] text-xs"
          >
            <option value="">All assignees</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>

          {/* Content Type Filter */}
          <select
            aria-label="Content Type filter"
            value={activeType}
            onChange={e => handleFilterChange('contentType', e.target.value)}
            className="border rounded p-2 bg-[var(--surface)] text-xs"
          >
            <option value="">All content types</option>
            {options.contentType.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          {/* Approval Status Filter */}
          <select
            aria-label="Approval Status filter"
            value={activeApproval}
            onChange={e => handleFilterChange('approvalStatus', e.target.value)}
            className="border rounded p-2 bg-[var(--surface)] text-xs"
          >
            <option value="">All approval status</option>
            {options.approvalStatus.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          {/* Post Status Filter */}
          <select
            aria-label="Post Status filter"
            value={activePublishing}
            onChange={e => handleFilterChange('postStatus', e.target.value)}
            className="border rounded p-2 bg-[var(--surface)] text-xs"
          >
            <option value="">All post status</option>
            {options.postStatus.map(o => <option key={o} value={o}>{o}</option>)}
          </select>

          <button
            className="content-clear text-xs text-[#635BFF] hover:underline font-semibold ml-auto cursor-pointer"
            onClick={clearAdvancedFilters}
          >
            Clear filters
          </button>
        </div>
      )}
        <p className="text-xs text-[var(--text-sec)]">{projectMode ? 'Delivered / monthly target. Social content uses publication dates; other services use completion dates.' : 'Tasks without publication dates remain visible. Select Details for dates and review feedback.'}</p>
    <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead className="bg-[var(--bg-main)]"><tr>{(projectMode ? ['Project', 'Service', 'Schedule', 'Client', 'Contract period', 'Delivery commitments', 'Delivered', 'Remaining', 'Status', 'Brief', ...(!member ? ['Internal notes'] : []), ''] : ['#', 'Topic', 'Project', 'Type', 'Assignee', 'Status', 'Design date', 'Approval', 'Approval date', 'Post status', 'Post date', 'Published', '']).map((heading, i) => <th className="p-3 whitespace-nowrap" key={i}>{heading}</th>)}</tr></thead>
      <tbody>{records.map((record, index) => {
        const c = record.content || {};
        const isSocial = isSocialProject(c);
        const stats = projectMode ? getMonthlyProjectStats(record, tasks, month) : null;
        const projectDeliveryInfo = projectMode ? getProjectDeliverables(record, tasks) : null;
        const deliverySchedule = c.deliverySchedule || 'Monthly Deliverables';
        const isOneTimeOnly = deliverySchedule === 'One-Time Deliverables';

        return <tr key={record.id}>{projectMode ? <>
          {cell(<Link className="text-[#635BFF] font-semibold hover:underline" to={`/projects?projectId=${record.id}`}>{record.name}</Link>)}
          {cell(c.projectType || 'Other')}
          <td className="p-3 border-b whitespace-nowrap">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              deliverySchedule === 'Monthly Deliverables' ? 'bg-purple-500/10 text-purple-600' :
              deliverySchedule === 'One-Time Deliverables' ? 'bg-amber-500/10 text-amber-600' :
              'bg-blue-500/10 text-blue-600'
            }`}>
              {deliverySchedule}
            </span>
          </td>
          {cell(c.clientName)}
          {cell(`${c.contractStart || '—'} → ${c.contractEnd || '—'}`)}
          <td className="p-3 border-b">
            {isOneTimeOnly ? (
              <span className="whitespace-nowrap">
                <strong>{projectDeliveryInfo.oneTime.completed} / {c.oneTimeTarget || projectDeliveryInfo.oneTime.total || 0}</strong><br />
                <span className="text-[var(--text-sec)]">Fixed Deliverables</span>
              </span>
            ) : isSocial ? (
              <div className="flex gap-3">
                {SOCIAL_DELIVERABLE_TYPES.map((kind) => {
                  const itemStat = stats.breakdown[kind] || { delivered: 0, target: 0 };
                  return (
                    <span key={kind} className="whitespace-nowrap">
                      <strong>{itemStat.delivered} / {itemStat.target}</strong><br />
                      <span className="text-[var(--text-sec)]">{kind}</span>
                    </span>
                  );
                })}
              </div>
            ) : (
              <span className="whitespace-nowrap">
                <strong>{stats.delivered} / {stats.target}</strong><br />
                <span className="text-[var(--text-sec)]">{stats.unit}</span>
              </span>
            )}
          </td>
          <td className="p-3 border-b whitespace-nowrap">
            {isOneTimeOnly ? (
              <>
                <strong className="text-emerald-600 text-xs">{projectDeliveryInfo.oneTime.completed}</strong>
                <span className="text-[var(--text-sec)]"> / {c.oneTimeTarget || projectDeliveryInfo.oneTime.total || 0}</span>
              </>
            ) : (
              <>
                <strong className="text-emerald-600 text-xs">{stats.delivered}</strong>
                <span className="text-[var(--text-sec)]"> / {stats.target}</span>
              </>
            )}
          </td>
          <td className="p-3 border-b whitespace-nowrap">
            {isOneTimeOnly ? (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${projectDeliveryInfo.oneTime.remaining === 0 && projectDeliveryInfo.oneTime.total > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                {projectDeliveryInfo.oneTime.remaining} remaining
              </span>
            ) : (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${stats.remaining === 0 && stats.target > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                {stats.remaining} remaining
              </span>
            )}
          </td>
          <td className="p-3 border-b whitespace-nowrap">
            {isOneTimeOnly ? (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                projectDeliveryInfo.oneTime.total > 0 && projectDeliveryInfo.oneTime.remaining === 0 ? 'bg-emerald-500/10 text-emerald-600' :
                projectDeliveryInfo.oneTime.completed > 0 ? 'bg-blue-500/10 text-blue-600' : 'bg-gray-500/10 text-gray-500'
              }`}>
                {projectDeliveryInfo.oneTime.total > 0 && projectDeliveryInfo.oneTime.remaining === 0 ? 'Completed' : projectDeliveryInfo.oneTime.completed > 0 ? 'In Progress' : 'Not Started'}
              </span>
            ) : (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                stats.target > 0 && stats.remaining === 0 ? 'bg-emerald-500/10 text-emerald-600' :
                stats.delivered > 0 ? 'bg-blue-500/10 text-blue-600' : 'bg-gray-500/10 text-gray-500'
              }`}>
                {stats.target > 0 && stats.remaining === 0 ? 'Completed' : stats.delivered > 0 ? 'In Progress' : 'Not Started'}
              </span>
            )}
          </td>
          {cell(c.brief)}
          {!member && cell(c.internalNotes)}
        </>
          : (() => {
              const proj = projects.find(p => p.id === record.projectId);
              const isTaskSocial = isSocialProject(proj?.content) || (record.content?.contentType && SOCIAL_DELIVERABLE_TYPES.includes(record.content?.contentType));
              const postStatus = c.postStatus || 'Not Scheduled';
              const isPublished = postStatus === 'Published';
              const isScheduled = postStatus === 'Scheduled';

              // Post date cell content
              let postDateCell;
              if (!isTaskSocial) {
                postDateCell = <span className="text-[var(--text-sec)]">Not applicable</span>;
              } else if (isPublished) {
                const pubDate = c.publishedDate || c.postDate || record.dueDate;
                postDateCell = pubDate ? format(pubDate) : <span className="content-muted">—</span>;
              } else if (isScheduled) {
                const schedDate = c.postDate || record.dueDate;
                postDateCell = schedDate ? format(schedDate) : <span className="text-blue-600 font-medium">Scheduled</span>;
              } else {
                postDateCell = c.postDate ? format(c.postDate) : <span className="text-[var(--text-sec)]">Not scheduled</span>;
              }

              // Published date cell content
              let publishedDateCell;
              if (!isTaskSocial) {
                publishedDateCell = <span className="text-[var(--text-sec)]">Not applicable</span>;
              } else if (c.publishedDate) {
                publishedDateCell = format(c.publishedDate);
              } else {
                publishedDateCell = <span className="content-muted">—</span>;
              }

              return (
                <>
                  {cell(index + 1)}
                  {cell(record.title)}
                  {cell(proj?.name)}
                  {quickEdit(record, 'contentType', 'Other')}
                  {assigneeCell(record)}
                  {quickEdit(record, 'designStatus', 'Not Started')}
                  {cell(c.designDate ? format(c.designDate) : null)}
                  {quickEdit(record, 'approvalStatus', 'Pending')}
                  {cell(c.approvalDate ? format(c.approvalDate.slice(0, 10)) : null)}
                  {quickEdit(record, 'postStatus', 'Not Scheduled')}
                  <td className="p-3 border-b whitespace-nowrap">{postDateCell}</td>
                  <td className="p-3 border-b whitespace-nowrap">{publishedDateCell}</td>
                </>
              );
            })()}
          <td className="p-3 border-b whitespace-nowrap flex items-center gap-2">
            {projectMode && (
              <button
                className="px-2.5 py-1 text-[11px] font-semibold text-[#635BFF] bg-[#635BFF]/10 hover:bg-[#635BFF]/20 rounded-lg transition-colors cursor-pointer"
                onClick={() => setActiveProjectDeliverables({ project: record, info: projectDeliveryInfo })}
                aria-label={`View deliverables for ${record.name}`}
              >
                Deliverables ({projectDeliveryInfo.completed}/{projectDeliveryInfo.total})
              </button>
            )}
            <button className="content-details" onClick={() => { setEditing(record); setValue({ ...c }); setError(''); setSuccessMessage(''); }} aria-label={`Details for ${record.name || record.title}`}>Details <ArrowUpRight size={13} /></button>
          </td></tr>;
      })}{!records.length && <tr><td className="p-5" colSpan={13}>No records match these filters.</td></tr>}</tbody></table></div>
    </div>

    {/* Deliverables Drawer / Management Modal */}
    {activeProjectDeliverables && (
      <div role="dialog" aria-modal="true" aria-label="Project deliverables" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#635BFF] tracking-wider">Delivery Management</span>
              <h3 className="font-bold text-lg text-[var(--text-main)]">{activeProjectDeliverables.project.name}</h3>
              <p className="text-xs text-[var(--text-sec)]">Service: {activeProjectDeliverables.project.content?.projectType || 'Other'} · Client: {activeProjectDeliverables.project.content?.clientName || '—'}</p>
            </div>
            <button
              onClick={() => setActiveProjectDeliverables(null)}
              className="p-1 text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded cursor-pointer"
              aria-label="Close deliverables view"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Progress Banner */}
          {(() => {
            const currentInfo = getProjectDeliverables(activeProjectDeliverables.project, tasks);
            return (
              <div className="mb-4 p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div>
                  <span className="text-[10px] text-[var(--text-sec)] block">Total Deliverables</span>
                  <strong className="text-base text-[var(--text-main)]">{currentInfo.total}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-sec)] block">Delivered / Done</span>
                  <strong className="text-base text-emerald-600">{currentInfo.completed}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-sec)] block">In Progress</span>
                  <strong className="text-base text-blue-600">{currentInfo.inProgress}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-sec)] block">Remaining</span>
                  <strong className="text-base text-amber-600">{currentInfo.remaining}</strong>
                </div>
              </div>
            );
          })()}

          {error && <p role="alert" className="text-xs font-semibold text-rose-500 mb-3">{error}</p>}
          {successMessage && <p role="status" className="text-xs font-semibold text-emerald-600 mb-3">{successMessage}</p>}

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-sec)]">Deliverables Checklist</h4>
            {(() => {
              const currentDeliverables = getProjectDeliverables(activeProjectDeliverables.project, tasks).deliverables;
              if (currentDeliverables.length === 0) {
                return (
                  <div className="p-6 text-center border border-dashed border-[var(--border)] rounded-xl text-xs text-[var(--text-sec)]">
                    No deliverables or tasks created for this project yet. Go to <Link className="text-[#635BFF] underline font-semibold" to={`/tasks?projectId=${activeProjectDeliverables.project.id}`}>Tasks</Link> to add deliverables.
                  </div>
                );
              }
              return (
                <div className="divide-y divide-[var(--border)] border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
                  {currentDeliverables.map(item => {
                    const assignee = users.find(u => u.id === item.assigneeId);
                    const isUpdating = updatingDeliverableId === item.id;
                    return (
                      <div key={item.id} className="p-3 flex items-center justify-between gap-4 hover:bg-[var(--bg-main)]/50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              item.isDelivered ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                              item.status === 'In Progress' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                              item.status === 'Overdue' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                              'bg-gray-500/10 text-gray-500 border-gray-500/20'
                            }`}>
                              {item.status}
                            </span>
                            <span className="text-[10px] text-[var(--text-sec)]">Type: <strong>{item.type}</strong></span>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${item.deliveryCategory === 'One-Time Deliverable' ? 'bg-amber-500/10 text-amber-600' : 'bg-purple-500/10 text-purple-600'}`}>
                              {item.deliveryCategory}
                            </span>
                            {assignee && <span className="text-[10px] text-[var(--text-sec)]">· Assigned to: <strong>{assignee.name}</strong></span>}
                          </div>
                          <p className="text-xs font-semibold text-[var(--text-main)] truncate">{item.name}</p>
                          <div className="flex items-center gap-3 text-[10px] text-[var(--text-sec)] mt-1">
                            <span>Target Date: {item.targetDate || '—'}</span>
                            {item.actualDate && <span className="text-emerald-600">Delivered / Published Date: {item.actualDate}</span>}
                          </div>
                        </div>

                        <div>
                          {item.isDelivered ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                              <Check className="w-3.5 h-3.5" />
                              <span>Delivered</span>
                            </span>
                          ) : (
                            <button
                              disabled={isUpdating || (member && item.assigneeId !== currentUser?.id)}
                              onClick={() => handleMarkDeliverableCompleted(item, activeProjectDeliverables.project)}
                              className="px-3 py-1.5 text-xs font-semibold bg-[#635BFF] hover:bg-[#4942D9] text-white rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                              <span>Mark Delivered</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <div className="pt-4 mt-4 border-t border-[var(--border)] flex justify-end">
            <button
              onClick={() => setActiveProjectDeliverables(null)}
              className="px-4 py-2 text-xs bg-[var(--bg-main)] text-[var(--text-main)] border border-[var(--border)] rounded-lg hover:bg-[var(--border)] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    {editing && <div role="dialog" aria-modal="true" aria-label="Content details" className="content-dialog fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><div className="bg-[var(--surface)] rounded-xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto space-y-4">
      <header className="content-dialog-header"><h3 className="font-bold">{editing.name || editing.title}</h3><button type="button" className="content-dialog-close" aria-label="Close details" disabled={saving} onClick={() => setEditing(null)}><X size={20} /></button></header>
      {!projectMode && <p className="text-sm">Design deadline: {String(editing.dueDate || '').slice(0, 10) || '—'}</p>}
      {!projectMode && <p className="text-sm">Review feedback: {editing.content?.feedback || 'None'}<br />Approved by: {users.find(u => u.id === editing.content?.approvedBy)?.name || '—'}<br />Published by: {users.find(u => u.id === editing.content?.publishedBy)?.name || '—'}</p>}
      {(!member || (!projectMode && editing.assigneeId === currentUser.id)) && <ContentFields project={projectMode} member={member} value={value} onChange={setValue} />}
      {error && <p role="alert" className="text-red-500">{error}</p>}
      <div className="flex gap-3"><button disabled={saving} onClick={() => setEditing(null)}>Close</button>{(!member || (!projectMode && editing.assigneeId === currentUser.id)) && <button disabled={saving} className="bg-[#635BFF] text-white rounded px-4 py-2" onClick={save}>{saving ? 'Saving…' : 'Save'}</button>}</div>
    </div></div>}
  </section>;
}

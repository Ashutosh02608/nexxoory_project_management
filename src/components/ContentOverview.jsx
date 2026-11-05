import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/useApp';

export default function ContentOverview() {
  const { tasks, projects, currentUser } = useApp();
  const [month] = useState(() => new Date().toISOString().slice(0, 7));
  const member = currentUser?.role === 'team_member';
  const visible = member ? tasks.filter(t => t.assigneeId === currentUser.id) : tasks;
  const review = visible.filter(t => t.content?.designStatus === 'In Review' && t.content?.approvalStatus !== 'Approved').length;
  const changes = visible.filter(t => t.content?.designStatus === 'Changes Requested').length;
  const upcoming = visible.filter(t => t.content?.approvalStatus === 'Approved' && t.content?.postStatus !== 'Published' && t.content?.postStatus !== 'Cancelled').length;
  const published = visible.filter(t => t.content?.postStatus === 'Published' && t.content?.publishedDate?.startsWith(month)).length;
  const target = projects.reduce((total, p) => total + (p.content?.postTarget || 0) + (p.content?.reelTarget || 0) + (p.content?.aiReelTarget || 0), 0);
  return <section className="mb-6 border border-[var(--border)] rounded-xl p-4 bg-[var(--surface)]"><h2 className="font-bold mb-3">{member ? 'My content queue' : 'Content delivery this month'}</h2><div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
    <Link to="/tasks">Awaiting review: <strong>{review}</strong></Link><Link to="/tasks">Changes requested: <strong>{changes}</strong></Link><Link to="/tasks">Approved to publish: <strong>{upcoming}</strong></Link><Link to="/projects">Published: <strong>{published}{!member && ` / ${target}`}</strong></Link>
  </div></section>;
}

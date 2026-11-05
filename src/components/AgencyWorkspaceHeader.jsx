import React from 'react';
import { ArrowUpRight } from 'lucide-react';

export default function AgencyWorkspaceHeader({ project = false, member = false }) {
  return <div className="agency-workspace-heading">
    <img src="/nexxoory_logo.webp" alt="Nexxoory Solutions" width="64" height="64" />
    <div><span className="agency-workspace-kicker">NEXXOORY · {project ? 'CLIENT DELIVERY' : 'CREATIVE OPERATIONS'}</span>
      <h1>{project ? 'Client Projects' : member ? 'My Tasks' : 'Content & Tasks'}</h1>
      <p>{project ? 'Turn client goals into the next success story.' : 'Plan the idea. Create the story. Publish with confidence.'}</p>
      <a href="https://www.nexxoorysolutions.com" target="_blank" rel="noopener noreferrer">Nexxoory Solutions <ArrowUpRight size={12} /><span className="sr-only"> (opens in a new tab)</span></a>
    </div>
  </div>;
}

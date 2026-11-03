import React, { useState } from 'react';
import {
  FolderArchive,
  Upload,
  Search,
  FileText,
  Download,
  Trash2,
  Eye,
  X,
  Loader2,
  Folder,
  FolderOpen,
  ArrowRight,
  MoveRight,
  Edit2,
  ArrowUpDown,
  ChevronRight,
  Users,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function DocumentsPage() {
  const {
    documents = [],
    updateDocument,
    removeDocument,
    assignDocumentAccess,
    assignFolderAccess,
    folderPermissions = [],
    projects = [],
    users = [],
    currentUser
  } = useApp();

  const isAdmin = currentUser?.role === 'admin';

  // Navigation: null = root folders view, 'general' = General folder, or projectId
  const [currentFolder, setCurrentFolder] = useState(null);
  const [navSection, setNavSection] = useState('ALL'); // 'ALL', 'PROJECTS', 'GENERAL', 'RECENT', 'MY_UPLOADS'

  // Search, filter, and sorting
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL', 'PDF', 'DOC'
  const [sortBy, setSortBy] = useState('date'); // 'name', 'date', 'size'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [moveDoc, setMoveDoc] = useState(null);
  const [renameDoc, setRenameDoc] = useState(null);
  const [newName, setNewName] = useState('');
  const [targetFolderProjectId, setTargetFolderProjectId] = useState('');

  // Access Permission Management Modal state (Admin only)
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessTarget, setAccessTarget] = useState(null); // { type: 'file'|'folder', id, name, userIds: [] }

  // Submit status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Upload Form
  const [formData, setFormData] = useState({
    name: '',
    projectId: '', // '' = General
    type: 'PDF',
    size: '1.4 MB',
    content: 'Standard operating specifications and project architecture documentation.'
  });

  // Calculate folder accessibility for non-admin
  const hasFolderAccess = (folderKey) => {
    if (isAdmin) return true;
    return folderPermissions.some(fp => fp.folderKey === String(folderKey) && fp.userId === currentUser?.id);
  };

  // Determine authorized folders
  const visibleProjects = projects.filter(p => isAdmin || hasFolderAccess(p.id));
  const canSeeGeneral = isAdmin || hasFolderAccess('general');

  // Filter documents authorized for the user:
  // Admin sees all. Employees see files where assignedUserIds has their id OR parent folder is assigned to them.
  const visibleDocuments = documents.filter(doc => {
    if (isAdmin) return true;
    const directAssigned = Array.isArray(doc.assignedUserIds) && doc.assignedUserIds.includes(currentUser?.id);
    const parentFolderKey = doc.projectId ? String(doc.projectId) : 'general';
    const folderAssigned = hasFolderAccess(parentFolderKey);
    return directAssigned || folderAssigned;
  });

  // Calculate folder metadata
  const generalDocs = visibleDocuments.filter(d => !d.projectId);
  const generalLastUpdate = generalDocs[0]?.updatedAt || generalDocs[0]?.date || 'None';

  const projectFolders = visibleProjects.map(proj => {
    const pDocs = visibleDocuments.filter(d => d.projectId === proj.id);
    return {
      project: proj,
      docCount: pDocs.length,
      lastUpdate: pDocs[0]?.updatedAt || pDocs[0]?.date || proj.startDate || 'Recent'
    };
  });

  // Filter & sort files in active view
  let activeDocs = visibleDocuments;
  if (navSection === 'RECENT') {
    activeDocs = [...visibleDocuments].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 10);
  } else if (navSection === 'MY_UPLOADS') {
    activeDocs = visibleDocuments.filter(d => d.authorId === currentUser?.id || d.author === currentUser?.name);
  } else if (currentFolder === 'general') {
    activeDocs = visibleDocuments.filter(d => !d.projectId);
  } else if (currentFolder) {
    activeDocs = visibleDocuments.filter(d => d.projectId === currentFolder);
  }

  const filteredDocs = activeDocs
    .filter(d => {
      const matchSearch = d.name?.toLowerCase().includes(search.toLowerCase()) ||
        (d.content && d.content.toLowerCase().includes(search.toLowerCase()));
      const matchType = typeFilter === 'ALL' || d.type?.toUpperCase() === typeFilter.toUpperCase();
      return matchSearch && matchType;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = (a.name || '').localeCompare(b.name || '');
      } else if (sortBy === 'date') {
        comparison = new Date(a.date || 0) - new Date(b.date || 0);
      } else if (sortBy === 'size') {
        const sizeA = parseFloat(a.size) || 0;
        const sizeB = parseFloat(b.size) || 0;
        comparison = sizeA - sizeB;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await updateDocument({
        name: formData.name,
        projectId: formData.projectId || null,
        folder: formData.projectId ? 'Project Document' : 'General',
        size: formData.size,
        type: formData.type,
        content: formData.content,
        author: currentUser?.name || 'Administrator',
        authorId: currentUser?.id
      });
      setUploadModalOpen(false);
      setFormData({
        name: '',
        projectId: currentFolder && currentFolder !== 'general' ? currentFolder : '',
        type: 'PDF',
        size: '1.4 MB',
        content: 'Standard operating specifications and project architecture documentation.'
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to upload document');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMoveSubmit = async (e) => {
    e.preventDefault();
    if (!moveDoc) return;
    setIsSubmitting(true);
    try {
      await updateDocument({
        ...moveDoc,
        projectId: targetFolderProjectId || null,
        folder: targetFolderProjectId ? 'Project Document' : 'General'
      });
      setMoveDoc(null);
    } catch (err) {
      alert(err.message || 'Failed to move document');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renameDoc || !newName.trim()) return;
    setIsSubmitting(true);
    try {
      await updateDocument({
        ...renameDoc,
        name: newName.trim()
      });
      setRenameDoc(null);
      setNewName('');
    } catch (err) {
      alert(err.message || 'Failed to rename document');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAccess = async () => {
    if (!accessTarget) return;
    setIsSubmitting(true);
    try {
      if (accessTarget.type === 'file') {
        await assignDocumentAccess(accessTarget.id, accessTarget.userIds);
      } else {
        await assignFolderAccess(accessTarget.id, accessTarget.userIds);
      }
      setAccessModalOpen(false);
      setAccessTarget(null);
    } catch (err) {
      alert(err.message || 'Failed to update access permissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openFolderAccessModal = (folderKey, folderTitle) => {
    const existing = folderPermissions.filter(fp => fp.folderKey === String(folderKey)).map(fp => fp.userId);
    setAccessTarget({
      type: 'folder',
      id: String(folderKey),
      name: folderTitle,
      userIds: existing
    });
    setAccessModalOpen(true);
  };

  const openFileAccessModal = (doc) => {
    setAccessTarget({
      type: 'file',
      id: doc.id,
      name: doc.name,
      userIds: doc.assignedUserIds || []
    });
    setAccessModalOpen(true);
  };

  const getFolderName = (folderId) => {
    if (folderId === 'general') return 'General';
    const proj = projects.find(p => p.id === folderId);
    return proj ? proj.name : 'Unknown Project';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">Documents & Assets</h1>
          <p className="text-xs sm:text-sm text-[var(--text-sec)] mt-0.5">
            Architecture specs, compliance documents, and project deliverables organized by folder and access permissions.
          </p>
        </div>

        <button
          onClick={() => {
            setFormData(prev => ({
              ...prev,
              projectId: currentFolder && currentFolder !== 'general' ? currentFolder : ''
            }));
            setUploadModalOpen(true);
          }}
          className="flex items-center gap-2 bg-[#635BFF] hover:bg-[#4942D9] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Navigation Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: 'ALL', label: 'All Folders & Files' },
          { id: 'PROJECTS', label: 'Projects' },
          ...(canSeeGeneral ? [{ id: 'GENERAL', label: 'General' }] : []),
          { id: 'RECENT', label: 'Recently Uploaded' },
          { id: 'MY_UPLOADS', label: 'My Uploads' }
        ].map(nav => (
          <button
            key={nav.id}
            onClick={() => {
              setNavSection(nav.id);
              if (nav.id === 'GENERAL') setCurrentFolder('general');
              else if (nav.id === 'ALL' || nav.id === 'PROJECTS') setCurrentFolder(null);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              navSection === nav.id
                ? 'bg-[#635BFF] text-white shadow-xs'
                : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--text-sec)] hover:text-[var(--text-main)]'
            }`}
          >
            {nav.label}
          </button>
        ))}
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-sec)] bg-[var(--surface)] border border-[var(--border)] px-4 py-2.5 rounded-xl">
        <button
          onClick={() => setCurrentFolder(null)}
          className={`hover:text-[#635BFF] cursor-pointer ${!currentFolder ? 'font-bold text-[#635BFF]' : ''}`}
        >
          Documents
        </button>
        {currentFolder && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-semibold text-[var(--text-main)]">{getFolderName(currentFolder)}</span>
          </>
        )}
      </div>

      {/* FOLDERS GRID (Visible on root or when viewing folders) */}
      {!currentFolder && (navSection === 'ALL' || navSection === 'PROJECTS') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase text-[var(--text-sec)] tracking-wider">Folders Directory</h2>
            {!isAdmin && (
              <span className="text-[11px] text-[var(--text-sec)] flex items-center gap-1">
                <Lock className="w-3 h-3" /> Showing folders assigned to you
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* General Folder Card (Permanent Non-project folder) */}
            {canSeeGeneral && (navSection === 'ALL' || navSection === 'GENERAL') && (
              <div
                onClick={() => setCurrentFolder('general')}
                className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[#635BFF] transition-all cursor-pointer shadow-xs group relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 group-hover:scale-110 transition-transform">
                      <Folder className="w-5 h-5 fill-amber-500/20" />
                    </div>
                    <div className="flex items-center gap-1">
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openFolderAccessModal('general', 'General');
                          }}
                          className="p-1 rounded-lg hover:bg-[var(--bg-main)] text-[var(--text-sec)] hover:text-[#635BFF]"
                          title="Manage Folder Access"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-main)] text-[var(--text-sec)]">
                        {generalDocs.length} docs
                      </span>
                    </div>
                  </div>
                  <h3 className="font-bold text-sm text-[var(--text-main)] group-hover:text-[#635BFF] transition-colors">
                    General
                  </h3>
                  <p className="text-[11px] text-[var(--text-sec)] mt-1">Company policies, templates & guidelines</p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex items-center justify-between text-[10px] text-[var(--text-sec)]">
                  <span>Updated: {generalLastUpdate}</span>
                  <span className="text-[#635BFF] font-semibold flex items-center gap-0.5">Open →</span>
                </div>
              </div>
            )}

            {/* Project Folders */}
            {projectFolders.map(({ project, docCount, lastUpdate }) => (
              <div
                key={project.id}
                onClick={() => setCurrentFolder(project.id)}
                className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] hover:border-[#635BFF] transition-all cursor-pointer shadow-xs group relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-2.5 rounded-xl bg-[#635BFF]/10 text-[#635BFF] group-hover:scale-110 transition-transform">
                      <FolderOpen className="w-5 h-5 fill-[#635BFF]/20" />
                    </div>
                    <div className="flex items-center gap-1">
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openFolderAccessModal(project.id, project.name);
                          }}
                          className="p-1 rounded-lg hover:bg-[var(--bg-main)] text-[var(--text-sec)] hover:text-[#635BFF]"
                          title="Manage Folder Access"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-main)] text-[var(--text-sec)]">
                        {docCount} docs
                      </span>
                    </div>
                  </div>
                  <h3 className="font-bold text-sm text-[var(--text-main)] group-hover:text-[#635BFF] transition-colors truncate">
                    {project.name}
                  </h3>
                  <p className="text-[11px] text-[var(--text-sec)] mt-1 line-clamp-1">
                    {project.description || 'Dedicated project assets & specs'}
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[var(--border)] flex items-center justify-between text-[10px] text-[var(--text-sec)]">
                  <span>Updated: {lastUpdate}</span>
                  <span className="text-[#635BFF] font-semibold flex items-center gap-0.5">Open →</span>
                </div>
              </div>
            ))}
          </div>

          {projectFolders.length === 0 && !canSeeGeneral && (
            <div className="p-8 text-center bg-[var(--surface)] border border-[var(--border)] rounded-2xl text-xs text-[var(--text-sec)]">
              No document folders have been shared with your account yet. Contact an administrator to request access.
            </div>
          )}
        </div>
      )}

      {/* Control Bar: Filters, Sorting & Search for Files */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[var(--text-sec)]" />
          <input
            type="text"
            placeholder="Search documents by name or summary..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-[var(--text-main)] outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* File Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
          >
            <option value="ALL">All Formats</option>
            <option value="PDF">PDF Documents</option>
            <option value="DOC">Word / Doc</option>
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
          </select>

          {/* Sort Order Toggle */}
          <button
            onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
            title="Toggle sort direction"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-[var(--text-main)]">
              {currentFolder ? getFolderName(currentFolder) : 'Documents Listing'}
            </h3>
            <span className="text-xs text-[var(--text-sec)]">({filteredDocs.length} items)</span>
          </div>

          {currentFolder && (
            <button
              onClick={() => setCurrentFolder(null)}
              className="text-xs text-[#635BFF] hover:underline font-semibold cursor-pointer"
            >
              ← Back to all folders
            </button>
          )}
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-main)] border-b border-[var(--border)] text-[var(--text-sec)] uppercase font-semibold text-[10px]">
            <tr>
              <th className="py-3 px-4">Document Name</th>
              <th className="py-3 px-4">Location / Folder</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4">Author</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-8 text-center text-xs text-[var(--text-sec)]">
                  No documents found matching your filter or assigned permissions.
                </td>
              </tr>
            ) : (
              filteredDocs.map(doc => {
                const project = projects.find(p => p.id === doc.projectId);
                return (
                  <tr key={doc.id} className="hover:bg-[var(--bg-main)] transition-colors">
                    <td className="py-3 px-4 font-semibold text-[var(--text-main)] flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-[#635BFF] shrink-0" />
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="hover:text-[#635BFF] cursor-pointer text-left"
                      >
                        {doc.name}
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] border ${
                        project ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      }`}>
                        {project ? project.name : 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-sec)]">{doc.size}</td>
                    <td className="py-3 px-4">{doc.author}</td>
                    <td className="py-3 px-4 text-[var(--text-sec)]">{doc.updatedAt || doc.date}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin && (
                          <button
                            onClick={() => openFileAccessModal(doc)}
                            className="p-1 rounded text-[var(--text-sec)] hover:text-[#635BFF] hover:bg-[var(--bg-main)] cursor-pointer"
                            title="Manage File Access"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
                          title="Preview"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setRenameDoc(doc);
                            setNewName(doc.name);
                          }}
                          className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
                          title="Rename"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setMoveDoc(doc);
                            setTargetFolderProjectId(doc.projectId || '');
                          }}
                          className="p-1 rounded text-[var(--text-sec)] hover:text-[#635BFF] hover:bg-[var(--bg-main)] cursor-pointer"
                          title="Move Folder"
                        >
                          <MoveRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => alert(`Simulating local download for ${doc.name}`)}
                          className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete document "${doc.name}"?`)) removeDocument(doc.id);
                          }}
                          className="p-1 rounded text-[var(--text-sec)] hover:text-[#E05252] cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ACCESS MANAGEMENT MODAL (ADMIN ONLY) */}
      {accessModalOpen && accessTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#635BFF] flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Manage {accessTarget.type === 'file' ? 'File' : 'Folder'} Access
                </span>
                <h3 className="font-bold text-base text-[var(--text-main)] truncate max-w-xs">{accessTarget.name}</h3>
              </div>
              <button
                onClick={() => {
                  setAccessModalOpen(false);
                  setAccessTarget(null);
                }}
                className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-sec)] mb-4">
              Select employees who have explicit permission to access this {accessTarget.type}. Administrators have organization-wide access by default.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 mb-4 border border-[var(--border)] rounded-xl p-3 bg-[var(--bg-main)]">
              {users.filter(u => u.role !== 'admin').map(user => {
                const isSelected = accessTarget.userIds?.includes(user.id);
                return (
                  <label
                    key={user.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--surface)] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#635BFF]/10 text-[#635BFF] font-bold text-xs flex items-center justify-center">
                        {user.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-[var(--text-main)] block">{user.name}</span>
                        <span className="text-[10px] text-[var(--text-sec)]">{user.role} • {user.department}</span>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAccessTarget(prev => {
                          const current = prev.userIds || [];
                          const updated = checked ? [...current, user.id] : current.filter(id => id !== user.id);
                          return { ...prev, userIds: updated };
                        });
                      }}
                      className="w-4 h-4 rounded text-[#635BFF] accent-[#635BFF] cursor-pointer"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
              <span className="text-[11px] text-[var(--text-sec)]">
                {accessTarget.userIds?.length || 0} employees assigned
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccessModalOpen(false);
                    setAccessTarget(null);
                  }}
                  className="px-3 py-1.5 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSaveAccess}
                  className="px-4 py-1.5 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Permissions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#635BFF]">Document Preview</span>
                <h3 className="font-bold text-base text-[var(--text-main)]">{previewDoc.name}</h3>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] text-xs text-[var(--text-sec)] mb-4 leading-relaxed">
              {previewDoc.content || 'Standard operating specifications and project architecture documentation.'}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
              <div className="p-2.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--text-sec)] block uppercase">Folder Location</span>
                <span className="font-semibold text-[var(--text-main)]">
                  {previewDoc.projectId ? projects.find(p => p.id === previewDoc.projectId)?.name || 'Project' : 'General'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border)]">
                <span className="text-[10px] font-bold text-[var(--text-sec)] block uppercase">File Format & Size</span>
                <span className="font-semibold text-[var(--text-main)]">{previewDoc.type} • {previewDoc.size}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 text-xs bg-[var(--bg-main)] hover:bg-[var(--border)] text-[var(--text-main)] font-semibold rounded-lg cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME MODAL */}
      {renameDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="font-bold text-sm text-[var(--text-main)] mb-3">Rename Document</h3>
            <form onSubmit={handleRenameSubmit} className="space-y-4">
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRenameDoc(null)}
                  className="px-3 py-1.5 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs bg-[#635BFF] text-white font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  Rename
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVE MODAL */}
      {moveDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h3 className="font-bold text-sm text-[var(--text-main)] mb-3">Move Document</h3>
            <p className="text-xs text-[var(--text-sec)] mb-4">
              Select destination folder for <span className="font-semibold text-[var(--text-main)]">{moveDoc.name}</span>
            </p>
            <form onSubmit={handleMoveSubmit} className="space-y-4">
              <select
                value={targetFolderProjectId}
                onChange={(e) => setTargetFolderProjectId(e.target.value)}
                className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
              >
                <option value="">General</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMoveDoc(null)}
                  className="px-3 py-1.5 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs bg-[#635BFF] text-white font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  Move Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPLOAD MODAL */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <h3 className="font-bold text-base text-[var(--text-main)]">Upload Document</h3>
              <button onClick={() => setUploadModalOpen(false)} className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
                  {errorMsg}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">File Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. System_Architecture_2026.pdf"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Target Folder / Project Location *</label>
                <select
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                >
                  {canSeeGeneral && <option value="">General (Company-wide policies & templates)</option>}
                  {visibleProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">File Format</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  >
                    <option value="PDF">PDF</option>
                    <option value="DOC">Word (.docx)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">File Size</label>
                  <input
                    type="text"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Document Description</label>
                <textarea
                  rows="2"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
              </div>

              <div className="pt-3 border-t border-[var(--border)] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="px-4 py-2 text-xs text-[var(--text-sec)] hover:bg-[var(--bg-main)] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-semibold rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <span>Confirm Upload</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

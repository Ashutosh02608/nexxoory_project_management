import React, { useState } from 'react';
import { FolderArchive, Upload, Search, FileText, Download, Trash2, Eye, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function DocumentsPage() {
  const { documents, updateDocument, removeDocument, projects, currentUser } = useApp();

  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState('ALL');
  const [previewDoc, setPreviewDoc] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Upload simulation form
  const [formData, setFormData] = useState({
    name: '',
    folder: 'Engineering Specs',
    projectId: projects[0]?.id || '',
    size: '1.4 MB',
    type: 'PDF',
    content: 'Standard operating specifications and project architecture documentation.'
  });

  const handleUploadSubmit = (e) => {
    e.preventDefault();
    updateDocument({
      ...formData,
      updatedAt: new Date().toISOString().split('T')[0],
      author: currentUser.name
    });
    setUploadModalOpen(false);
  };

  const filteredDocs = documents.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase());
    const matchesFolder = folderFilter === 'ALL' || d.folder === folderFilter;
    return matchesSearch && matchesFolder;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] tracking-tight">Documents & Assets</h1>
          <p className="text-xs sm:text-sm text-[var(--text-sec)] mt-0.5">
            Architecture specs, compliance certificates, design token JSONs, and sprint deliverables.
          </p>
        </div>

        <button
          onClick={() => setUploadModalOpen(true)}
          className="flex items-center gap-2 bg-[#635BFF] hover:bg-[#4942D9] text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[var(--text-sec)]" />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-[var(--text-main)] outline-none"
          />
        </div>

        <select
          value={folderFilter}
          onChange={(e) => setFolderFilter(e.target.value)}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
        >
          <option value="ALL">All Folders</option>
          <option value="Architecture">Architecture</option>
          <option value="Design Assets">Design Assets</option>
          <option value="Security & Legal">Security & Legal</option>
          <option value="Engineering Specs">Engineering Specs</option>
        </select>
      </div>

      {/* Documents Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-main)] border-b border-[var(--border)] text-[var(--text-sec)] uppercase font-semibold text-[10px]">
            <tr>
              <th className="py-3 px-4">Document Name</th>
              <th className="py-3 px-4">Folder</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4">Author</th>
              <th className="py-3 px-4">Last Updated</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {filteredDocs.map(doc => (
              <tr key={doc.id} className="hover:bg-[var(--bg-main)] transition-colors">
                <td className="py-3 px-4 font-semibold text-[var(--text-main)] flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[#635BFF] shrink-0" />
                  <button onClick={() => setPreviewDoc(doc)} className="hover:text-[#635BFF] cursor-pointer text-left">
                    {doc.name}
                  </button>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-sec)]">
                    {doc.folder}
                  </span>
                </td>
                <td className="py-3 px-4 text-[var(--text-sec)]">{doc.size}</td>
                <td className="py-3 px-4">{doc.author}</td>
                <td className="py-3 px-4 text-[var(--text-sec)]">{doc.updatedAt}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setPreviewDoc(doc)} className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => alert(`Simulating local download for ${doc.name}`)}
                      className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete document ${doc.name}?`)) removeDocument(doc.id);
                      }}
                      className="p-1 rounded text-[var(--text-sec)] hover:text-[#E05252] cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)] mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#635BFF]">File Preview (Local Simulation)</span>
              <button onClick={() => setPreviewDoc(null)} className="p-1 rounded text-[var(--text-sec)] hover:bg-[var(--bg-main)] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <h3 className="font-bold text-base text-[var(--text-main)] mb-2">{previewDoc.name}</h3>
            <div className="p-4 rounded-xl bg-[var(--bg-main)] border border-[var(--border)] text-xs text-[var(--text-sec)] mb-4">
              {previewDoc.content}
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--text-sec)]">
              <span>Format: {previewDoc.type} • {previewDoc.size}</span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-[var(--bg-main)] border border-[var(--border)] text-[var(--text-main)] rounded-lg hover:bg-[var(--border)] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Simulation Modal */}
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
              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">File Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4_Executive_Summary.pdf"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Folder Category</label>
                <select
                  value={formData.folder}
                  onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
                  className="w-full px-2.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] outline-none"
                >
                  <option value="Architecture">Architecture</option>
                  <option value="Design Assets">Design Assets</option>
                  <option value="Security & Legal">Security & Legal</option>
                  <option value="Engineering Specs">Engineering Specs</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-main)] mb-1">Document Summary</label>
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
                  className="px-5 py-2 text-xs bg-[#635BFF] hover:bg-[#4942D9] text-white font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  Confirm Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


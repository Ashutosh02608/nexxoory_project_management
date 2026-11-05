import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from '../context/useApp';

export default function ProtectedRoute({ allowedRoles = null, children = null }) {
  const { currentUser, isAuthLoading } = useApp();

  if (isAuthLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#635BFF] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[var(--text-sec)]">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return children ? children : <Outlet />;
}


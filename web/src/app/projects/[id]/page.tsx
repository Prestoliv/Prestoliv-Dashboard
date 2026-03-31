'use client';

import { useParams } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { ProjectDetailView } from "@/components/ProjectDetailView";

export default function ProjectPage() {
  return (
    <RequireAuth>
      <ProjectPageBody />
    </RequireAuth>
  );
}

function ProjectPageBody() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  if (!id) return null;
  return <ProjectDetailView projectId={id} variant="page" />;
}

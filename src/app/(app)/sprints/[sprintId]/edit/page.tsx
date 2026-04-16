/**
 * Sprint edit page.
 * Phase 2 implementation — Phase 0 stub only.
 */
export default function EditSprintPage({ params }: { params: { sprintId: string } }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Edit Sprint {params.sprintId}</h1>
      <p className="mt-2 text-muted-foreground">Phase 2: sprint edit form will appear here.</p>
    </div>
  );
}

/**
 * Todo detail page (full-page mobile view).
 * Phase 3 implementation — Phase 0 stub only.
 */
export default function TodoDetailPage({ params }: { params: { todoId: string } }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Todo {params.todoId}</h1>
      <p className="mt-2 text-muted-foreground">Phase 3: todo detail will appear here.</p>
    </div>
  );
}
